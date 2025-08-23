
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import { ViewportProvider } from "@/hooks/useViewport";
import Components from "@/pages/Components";
import Connections from "@/pages/Connections";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ViewportProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Components />} />
                <Route path="connections" element={<Connections />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ViewportProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
