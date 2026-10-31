import React from 'react'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, type ContentStatus } from './rules'

const STATUS_STYLE: Record<ContentStatus, string> = {
  ideia: 'bg-gray-100 text-gray-700',
  producao: 'bg-sky-50 text-sky-800',
  revisao: 'bg-amber-50 text-amber-900',
  aprovado: 'bg-emerald-50 text-emerald-800',
}

export const StatusChip: React.FC<{ status: ContentStatus }> = ({ status }) => (
  <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
)
