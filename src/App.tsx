import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import Projects from "@/pages/Projects";
import ProjectSpace from "@/pages/ProjectSpace";
import WordPressCallback from "@/pages/WordPressCallback";
import PageApproval from "@/pages/PageApproval";
import ProjectInvite from "@/pages/ProjectInvite";
import MenuzitoModel from "@/pages/MenuzitoModel";
import MenuzitoStyleGuide from "@/pages/MenuzitoStyleGuide";
import UglyCashModel from "@/pages/UglyCashModel";
import UglyCashStyleGuide from "@/pages/UglyCashStyleGuide";
import UglyCashElementorPreview from "@/pages/UglyCashElementorPreview";
import ZeloStyleGuide from "@/pages/ZeloStyleGuide";
import ZeloElementorPreview from "@/pages/ZeloElementorPreview";
import ProcessBaseElementorPreview from "@/pages/ProcessBaseElementorPreview";
import ProcessBaseTemplatePreview from "@/pages/ProcessBaseTemplatePreview";
import { createProcessBaseBragaProposalTemplate } from "@/features/space/processbaseBragaProposalTemplate";
import { createProcessBaseLinksTemplate } from "@/features/space/processbaseLinksTemplate";
import InpelElementorPreview from "@/pages/InpelElementorPreview";
import JuniorElementorPreview from "@/pages/JuniorElementorPreview";
import LeoSchererElementorPreview from "@/pages/LeoSchererElementorPreview";
import LeoSchererStyleGuide from "@/pages/LeoSchererStyleGuide";
import LeoSchererRedesign from "@/pages/LeoSchererRedesign";

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              {/* Volta da aprovação no WordPress; sem login no caminho para não perder a senha da URL */}
              <Route path="/wordpress/retorno" element={<WordPressCallback />} />
              {/* Link de aprovação: o cliente abre sem login */}
              <Route path="/aprovar/:shareId" element={<PageApproval />} />
              {/* Convite para editar um projeto junto: mostra o convite antes do login */}
              <Route path="/convite/:inviteId" element={<ProjectInvite />} />
              <Route path="/menuzito-modelo" element={<MenuzitoModel />} />
              <Route path="/menuzito-style-guide" element={<MenuzitoStyleGuide />} />
              <Route path="/uglycash-modelo" element={<UglyCashModel />} />
              <Route path="/uglycash-style-guide" element={<UglyCashStyleGuide />} />
              <Route path="/uglycash-elementor-preview" element={<UglyCashElementorPreview />} />
              <Route path="/zelo-style-guide" element={<ZeloStyleGuide />} />
              <Route path="/zelo-elementor-preview" element={<ZeloElementorPreview />} />
              <Route path="/processbase-elementor-preview" element={<ProcessBaseElementorPreview />} />
              <Route path="/processbase-proposta-braga" element={<ProcessBaseTemplatePreview create={createProcessBaseBragaProposalTemplate} label="ProcessBase · Proposta Braga · Elementor nativo" />} />
              <Route path="/processbase-links" element={<ProcessBaseTemplatePreview create={createProcessBaseLinksTemplate} label="ProcessBase · Cartão de links · Elementor nativo" defaultWidth={390} />} />
              <Route path="/inpel-elementor-preview" element={<InpelElementorPreview />} />
              <Route path="/junior-elementor-preview" element={<JuniorElementorPreview />} />
              <Route path="/leoscherer-style-guide" element={<LeoSchererStyleGuide />} />
              <Route path="/leoscherer-elementor-preview" element={<LeoSchererElementorPreview />} />
              <Route path="/leoscherer-redesign" element={<LeoSchererRedesign />} />
              <Route path="/leoscherer-redesign-proposta" element={<LeoSchererRedesign proposal />} />

              {/* Projetos (um por cliente); cada um abre o seu Space */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Projects />} />
                <Route path="projetos/:projectId" element={<ProjectSpace />} />
              </Route>
              <Route path="/space" element={<Navigate to="/" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;
