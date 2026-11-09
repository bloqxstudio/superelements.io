import React from 'react'
import { StageChip } from '@/features/pauta/ui'
import { stageOf } from '@/features/pauta/rules'
import type { Content } from './rules'

/**
 * O estado de um conteúdo com os nomes da Pauta (2026-11-09: um vocabulário só). Mostra a etapa
 * inteira, inclusive o que o cliente respondeu, e não só o estado interno.
 */
export const StatusChip: React.FC<{ content: Pick<Content, 'status' | 'clientStatus'>; className?: string }> = ({ content, className }) => (
  <StageChip stage={stageOf(content)} className={className} />
)
