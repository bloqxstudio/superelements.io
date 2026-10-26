import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { PostPlan } from '@/features/criativos/plan'
import type { StoryIdea, StoryPillar } from './storyPlan'

/**
 * Stories programados (Instagram › Stories): a pauta da equipe em
 * `crm_stories`, uma linha por sequência num horário, e os ajustes em
 * `crm_story_settings`. A esteira dos agentes (`storyPipeline.ts`) escreve e
 * monta; a equipe aprova; a função `instagram` publica na hora marcada (cron).
 * Quem é da equipe nunca põe `publicado`: a trava do banco não deixa.
 */

export type StoryStatus = 'ideia' | 'criativo' | 'agendado' | 'publicando' | 'publicado' | 'falhou' | 'descartado'

export const STATUS_LABEL: Record<StoryStatus, string> = {
  ideia: 'Ideia',
  criativo: 'Para aprovar',
  agendado: 'Agendado',
  publicando: 'Publicando',
  publicado: 'No ar',
  falhou: 'Não saiu',
  descartado: 'Descartado',
}

export interface StoryFrame {
  path: string
  mediaId?: string
  permalink?: string
  publishedAt?: string
  /** reach, views, replies, shares, follows, profile_visits, navigation_tap_forward, navigation_tap_back, navigation_tap_exit… */
  insights?: Record<string, number>
}

/** A nota do Editor: `ok` falso pede atenção antes de aprovar. */
export interface StoryReview {
  ok: boolean
  note?: string
}

export interface Story {
  id: string
  teamId: string
  accountId?: string
  publishAt: number
  status: StoryStatus
  pillar: string
  title: string
  idea: Partial<StoryIdea>
  plan?: PostPlan
  review?: StoryReview
  setId?: string
  setProjectId?: string
  postId?: string
  frames: StoryFrame[]
  attempts: number
  nextTryAt?: number
  error?: string
  approvedBy?: string
  approvedAt?: number
  publishedAt?: number
  insightsAt?: number
  createdBy?: string
  updatedAt: number
}

export interface StorySettings {
  teamId: string
  accountId?: string
  setId?: string
  setProjectId?: string
  /** 0 = domingo */
  days: number[]
  /** HH:MM */
  times: string[]
  framesMax: number
  pillars: StoryPillar[]
  brief: string
  photos: boolean
  web: boolean
  /** Ainda não gravado: os valores de fábrica. */
  fresh?: boolean
}

/** Os pilares de fábrica, do cliente ideal (`brands/avence-studio/CLIENTE-IDEAL.md`). */
export const DEFAULT_PILLARS: StoryPillar[] = [
  { id: 'dor', label: 'Dor do dono', hint: 'O que o dono do negócio vive: o anúncio gasta e não vem contato, o site não vira conversa no WhatsApp, vergonha de mandar o link.' },
  { id: 'dica', label: 'Confira no seu site', hint: 'Uma coisa que o dono confere no próprio celular em um minuto: a primeira tela diz o que ele faz? o WhatsApp está a um toque?' },
  { id: 'case', label: 'Case', hint: 'Um site do estúdio por dentro, só com o que o site mostra: para quem é, como leva ao contato.' },
  { id: 'bastidor', label: 'Bastidor', hint: 'Como o estúdio trabalha: conversa, direção, prévia num link, ajustes, no ar.' },
  { id: 'convite', label: 'Convite', hint: 'Ver o site novo do próprio negócio numa prévia, antes de fechar. Sem preço, sem prazo em número.' },
]

export const defaultSettings = (teamId: string): StorySettings => ({ teamId, days: [1, 2, 3, 4, 5], times: ['10:00'], framesMax: 4, pillars: DEFAULT_PILLARS, brief: '', photos: true, web: true, fresh: true })

/** Sem as tabelas (migração 20261026090000 não aplicada). */
export class NoStoryTablesError extends Error {}

const noTables = (error: { code?: string }) => error.code === '42P01' || error.code === 'PGRST205'
const fail = (error: { code?: string; message?: string }) => (noTables(error) ? new NoStoryTablesError('sem tabelas') : new Error(error.message ?? 'Falha no banco.'))

const time = (at: string | null | undefined) => (at ? Date.parse(at) : undefined)

// ---------- ajustes ----------

interface SettingsRow {
  team_id: string
  account_id: string | null
  set_id: string | null
  set_project_id: string | null
  days: number[] | null
  times: string[] | null
  frames_max: number | null
  pillars: unknown
  brief: string | null
  photos: boolean | null
  web: boolean | null
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function loadStorySettings(teamId: string): Promise<StorySettings> {
  const { data, error } = await supabase.from('crm_story_settings').select('*').eq('team_id', teamId).maybeSingle()
  if (error) throw fail(error)
  const row = data as SettingsRow | null
  if (!row) return defaultSettings(teamId)
  const pillars = Array.isArray(row.pillars) ? (row.pillars as StoryPillar[]).filter((p) => p?.id && p.label) : []
  return {
    teamId,
    accountId: row.account_id ?? undefined,
    setId: row.set_id ?? undefined,
    setProjectId: row.set_project_id ?? undefined,
    days: (row.days ?? []).filter((d) => d >= 0 && d <= 6),
    times: (row.times ?? []).filter((t) => HHMM.test(t)),
    framesMax: row.frames_max ?? 4,
    pillars: pillars.length ? pillars : DEFAULT_PILLARS,
    brief: row.brief ?? '',
    photos: row.photos ?? true,
    web: row.web ?? true,
  }
}

export async function saveStorySettings(s: StorySettings) {
  const { error } = await supabase.from('crm_story_settings').upsert(
    {
      team_id: s.teamId,
      account_id: s.accountId ?? null,
      set_id: s.setId ?? null,
      set_project_id: s.setProjectId ?? null,
      days: [...new Set(s.days)].sort(),
      times: [...new Set(s.times.filter((t) => HHMM.test(t)))].sort(),
      frames_max: Math.min(10, Math.max(1, Math.round(s.framesMax) || 4)),
      pillars: s.pillars.filter((p) => p.id.trim() && p.label.trim()) as unknown as Json,
      brief: s.brief.slice(0, 4000),
      photos: s.photos,
      web: s.web,
    },
    { onConflict: 'team_id' }
  )
  if (error) throw fail(error)
}

// ---------- a pauta ----------

interface StoryRow {
  id: string
  team_id: string
  account_id: string | null
  publish_at: string
  status: StoryStatus
  pillar: string
  title: string
  idea: unknown
  plan: unknown
  review: unknown
  set_id: string | null
  set_project_id: string | null
  post_id: string | null
  frames: unknown
  attempts: number
  next_try_at: string | null
  error: string | null
  approved_by: string | null
  approved_at: string | null
  published_at: string | null
  insights_at: string | null
  created_by: string | null
  updated_at: string
}

const toStory = (r: StoryRow): Story => ({
  id: r.id,
  teamId: r.team_id,
  accountId: r.account_id ?? undefined,
  publishAt: Date.parse(r.publish_at),
  status: r.status,
  pillar: r.pillar,
  title: r.title,
  idea: (r.idea ?? {}) as Partial<StoryIdea>,
  plan: (r.plan ?? undefined) as PostPlan | undefined,
  review: (r.review ?? undefined) as StoryReview | undefined,
  setId: r.set_id ?? undefined,
  setProjectId: r.set_project_id ?? undefined,
  postId: r.post_id ?? undefined,
  frames: Array.isArray(r.frames) ? (r.frames as StoryFrame[]) : [],
  attempts: r.attempts,
  nextTryAt: time(r.next_try_at),
  error: r.error ?? undefined,
  approvedBy: r.approved_by ?? undefined,
  approvedAt: time(r.approved_at),
  publishedAt: time(r.published_at),
  insightsAt: time(r.insights_at),
  createdBy: r.created_by ?? undefined,
  updatedAt: Date.parse(r.updated_at),
})

/** Os stories da equipe com horário entre `from` e `to` (ms). */
export async function listStories(teamId: string, from: number, to: number): Promise<Story[]> {
  const { data, error } = await supabase
    .from('crm_stories')
    .select('*')
    .eq('team_id', teamId)
    .gte('publish_at', new Date(from).toISOString())
    .lt('publish_at', new Date(to).toISOString())
    .order('publish_at', { ascending: true })
  if (error) throw fail(error)
  return ((data ?? []) as unknown as StoryRow[]).map(toStory)
}

export async function getStory(id: string): Promise<Story | undefined> {
  const { data, error } = await supabase.from('crm_stories').select('*').eq('id', id).maybeSingle()
  if (error) throw fail(error)
  return data ? toStory(data as unknown as StoryRow) : undefined
}

/** Os que já saíram desde `since` (para a Estrategista ver o que funcionou). */
export async function listPublished(teamId: string, since: number): Promise<Story[]> {
  const { data, error } = await supabase
    .from('crm_stories')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'publicado')
    .gte('publish_at', new Date(since).toISOString())
    .order('publish_at', { ascending: false })
    .limit(40)
  if (error) throw fail(error)
  return ((data ?? []) as unknown as StoryRow[]).map(toStory)
}

export interface NewStory {
  teamId: string
  accountId?: string
  publishAt: number
  pillar: string
  title: string
  idea: StoryIdea
  setId?: string
  setProjectId?: string
}

export async function insertStories(list: NewStory[]): Promise<Story[]> {
  if (!list.length) return []
  const { data, error } = await supabase
    .from('crm_stories')
    .insert(
      list.map((s) => ({
        team_id: s.teamId,
        account_id: s.accountId ?? null,
        publish_at: new Date(s.publishAt).toISOString(),
        status: 'ideia',
        pillar: s.pillar.slice(0, 40),
        title: s.title.slice(0, 200),
        idea: s.idea as unknown as Json,
        set_id: s.setId ?? null,
        set_project_id: s.setProjectId ?? null,
      }))
    )
    .select('*')
  if (error) throw fail(error)
  return ((data ?? []) as unknown as StoryRow[]).map(toStory)
}

export interface StoryPatch {
  status?: StoryStatus
  publishAt?: number
  accountId?: string | null
  pillar?: string
  title?: string
  idea?: Partial<StoryIdea>
  plan?: PostPlan | null
  review?: StoryReview | null
  setId?: string | null
  setProjectId?: string | null
  postId?: string | null
  frames?: StoryFrame[]
  attempts?: number
  nextTryAt?: number | null
  error?: string | null
}

export async function updateStory(id: string, patch: StoryPatch): Promise<Story> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.publishAt !== undefined) row.publish_at = new Date(patch.publishAt).toISOString()
  if (patch.accountId !== undefined) row.account_id = patch.accountId
  if (patch.pillar !== undefined) row.pillar = patch.pillar.slice(0, 40)
  if (patch.title !== undefined) row.title = patch.title.slice(0, 200)
  if (patch.idea !== undefined) row.idea = patch.idea
  if (patch.plan !== undefined) row.plan = patch.plan
  if (patch.review !== undefined) row.review = patch.review
  if (patch.setId !== undefined) row.set_id = patch.setId
  if (patch.setProjectId !== undefined) row.set_project_id = patch.setProjectId
  if (patch.postId !== undefined) row.post_id = patch.postId
  if (patch.frames !== undefined) row.frames = patch.frames
  if (patch.attempts !== undefined) row.attempts = patch.attempts
  if (patch.nextTryAt !== undefined) row.next_try_at = patch.nextTryAt === null ? null : new Date(patch.nextTryAt).toISOString()
  if (patch.error !== undefined) row.error = patch.error
  const { data, error } = await supabase.from('crm_stories').update(row).eq('id', id).select('*').single()
  if (error) throw fail(error)
  return toStory(data as unknown as StoryRow)
}

// ---------- a semana ----------

const DAY = 86_400_000
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Segunda-feira 00:00 (hora deste computador) da semana de `at`. */
export function weekStart(at = Date.now()): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Mais `weeks` semanas (no relógio, não em ms: o horário de verão não desloca nada). */
export function addWeeks(start: number, weeks: number): number {
  const d = new Date(start)
  d.setDate(d.getDate() + weeks * 7)
  return d.getTime()
}

/** "segunda, 27/10, 10:00" */
export const whenText = (at: number) => {
  const d = new Date(at)
  return `${WEEKDAYS[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** "27 out a 2 nov" */
export const weekLabel = (start: number) => {
  const end = addWeeks(start, 1) - DAY
  const f = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${f(start)} a ${f(end)}`
}

/** Os horários da semana pelos ajustes (dias e horas), do mais cedo ao mais tarde. */
export function weekSlots(settings: Pick<StorySettings, 'days' | 'times'>, start: number): number[] {
  const out: number[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(day.getDate() + i)
    if (!settings.days.includes(day.getDay())) continue
    for (const t of settings.times) {
      const [h, m] = t.split(':').map(Number)
      const at = new Date(day)
      at.setHours(h, m, 0, 0)
      out.push(at.getTime())
    }
  }
  return out.sort((a, b) => a - b)
}

/** O mesmo horário (a diferença de um minuto não conta). */
export const sameSlot = (a: number, b: number) => Math.abs(a - b) < 60_000

// ---------- números ----------

export interface StoryNumbers {
  /** Alcance da primeira tela. */
  reach?: number
  /** Quantos chegaram à última tela, sobre os da primeira (0 a 1). */
  kept?: number
  replies: number
  exits: number
  follows: number
}

/** Os números da sequência: o alcance da primeira tela, quantos chegaram ao fim, respostas e saídas. */
export function storyNumbers(s: Pick<Story, 'frames'>): StoryNumbers | undefined {
  const read = s.frames.filter((f) => f.insights && Object.keys(f.insights).length)
  if (!read.length) return undefined
  const first = s.frames[0]?.insights?.reach
  const last = s.frames.at(-1)?.insights?.reach
  const sum = (key: string) => read.reduce((n, f) => n + (f.insights?.[key] ?? 0), 0)
  return { reach: first, kept: first && last !== undefined ? last / first : undefined, replies: sum('replies'), exits: sum('navigation_tap_exit'), follows: sum('follows') }
}

/** Os números em uma linha, para a Estrategista ler. */
export const numbersText = (n: StoryNumbers | undefined) =>
  n ? [n.reach !== undefined ? `alcance ${n.reach}` : '', n.kept !== undefined ? `${Math.round(n.kept * 100)}% chegaram à última tela` : '', `${n.replies} respostas`, n.exits ? `${n.exits} saíram no meio` : ''].filter(Boolean).join(', ') : undefined

// ---------- ao vivo ----------

/** A pauta muda para todo mundo da equipe na hora (a esteira, a aprovação e a publicação). */
export function useStoryFeed(teamId: string | undefined, onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange
  useEffect(() => {
    if (!teamId) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const queue = () => {
      timer ??= setTimeout(() => {
        timer = null
        latest.current()
      }, 300)
    }
    const channel = supabase
      .channel(`crm-stories-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_stories', filter: `team_id=eq.${teamId}` }, queue)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [teamId])
}
