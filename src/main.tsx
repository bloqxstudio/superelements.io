import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'

// Ponte do Claude com o Space aberto (só no servidor de dev; ver scripts/space/)
if (import.meta.hot) void import('./features/space/bridge/client')

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
