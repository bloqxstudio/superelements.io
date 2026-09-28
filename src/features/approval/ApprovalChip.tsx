import React from 'react'
import { CircleCheck, Link2, MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import { Hint } from '@/features/space/ToolbarIsland'
import { shareState, useApprovalStore } from './approvalStore'
import { DECISION_LABELS, when } from './format'

const STYLES = {
  waiting: { label: 'Com o cliente', icon: Link2, className: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  approved: { label: DECISION_LABELS.approved, icon: CircleCheck, className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  changes: { label: DECISION_LABELS.changes, icon: MessageSquareText, className: 'bg-amber-50 text-amber-800 hover:bg-amber-100' },
} as const

/** Selo no cabeçalho da página do canvas: o link de aprovação e a resposta do cliente. Abre o player com o painel. */
export const ApprovalChip: React.FC<{ pageId: string }> = ({ pageId }) => {
  const share = useApprovalStore((s) => s.shares[pageId])
  const state = shareState(share)
  if (state.kind === 'none') return null

  const style = STYLES[state.kind]
  const Icon = style.icon
  const detail =
    state.kind === 'waiting'
      ? `Link enviado em ${when(state.share.sharedAt)}, ainda sem resposta`
      : `${state.latest.name ? `${state.latest.name}, ` : ''}${when(state.latest.createdAt)}${state.latest.note ? `: “${state.latest.note.slice(0, 80)}${state.latest.note.length > 80 ? '…' : ''}”` : ''}`

  const open = () => {
    useApprovalStore.getState().setPanelOpen(true)
    useSpaceStore.getState().openPlayer(pageId)
  }

  return (
    <Hint label={`Aprovação: ${style.label}`} hint={detail}>
      <button
        type="button"
        onClick={open}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          style.className
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {style.label}
      </button>
    </Hint>
  )
}
