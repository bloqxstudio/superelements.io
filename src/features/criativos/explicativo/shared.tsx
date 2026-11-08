import React from 'react'
import { useEditor } from '../store'
import type { CodeScene, CreativeSet } from '../types'
import { videoLength } from './timeline'
import type { ExplainerData, PatternId } from './types'

/** Peças comuns às telas do vídeo explicativo. */

export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
export const field = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{children}</p>
export const slug = (s: string) => s.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[^\w]/g, '').toLowerCase().slice(0, 24)
export const uid = () => Math.random().toString(36).slice(2, 10)

/** Muda o vídeo explicativo `id`; a duração da cena acompanha (cortes e roteiro mudam o tamanho do vídeo). */
export const editExplainer = (id: string, fn: (d: ExplainerData, s: CodeScene) => Partial<ExplainerData>, scenePatch?: Partial<CodeScene>) =>
  useEditor.getState().edit((set: CreativeSet) => ({
    ...set,
    scenes: (set.scenes ?? []).map((s) => {
      if (s.id !== id || !s.explainer) return s
      const explainer = { ...s.explainer, ...fn(s.explainer, s) }
      return { ...s, ...scenePatch, explainer, duration: videoLength(explainer), updatedAt: Date.now() }
    }),
  }))

export const PATTERN_COLOR: Record<PatternId, string> = { gancho: 'bg-red-500', titulo: 'bg-violet-500', icone: 'bg-amber-500', lista: 'bg-emerald-500', numero: 'bg-sky-500', comparar: 'bg-rose-500', processo: 'bg-teal-500', foto: 'bg-fuchsia-500', pergunta: 'bg-orange-500', citacao: 'bg-indigo-500', cta: 'bg-gray-900' }

export const isBriefing = (d: ExplainerData) => d.mode === 'briefing'
