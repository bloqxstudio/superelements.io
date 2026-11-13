import React, { useEffect } from 'react'
import { useCrm } from '@/features/crm/crmStore'
import { McpDialog } from '@/features/crm/McpDialog'
import { iaraEnabled, useMcpConnect } from './connect'
import { useMcpChannel } from './live'
import { McpLiveBadge } from './McpLiveBadge'
import { CopyForAi } from './CopyForAi'

/**
 * O "Conectar sua IA" de qualquer tela (menu lateral, botões que antes chamavam a Iara). Com a Iara
 * desligada, os rascunhos que as telas mandavam a ela (`iara:draft`) também viram pedido copiado.
 */
export const McpHost: React.FC = () => {
  const team = useCrm((s) => s.team)
  const { open, request, show, close } = useMcpConnect()
  // A IA conectada ao vivo: o canal da conta e o aviso flutuante
  useMcpChannel(team?.id)

  useEffect(() => {
    if (iaraEnabled()) return
    const onDraft = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (typeof text === 'string' && text.trim() && useMcpConnect.getState().request !== text.trim()) show(text)
    }
    window.addEventListener('iara:draft', onDraft)
    return () => window.removeEventListener('iara:draft', onDraft)
  }, [show])

  if (!team) return null
  return (
    <>
      <McpLiveBadge />
      <CopyForAi />
      <McpDialog open={open} onOpenChange={(v) => (v ? show() : close())} teamId={team.id} teamName={team.name} request={request} />
    </>
  )
}
