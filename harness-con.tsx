// Temporário: a tela de ligar o conector sozinha, para testar colando o código. Apagar depois.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { useConnector } from '@/features/space/connector/connectorStore'
import { useChat } from '@/features/space/chat/chatStore'
import './src/index.css'
;(window as unknown as { __t: unknown }).__t = { connector: useConnector, chat: useChat }
createRoot(document.getElementById('root')!).render(<ConnectorPrompt />)
