
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ViewportProvider } from "@/hooks/useViewport";
import { ContentSecurityPolicy } from "@/components/security/ContentSecurityPolicy";
import Components from "@/pages/Components";
import Connections from "@/pages/Connections";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminPricing from "@/pages/AdminPricing";
import PricingUnified from "@/pages/PricingUnified";
import PricingEnglish from "@/pages/PricingEnglish";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import PaymentSuccess from "@/pages/PaymentSuccess";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ContentSecurityPolicy />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ViewportProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/subscription-success" element={<SubscriptionSuccess />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Components />} />
                <Route path="connections" element={
                  <ProtectedRoute>
                    <Connections />
                  </ProtectedRoute>
                } />
                <Route path="admin" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="admin/pricing" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPricing />
                  </ProtectedRoute>
                } />
                <Route path="profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="pricing" element={<PricingUnified />} />
                <Route path="pricing-en" element={<PricingEnglish />} />
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
