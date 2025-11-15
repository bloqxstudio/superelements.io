import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CentralizedComponentLibrary from '@/components/CentralizedComponentLibrary';
import { CategorySidebar } from '@/features/components/CategorySidebar';
import PreviewModal from '@/components/PreviewModal';
import { ProBanner } from '@/components/ProBanner';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useConnectionSync } from '@/hooks/useConnectionSync';
import { CartButton } from '@/features/cart/components/CartButton';
import { CartDrawer } from '@/features/cart/components/CartDrawer';
import { useWordPressStore } from '@/store/wordpressStore';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useSlugResolver } from '@/hooks/useSlugResolver';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { PostTypeCategoryService } from '@/services/postTypeCategoryService';

const Components = () => {
  const { connectionId, categoryId, connectionSlug, categorySlug, componentSlug } = useParams();
  const navigate = useNavigate();
  
  // Seletores específicos para evitar re-renders
  const connections = useConnectionsStore(useCallback((state) => state.connections, []));
  const setActiveConnection = useConnectionsStore(useCallback((state) => state.setActiveConnection, []));
  const activeConnectionId = useConnectionsStore(useCallback((state) => state.activeConnectionId, []));
  const { syncConnection } = useConnectionSync();
  
  // Seletores específicos
  const setSelectedCategories = useWordPressStore(useCallback((state) => state.setSelectedCategories, []));
  const selectedCategories = useWordPressStore(useCallback((state) => state.selectedCategories, []));
  
  const { getConnectionBySlug, getCategoryBySlug, getConnectionSlug, getCategorySlug } = useSlugResolver();
  const { connectionsData } = useMultiConnectionData();
  
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    component: null as any
  });

  const handlePreview = useCallback((url: string, title?: string, component?: any) => {
    setPreviewModal({
      isOpen: true,
      url,
      title: title || 'Component Preview',
      component: component || null
    });
    
    // Track preview opened event in GA4
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'preview_opened', {
        component_slug: component?.slug || 'unknown',
        component_title: title || 'Unknown',
        connection_slug: connectionSlug || 'unknown',
        category_slug: categorySlug || 'all'
      });
    }
    
    console.log('🔍 handlePreview called with:', {
      hasComponent: !!component,
      componentSlug: component?.slug,
      connectionId: component?.connection_id,
      categories: component?.categories,
      currentConnectionSlug: connectionSlug,
      currentCategorySlug: categorySlug
    });
    
    // Atualizar URL com slug do componente para ser compartilhável (estrutura de 3 níveis)
    if (component?.slug) {
      const connSlug = connectionSlug || getConnectionSlug(component.connection_id || connectionId);
      const categoryId = component.categories?.[0];
      let catSlug = categorySlug;
      
      console.log('🔍 Step 1 - Initial values:', { connSlug, categoryId, catSlug });
      
      // Fallback: buscar categoria em connectionsData
      if (!catSlug && categoryId && component.connection_id) {
        const connectionData = connectionsData.find(cd => cd.connectionId === component.connection_id);
        const category = connectionData?.categories.find(c => c.id === categoryId);
        catSlug = category?.slug || null;
        console.log('🔍 Step 2 - Found category in connectionsData:', { category, catSlug });
      }
      
      // Último fallback: buscar via getCategorySlug
      if (!catSlug && categoryId) {
        catSlug = getCategorySlug(categoryId);
        console.log('🔍 Step 3 - getCategorySlug fallback:', { catSlug });
      }
      
      console.log('🔍 Final URL parts:', { connSlug, catSlug, componentSlug: component.slug });
      
      // Só navegar se tiver todos os slugs necessários (estrutura de 3 níveis)
      if (connSlug && catSlug && component.slug) {
        const newUrl = `/${connSlug}/${catSlug}/${component.slug}`;
        console.log('✅ Navigating to:', newUrl);
        navigate(newUrl);
      } else {
        console.warn('⚠️ Missing slugs, not updating URL:', { connSlug, catSlug, componentSlug: component.slug });
      }
      // Se não conseguir obter catSlug, abrir modal sem mudar URL
    }
  }, [navigate, connectionSlug, categorySlug, connectionsData, getCategorySlug, getConnectionSlug]);
  
  const closePreview = useCallback(() => {
    setPreviewModal(prev => ({
      ...prev,
      isOpen: false
    }));
    
    // Voltar para URL sem o componente
    if (componentSlug) {
      const connSlug = connectionSlug || getConnectionSlug(connectionId);
      const catSlug = categorySlug || getCategorySlug(parseInt(categoryId || '0'));
      
      if (connSlug && catSlug) {
        navigate(`/${connSlug}/${catSlug}`, { replace: true });
      } else if (connSlug) {
        navigate(`/${connSlug}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [navigate, connectionSlug, categorySlug, getConnectionSlug, getCategorySlug]);

  const handleForceSync = useCallback(() => {
    syncConnection();
  }, [syncConnection]);

  // Auto-abrir componente quando há componentSlug na URL
  useEffect(() => {
    const openComponentFromUrl = async () => {
      if (!componentSlug || previewModal.isOpen) return;
      
      const { components } = useWordPressStore.getState();
      console.log('🔗 Auto-opening component from URL:', componentSlug);
      
      // Buscar componente no cache primeiro
      const cachedComponent = components.find(c => c.slug === componentSlug);
      
      if (cachedComponent) {
        console.log('✅ Found component in cache:', cachedComponent.title?.rendered);
        handlePreview(cachedComponent.link, cachedComponent.title?.rendered, cachedComponent);
        return;
      }
      
      // Se não está em cache, buscar do WordPress
      if (connectionSlug) {
        const connection = getConnectionBySlug(connectionSlug);
        if (connection) {
          try {
            const endpoint = `${connection.base_url}/wp-json/wp/v2/${connection.post_type}?slug=${componentSlug}`;
            
            // Tentar fetch público primeiro
            let response = await fetch(endpoint);
            
            // Se falhar por autenticação E houver credentials, tentar com Basic Auth
            if ((response.status === 401 || response.status === 403) && connection.credentials) {
              console.info('🔒 Components: Tentando com autenticação...');
              response = await fetch(endpoint, {
                headers: {
                  'Authorization': `Basic ${btoa(
                    `${connection.credentials.username}:${connection.credentials.application_password}`
                  )}`
                }
              });
            }
            
            if (response.ok) {
              const data = await response.json();
              const componentData = Array.isArray(data) ? data[0] : data;
              
              if (componentData) {
                const component = {
                  ...componentData,
                  connection_id: connection.id,
                  connection_name: connection.name,
                  connection_access_level: connection.accessLevel
                };
                
                console.log('✅ Fetched component from WordPress:', component.title?.rendered);
                handlePreview(component.link, component.title?.rendered, component);
              }
            }
          } catch (error) {
            console.error('❌ Error fetching component:', error);
          }
        }
      }
    };
    
    openComponentFromUrl();
  }, [componentSlug, connectionSlug, previewModal.isOpen, getConnectionBySlug]);

  // Sincronizar URL params com estado
  useEffect(() => {
    console.log('🔄 Syncing URL params with state:', {
      connectionId,
      categoryId,
      connectionSlug,
      categorySlug,
      connectionsDataCount: connectionsData.length,
      connectionsLoaded: connections.length,
      activeConnectionId,
      selectedCategories
    });

    // Aguarda conexões carregarem quando houver slug de conexão
    if (connectionSlug && connections.length === 0) {
      console.log('⏳ Waiting for connections to load before resolving slugs');
      return;
    }

    // Priorizar slugs sobre IDs
    let resolvedConnectionId: string | null | undefined = connectionId;
    let resolvedCategoryId: string | null | undefined = categoryId;

    // Resolver conexão por slug
    if (connectionSlug && !connectionId) {
      const connection = getConnectionBySlug(connectionSlug);
      resolvedConnectionId = connection?.id || null;
      console.log('🔍 Resolved connection slug:', {
        connectionSlug,
        resolvedConnectionId,
        connection: connection?.name
      });
    }

    // Aplicar conexão IMEDIATAMENTE após resolver para disparar carregamento de categorias
    if (resolvedConnectionId && activeConnectionId !== resolvedConnectionId) {
      console.log('⚙️ Setting active connection early:', resolvedConnectionId);
      setActiveConnection(resolvedConnectionId);
    }

    // Resolver categoria por slug (apenas quando categorias estiverem carregadas)
    if (categorySlug && !categoryId && resolvedConnectionId) {
      const connectionData = connectionsData.find(cd => cd.connectionId === resolvedConnectionId);
      
      // Se a conexão não está nas active connections, usar fallback via API
      if (!connectionData) {
        const connection = connections.find(c => c.id === resolvedConnectionId);
        if (connection) {
          console.log('⚙️ Using API fallback to resolve category for non-active connection');
          
          const resolveCategoryViaApi = async () => {
            try {
              const config = {
                baseUrl: connection.base_url,
                postType: connection.post_type,
                jsonField: connection.json_field,
                previewField: connection.preview_field,
                username: connection.credentials?.username || '',
                applicationPassword: connection.credentials?.application_password || ''
              };
              
              const cats = await PostTypeCategoryService.fetchCategoriesWithComponents(config);
              const cat = cats.find(c => c.slug === categorySlug);
              
              if (cat) {
                console.log('✅ Fallback resolved category:', cat);
                if (!(selectedCategories.length === 1 && selectedCategories[0] === cat.id)) {
                  setSelectedCategories([cat.id]);
                }
              } else {
                console.log('❌ Fallback could not resolve category:', categorySlug);
              }
            } catch (e) {
              console.error('❌ Fallback error resolving categories:', e);
            }
          };
          
          resolveCategoryViaApi();
        }
        return;
      }
      
      if (!connectionData.isLoaded) {
        console.log('⏳ Waiting categories to load before applying category filter', {
          connectionId: resolvedConnectionId,
          hasData: !!connectionData,
          isLoaded: connectionData?.isLoaded,
        });
        return; // evita loop até termos dados
      }
      const category = getCategoryBySlug(categorySlug, resolvedConnectionId, connectionData.categories);
      resolvedCategoryId = category ? String(category.id) : null;
      
      // Se categoria não encontrada, tentar resolver como componentSlug (compatibilidade com links antigos)
      if (!category) {
        console.log('⚠️ Category not found, trying to resolve as component slug:', categorySlug);
        
        const tryResolveAsComponent = async () => {
          const connection = connections.find(c => c.id === resolvedConnectionId);
          if (!connection) return;
          
          try {
            const endpoint = `${connection.base_url}/wp-json/wp/v2/${connection.post_type}?slug=${categorySlug}&_fields=id,slug,categories`;
            
            // Tentar fetch público primeiro
            let response = await fetch(endpoint);
            
            // Se 401/403 e houver credentials, tentar autenticado
            if ((response.status === 401 || response.status === 403) && connection.credentials) {
              response = await fetch(endpoint, {
                headers: {
                  'Authorization': `Basic ${btoa(
                    `${connection.credentials.username}:${connection.credentials.application_password}`
                  )}`
                }
              });
            }
            
            if (response.ok) {
              const data = await response.json();
              if (data.length > 0) {
                const componentData = data[0];
                const firstCategoryId = componentData.categories?.[0];
                
                if (firstCategoryId) {
                  const catData = connectionData.categories.find((c: any) => c.id === firstCategoryId);
                  if (catData) {
                    console.log('✅ Resolved as component! Redirecting to 3-level structure:', {
                      component: categorySlug,
                      category: catData.slug
                    });
                    navigate(`/${connectionSlug}/${catData.slug}/${categorySlug}`, { replace: true });
                    return;
                  }
                }
              }
            }
            
            console.log('❌ Could not resolve as component or category:', categorySlug);
          } catch (error) {
            console.error('❌ Error resolving component:', error);
          }
        };
        
        tryResolveAsComponent();
      }
      
      console.log('🔍 Resolved category slug:', {
        categorySlug,
        connectionId: resolvedConnectionId,
        foundCategory: category,
        resolvedCategoryId,
      });
    }

    // Caso "home" (sem conexão na URL)
    if (!resolvedConnectionId && !connectionSlug && !connectionId) {
      if (activeConnectionId !== null) setActiveConnection(null);
      if (selectedCategories.length > 0) setSelectedCategories([]);
      console.log('🏠 Home detected - ensuring no active connection and no category filters');
      return;
    }

    // Aplicar categorias somente quando necessário
    if (resolvedConnectionId) {
      if (resolvedCategoryId) {
        const categoryIdNum = parseInt(resolvedCategoryId, 10);
        const isSame = selectedCategories.length === 1 && selectedCategories[0] === categoryIdNum;
        if (!isSame) {
          console.log('✅ Applying category filter:', { categoryIdNum });
          setSelectedCategories([categoryIdNum]);
        }
      } else {
        if (selectedCategories.length > 0) {
          console.log('📋 Clearing category filters for connection');
          setSelectedCategories([]);
        }
      }
    }
  }, [
    connectionId,
    categoryId,
    connectionSlug,
    categorySlug,
    connections.length,
    connectionsData,
    activeConnectionId,
    selectedCategories,
    getConnectionBySlug,
    getCategoryBySlug,
    setActiveConnection,
    setSelectedCategories,
    navigate,
    connections
  ]);

  // Fixed layout with proper sidebar integration
  return <div className="h-screen flex overflow-hidden">
      {/* Category Sidebar - Fixed position */}
      <CategorySidebar />

      {/* Main Content Area - Properly spaced for sidebar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto lg:ml-64">
        {/* How to Use Section */}
        <div className="bg-gray-50/80 rounded-xl border border-gray-100 px-4 lg:px-6 py-4 mx-4 lg:mx-6 mt-6 mb-4 flex-shrink-0">
          <div className="flex items-center justify-between flex-col lg:flex-row gap-4 lg:gap-0">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">Como utilizar</span>
            </div>
            
            <div className="flex items-center gap-4 lg:gap-8">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 shadow-sm">
                  1
                </div>
                <span className="text-sm text-gray-600">Copiar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 shadow-sm">
                  2
                </div>
                <span className="text-sm text-gray-600">Colar no Elementor</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 shadow-sm">
                  3
                </div>
                <span className="text-sm text-gray-600">Publicar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Component Library */}
        <div className="flex-1 px-4 lg:px-6 pb-20 min-h-0">
          <CentralizedComponentLibrary onPreview={handlePreview} />
        </div>
      </div>

      {/* Pro Banner for free users */}
      <ProBanner />

      {/* Preview Modal with enhanced props */}
      <PreviewModal isOpen={previewModal.isOpen} onClose={closePreview} previewUrl={previewModal.url} title={previewModal.title} component={previewModal.component} />
      
      {/* Cart System */}
      <CartButton />
      <CartDrawer />
    </div>;
};
export default Components;