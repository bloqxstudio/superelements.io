import { resolveIa } from '@/features/ia/porTarefa'
import { useCrm } from '@/features/crm/crmStore'
import { standardBlock } from '@/features/cerebro/standard'
import { callAiQuiet } from '../link'
import type { SetBrand } from '../types'
import { RESEARCH_SYSTEM } from './prompts'

/**
 * Pesquisa para vídeo viral (2026-11-08, o usuário: "criar um fluxo para fazer uma pesquisa e gerar
 * um vídeo viral, com uma curiosidade, algo que prenda o user… uma curiosidade da BMW 1250 GS… pra
 * começar a colocar a marca na cabeça de amantes de moto"). A IA do conector pesquisa na web
 * (WebSearch e WebFetch, só leitura), escolhe UMA curiosidade surpreendente e verificável, confirma
 * cada fato numa fonte e devolve o briefing do vídeo. Fato sem fonte não entra; a tela mostra as
 * fontes para a pessoa conferir antes de publicar.
 */

export interface Research {
  topic: string
  /** O título da curiosidade. */
  title: string
  /** A primeira frase do vídeo. */
  hook: string
  facts: { text: string; source: string }[]
  /** O briefing que vai para o roteiro (só com os fatos confirmados). */
  briefing: string
  /** Para quem e por que prende. */
  angle?: string
  at: number
}


const STEP: Record<string, string> = { start: 'Começando a pesquisa…', thinking: 'Pensando no ângulo…', reading: 'Lendo as fontes…', writing: 'Escrevendo o briefing…' }

export async function researchCuriosity(topic: string, opts: { brand: SetBrand; extra?: string; signal?: AbortSignal; onStep?: (s: string) => void }): Promise<Research> {
  const clean = topic.trim()
  if (!clean) throw new Error('Diga o tema da pesquisa.')
  const voice = await standardBlock(useCrm.getState().team?.id, '9x16')
  const prompt = [
    `## O tema\n${clean}`,
    opts.extra?.trim() ? `## Pedido extra\n${opts.extra.trim()}` : '',
    `## A marca que publica\n${opts.brand.name || '(a marca da conta)'}${voice ? `\n\n${voice}` : ''}`,
  ].filter(Boolean).join('\n\n')
  const out = await callAiQuiet<{ reply?: string; items?: { ref: string; text: string }[] }>('agent', { engine: resolveIa('copy'), system: RESEARCH_SYSTEM, prompt, web: true }, opts.signal, (step, detail) => opts.onStep?.(detail || STEP[step] || 'Pesquisando…'))
  const raw = (out.items ?? []).find((i) => i?.ref === 'pesquisa')?.text ?? ''
  let j: { titulo?: string; gancho?: string; angulo?: string; fatos?: { texto?: string; fonte?: string }[]; briefing?: string }
  try {
    j = JSON.parse(raw.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim())
  } catch {
    throw new Error('A pesquisa não voltou num formato que eu leia. Tente de novo.')
  }
  const facts = (j.fatos ?? []).map((f) => ({ text: String(f.texto ?? '').trim(), source: String(f.fonte ?? '').trim() })).filter((f) => f.text && /^https?:\/\//.test(f.source)).slice(0, 8)
  if (!facts.length) throw new Error('A pesquisa não confirmou nenhum fato com fonte. Tente outro tema ou seja mais específico.')
  const briefing = String(j.briefing ?? '').trim()
  return {
    topic: clean,
    title: String(j.titulo ?? clean).trim().slice(0, 120),
    hook: String(j.gancho ?? '').trim().slice(0, 200),
    angle: j.angulo ? String(j.angulo).trim().slice(0, 300) : undefined,
    facts,
    briefing: [briefing, '', 'Fatos confirmados (use só estes):', ...facts.map((f) => `- ${f.text} (${f.source})`)].join('\n').trim(),
    at: Date.now(),
  }
}
