import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import { ViewportProvider } from "@/hooks/useViewport";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Components from "@/pages/Components";
import Connections from "@/pages/Connections";
import ClientAccounts from "@/pages/ClientAccounts";
import ClientAccountDetail from "@/pages/ClientAccountDetail";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import AdminUsers from "@/pages/admin/Users";
import AdminResources from "@/pages/admin/Resources";
import Resources from "@/pages/Resources";
import ComponentView from "@/pages/ComponentView";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ViewportProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                
                {/* Legacy routes with IDs (for backward compatibility) */}
                <Route path="/component/:connectionId/:componentId" element={<ComponentView />} />
                <Route path="/connection/:connectionId" element={<Components />} />
                <Route path="/connection/:connectionId/category/:categoryId" element={<Components />} />
                
                {/* Main layout */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Components />} />
                  
                  {/* Admin routes */}
                  <Route path="connections" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <Connections />
                    </ProtectedRoute>
                  } />
                  <Route path="client-accounts" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <ClientAccounts />
                    </ProtectedRoute>
                  } />
                  <Route path="client-accounts/:connectionId" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <ClientAccountDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/users" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/resources" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <AdminResources />
                    </ProtectedRoute>
                  } />
                  
                  {/* Resources page for PRO and admin users */}
                  <Route path="resources" element={
                    <ProtectedRoute requireRole={['pro', 'admin']}>
                      <Resources />
                    </ProtectedRoute>
                  } />
                  
                  {/* Slug-based routes (must be last to avoid conflicts) */}
                  <Route path=":connectionSlug" element={<Components />} />
                  <Route path=":connectionSlug/:categorySlug" element={<Components />} />
                  <Route path=":connectionSlug/:categorySlug/:componentSlug" element={<ComponentView />} />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ViewportProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
