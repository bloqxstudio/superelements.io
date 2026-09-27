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
import MenuzitoModel from "@/pages/MenuzitoModel";
import MenuzitoStyleGuide from "@/pages/MenuzitoStyleGuide";
import UglyCashModel from "@/pages/UglyCashModel";
import UglyCashStyleGuide from "@/pages/UglyCashStyleGuide";
import UglyCashElementorPreview from "@/pages/UglyCashElementorPreview";
import ZeloStyleGuide from "@/pages/ZeloStyleGuide";
import ZeloElementorPreview from "@/pages/ZeloElementorPreview";

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
              <Route path="/menuzito-modelo" element={<MenuzitoModel />} />
              <Route path="/menuzito-style-guide" element={<MenuzitoStyleGuide />} />
              <Route path="/uglycash-modelo" element={<UglyCashModel />} />
              <Route path="/uglycash-style-guide" element={<UglyCashStyleGuide />} />
              <Route path="/uglycash-elementor-preview" element={<UglyCashElementorPreview />} />
              <Route path="/zelo-style-guide" element={<ZeloStyleGuide />} />
              <Route path="/zelo-elementor-preview" element={<ZeloElementorPreview />} />

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
