import React, { useState } from 'react';
import CentralizedComponentLibrary from '@/components/CentralizedComponentLibrary';
import { CategorySidebar } from '@/features/components/CategorySidebar';
import PreviewModal from '@/components/PreviewModal';
import { ProBanner } from '@/components/ProBanner';
import { CartButton } from '@/features/cart/components/CartButton';
import { CartDrawer } from '@/features/cart/components/CartDrawer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { motion } from 'framer-motion';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const Components = () => {
  const { activeWorkspace } = useWorkspace();
  useMultiConnectionData(activeWorkspace?.id);

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
    setPreviewModal(prev => ({ ...prev, isOpen: false }));
  };

  return <div className="h-full flex overflow-hidden bg-[#f7f7f8]">
    {/* Category Sidebar - Fixed position */}
    <CategorySidebar />

    {/* Main Content Area - Properly spaced for sidebar */}
    <motion.div
      className="flex-1 flex flex-col min-w-0 overflow-auto lg:ml-64"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* How to Use Section */}
      <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200/70 px-4 lg:px-6 py-4 mx-4 lg:mx-6 mt-6 mb-4 flex-shrink-0 shadow-sm">
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
      </motion.div>

      {/* Breadcrumbs */}
      <motion.div variants={itemVariants}>
        <Breadcrumbs />
      </motion.div>

      {/* Component Library */}
      <motion.div variants={itemVariants} className="flex-1 px-4 lg:px-6 pb-20 min-h-0">
        <CentralizedComponentLibrary onPreview={handlePreview} />
      </motion.div>
    </motion.div>

    {/* Pro Banner for free users */}
    <ProBanner />

    {/* Preview Modal */}
    <PreviewModal isOpen={previewModal.isOpen} onClose={closePreview} previewUrl={previewModal.url} title={previewModal.title} component={previewModal.component} />

    {/* Cart System */}
    <CartButton />
    <CartDrawer />
  </div>;
};

export default Components;
