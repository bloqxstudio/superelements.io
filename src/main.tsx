import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'

// Agentes no canvas (ponte e chat): no dev, pelo servidor do Vite (scripts/space/); publicado, pelo
// conector na máquina de quem usa (scripts/connector/)
void import('./features/space/connector/agentLink').then((link) => link.startAgentLink())

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
