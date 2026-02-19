import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ViewportProvider } from "@/hooks/useViewport";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import Components from "@/pages/Components";
import Connections from "@/pages/Connections";
import ClientAccounts from "@/pages/ClientAccounts";
import ClientAccountDetail from "@/pages/ClientAccountDetail";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import AdminUsers from "@/pages/admin/Users";
import AdminResources from "@/pages/admin/Resources";
import AdminWorkspaces from "@/pages/admin/Workspaces";
import Resources from "@/pages/Resources";
import ComponentView from "@/pages/ComponentView";
import Home from "@/pages/Home";
import Partners from "@/pages/Partners";
import WorkspaceSelect from "@/pages/WorkspaceSelect";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
            <ViewportProvider>
              <ErrorBoundary>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/workspace" element={<WorkspaceSelect />} />
                {/* Legacy routes with IDs (for backward compatibility) */}
                <Route
                  path="/component/:connectionId/:componentId"
                  element={
                    <WorkspaceGate>
                      <ComponentView />
                    </WorkspaceGate>
                  }
                />
                <Route
                  path="/connection/:connectionId"
                  element={
                    <WorkspaceGate>
                      <Components />
                    </WorkspaceGate>
                  }
                />
                <Route
                  path="/connection/:connectionId/category/:categoryId"
                  element={
                    <WorkspaceGate>
                      <Components />
                    </WorkspaceGate>
                  }
                />
                
                {/* Main layout */}
                <Route path="/" element={<Layout />}>
                  <Route
                    index
                    element={
                      <WorkspaceGate>
                        <Components />
                      </WorkspaceGate>
                    }
                  />
                  <Route path="inicio" element={
                    <WorkspaceGate>
                      <Home />
                    </WorkspaceGate>
                  } />
                  
                  {/* Admin routes */}
                  <Route path="connections" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <Connections />
                    </ProtectedRoute>
                  } />
                  <Route path="client-accounts" element={
                    <WorkspaceGate>
                      <ClientAccounts />
                    </WorkspaceGate>
                  } />
                  <Route path="client-accounts/:connectionId" element={
                    <WorkspaceGate>
                      <ClientAccountDetail />
                    </WorkspaceGate>
                  } />
                  <Route path="admin/users" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/resources" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <WorkspaceGate>
                        <AdminResources />
                      </WorkspaceGate>
                    </ProtectedRoute>
                  } />
                  <Route path="admin/workspaces" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <AdminWorkspaces />
                    </ProtectedRoute>
                  } />
                  
                  {/* Resources page for PRO and admin users */}
                  <Route path="resources" element={
                    <ProtectedRoute requireRole={['pro', 'admin']}>
                      <WorkspaceGate>
                        <Resources />
                      </WorkspaceGate>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="partners" element={<Partners />} />

                  {/* Slug-based routes (must be last to avoid conflicts) */}
                  <Route
                    path=":connectionSlug"
                    element={
                      <WorkspaceGate>
                        <Components />
                      </WorkspaceGate>
                    }
                  />
                  <Route
                    path=":connectionSlug/:categorySlug"
                    element={
                      <WorkspaceGate>
                        <Components />
                      </WorkspaceGate>
                    }
                  />
                  <Route
                    path=":connectionSlug/:categorySlug/:componentSlug"
                    element={
                      <WorkspaceGate>
                        <ComponentView />
                      </WorkspaceGate>
                    }
                  />
                </Route>
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
            </ViewportProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
