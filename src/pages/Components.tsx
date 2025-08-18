import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CentralizedComponentLibrary from '@/components/CentralizedComponentLibrary';
import { CategorySidebar } from '@/features/components/CategorySidebar';
import PreviewModal from '@/components/PreviewModal';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useAuthStore } from '@/store/authStore';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useAutoSync } from '@/hooks/useAutoSync';
import { useConnectionSync } from '@/hooks/useConnectionSync';
const Components = () => {
  const navigate = useNavigate();
  const {
    profile
  } = useAuthStore();
  const {
    connections
  } = useConnectionsStore();
  const {
    syncConnection
  } = useConnectionSync();
  const {
    userRole,
    canAccessProFeatures,
    isFree,
    isPro,
    isAdmin
  } = useAccessControl();
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    url: '',
    title: '',
    component: null as any
  });

  // Auto-sync connections
  useAutoSync();
  const handlePreview = (url: string, title?: string, component?: any) => {
    console.log('🎯 COMPONENTS PAGE - Opening preview modal:', {
      url,
      title,
      hasComponent: !!component,
      componentId: component?.id,
      connectionId: component?.connection_id
    });
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
    console.log('🔄 Manual force sync requested by user');
    syncConnection();
  };

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

        {/* Component Library */}
        <div className="flex-1 px-4 lg:px-6 pb-6 min-h-0">
          <CentralizedComponentLibrary onPreview={handlePreview} />
        </div>
      </div>

      {/* Preview Modal with enhanced props */}
      <PreviewModal isOpen={previewModal.isOpen} onClose={closePreview} previewUrl={previewModal.url} title={previewModal.title} component={previewModal.component} />
    </div>;
};
export default Components;