// Temporário: a tela de Prospecção sem login, para captura. Apagar depois.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import Prospects from '@/pages/Prospects'
import './src/index.css'

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <Toaster />
    <MemoryRouter>
      <div className="h-14 border-b bg-white" />
      <Prospects />
    </MemoryRouter>
  </TooltipProvider>
)
