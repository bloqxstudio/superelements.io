import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

const Components = () => {
  const { connectionId, categoryId, connectionSlug, categorySlug } = useParams();
  const {
    connections,
    setActiveConnection
  } = useConnectionsStore();
  const {
    syncConnection
  } = useConnectionSync();
  const { setSelectedCategories, availableCategories } = useWordPressStore();
  const { getConnectionBySlug, getCategoryBySlug } = useSlugResolver();
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    component: null as any
  });

  const handlePreview = (url: string, title?: string, component?: any) => {
    setPreviewModal({
      isOpen: true,
      url,
      title: title || 'Component Preview',
      component: component || null
    });
  };
  const closePreview = () => {
    setPreviewModal(prev => ({
      ...prev,
      isOpen: false
    }));
  };
  const handleForceSync = () => {
    syncConnection();
  };

  // Sincronizar URL params com estado
  useEffect(() => {
    // Priorizar slugs sobre IDs
    let resolvedConnectionId = connectionId;
    let resolvedCategoryId = categoryId;

    // Se tem slug de conexão, resolver para ID
    if (connectionSlug && !connectionId) {
      const connection = getConnectionBySlug(connectionSlug);
      resolvedConnectionId = connection?.id;
    }

    // Se tem slug de categoria, resolver para ID
    if (categorySlug && !categoryId && resolvedConnectionId) {
      const category = getCategoryBySlug(categorySlug, resolvedConnectionId);
      resolvedCategoryId = category?.id.toString();
    }

    // Aplicar filtros
    if (resolvedConnectionId) {
      setActiveConnection(resolvedConnectionId);
      
      if (resolvedCategoryId) {
        setSelectedCategories([parseInt(resolvedCategoryId, 10)]);
      } else {
        setSelectedCategories([]);
      }
    } else {
      // Limpar filtros se estiver na home
      setActiveConnection(null);
      setSelectedCategories([]);
    }
  }, [connectionId, categoryId, connectionSlug, categorySlug]);

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