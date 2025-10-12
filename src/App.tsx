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
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import AdminUsers from "@/pages/admin/Users";

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
                <Route path="/" element={<Layout />}>
                  <Route index element={<Components />} />
                  <Route path="connections" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <Connections />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/users" element={
                    <ProtectedRoute requireRole={['admin']}>
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
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
