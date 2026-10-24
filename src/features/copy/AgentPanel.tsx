import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Globe, Loader2, Send, Sparkles, Square, Undo2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAiAvailable, useCreativeLink } from '@/features/criativos/link'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import type { ChatAgentId } from '@/features/space/chat/protocol'
import type { ChatSkill } from '@/features/space/chat/skills'
import { skillIcon } from '@/features/skills/skillIcon'
import { useSkills, watchSkills } from '@/features/skills/skillsStore'
import { COPY_AGENTS, agentById, type CopyAgentId } from './agents'
import { JobFeed } from '@/features/operations/JobFeed'
import { stopJob, useRunningFor } from '@/features/operations/jobs'
import { useIa } from '@/features/ia/porTarefa'
import { PHASE_LABEL, engineInfo, useCopyAgent } from './agentStore'
import { formatById, isResearch } from './knowledge'
import { runCopyAgent, useCopyChat } from './runner'
import { COPY_SKILLS } from './skills'
import { useCopy } from './store'
import { toast } from 'sonner'

/**
 * O painel do agente: escolhe o papel (redator, editor, pesquisador,
 * estrategista), o motor (Claude Code ou Codex desta máquina) e a skill, e
 * conversa. O agente trabalha no documento à vista: o cursor dele vai de bloco
 * em bloco e o texto é digitado; a conversa fica guardada e ele lembra dela.
 */

// O último pedido do documento que já rodou: reabrir a aba não roda de novo
let lastNonce = 0

const ROLE_KEY = 'copy-agente-papel'

const saved = <T extends string>(key: string, ok: readonly T[]): T | undefined => {
  try {
    const v = localStorage.getItem(key)
    return ok.includes(v as T) ? (v as T) : undefined
  } catch {
    return undefined
  }
}

const Working: React.FC = () => {
  const docId = useCopy((s) => s.doc?.id)
  const working = useCopyAgent((s) => (s.working?.docId === docId ? s.working : undefined))
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!working) return null
  const info = engineInfo(working.engine)
  const order = ['sending', 'start', 'thinking', ...(working.phase === 'reading' ? ['reading'] : []), 'writing', 'applying'] as (keyof typeof PHASE_LABEL)[]
  const at = order.indexOf(working.phase)
  return (
    <div className="space-y-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-gray-700">
      <p className="flex items-center gap-1.5 font-semibold text-gray-900">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: info.color }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: info.color }} /></span>
        {agentById(working.role).name} ({info.name}) trabalhando · {Math.max(0, Math.round((now - working.since) / 1000))} s
      </p>
      <ul className="space-y-0.5">
        {order.map((p, i) => (
          <li key={p} className={cn('flex items-center gap-1.5', i > at && 'text-gray-400')}>
            {i < at ? <Check className="h-3 w-3 text-emerald-600" /> : i === at ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: info.color }} /> : <span className="h-3 w-3" />}
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface Pending {
  message: string
  blockIds: string[]
  nonce: number
}

export const AgentPanel: React.FC<{ pending?: Pending | null }> = ({ pending }) => {
  const doc = useCopy((s) => s.doc)!
  const selection = useCopy((s) => s.selection)
  const available = useAiAvailable()
  const agents = useCreativeLink((s) => s.agents)
  const legacy = useCreativeLink((s) => s.legacy)
  const msgs = useCopyChat((s) => s.byDoc[doc.id]) ?? []
  useEffect(() => useCopyChat.getState().ensure(doc.id), [doc.id])
  useEffect(() => watchSkills(), [])

  const [role, setRole] = useState<CopyAgentId>(() => saved(ROLE_KEY, ['redator', 'editor', 'pesquisador', 'estrategista'] as const) ?? (isResearch(doc.format) ? 'pesquisador' : 'redator'))
  const { ia: engine, pick: pickEngine } = useIa('copy')
  const custom = useSkills((s) => s.custom)
  const skills = useMemo<ChatSkill[]>(() => [...custom.filter((k) => k.source === 'personal'), ...custom.filter((k) => k.source === 'global'), ...COPY_SKILLS], [custom])
  const [skillId, setSkillId] = useState<string | null>(null)
  const skill = skills.find((k) => k.id === skillId)
  const [menu, setMenu] = useState(false)
  const [text, setText] = useState('')
  const job = useRunningFor(doc.id)
  const busy = !!job
  const [web, setWeb] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const agent = agentById(role)
  const starters = agent.starters[doc.format] ?? agent.starters['*'] ?? []

  const pick = (key: string, v: string, set: (x: never) => void) => {
    set(v as never)
    try {
      localStorage.setItem(key, v)
    } catch {
      // vale até recarregar
    }
  }

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, busy])

  const run = async (message: string, blockIds?: string[]) => {
    const clean = message.trim()
    if (!clean || busy || available !== true) return
    const targets = blockIds ?? (selection.length ? selection : undefined)
    const push = useCopyChat.getState().push
    const note = [`${agent.name} (${engineInfo(engine).name})`, skill ? `skill: ${skill.name}` : '', targets?.length ? `sobre ${targets.length} bloco${targets.length > 1 ? 's' : ''}` : 'documento inteiro', web || agent.web ? 'com pesquisa na web' : ''].filter(Boolean).join(' · ')
    push(doc.id, { id: crypto.randomUUID(), role: 'user', text: clean, note })
    setText('')
    try {
      const result = await runCopyAgent({ message: clean, role, engine, blockIds: targets, skill: skill ? { name: skill.name, instructions: skill.instructions } : undefined, web: web || undefined })
      push(doc.id, { id: crypto.randomUUID(), role: 'ai', text: result.reply || (result.applied ? 'Pronto.' : 'Não precisei mudar nada.'), changed: result.applied, skipped: result.skipped, ops: result.applied ? result.summary : undefined })
    } catch (err) {
      const stopped = (err as Error).name === 'AbortError'
      push(doc.id, { id: crypto.randomUUID(), role: 'ai', text: stopped ? 'Parei.' : err instanceof Error ? err.message : 'A IA não respondeu.', error: true })
      if (!stopped) toast.error('O agente não conseguiu terminar.')
    }
  }

  // Pedido que veio do documento (a barra da seleção)
  useEffect(() => {
    if (pending && pending.nonce !== lastNonce) {
      lastNonce = pending.nonce
      void run(pending.message, pending.blockIds)
    }
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastChanged = [...msgs].reverse().find((m) => m.changed)?.id

  if (available === false)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" data-scroll>
        <p className="px-3.5 pt-3 text-xs text-gray-600">Os agentes rodam no Claude Code ou no Codex do seu computador, pelo conector. É a mesma conexão do chat do canvas e dos criativos: se ainda não fez, siga os passos.</p>
        <ConnectorPrompt />
      </div>
    )

  const SkillIcon = skill ? skillIcon(skill) : Wand2

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-2.5">
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Papel do agente">
          {COPY_AGENTS.map((a) => (
            <button key={a.id} type="button" onClick={() => pick(ROLE_KEY, a.id, setRole as never)} disabled={busy} title={a.hint} className={cn('rounded-lg border px-2 py-1.5 text-left', role === a.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}>
              <span className="block text-xs font-semibold text-gray-900">{a.name}</span>
              <span className="block truncate text-[10px] text-gray-500">{a.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Qual IA usar">
          {(['claude', 'codex'] as const).map((id) => {
            const info = engineInfo(id)
            const found = agents.find((a) => a.id === id)
            const ok = !!found?.available
            return (
              <button key={id} type="button" disabled={!ok || busy} onClick={() => pickEngine(id)} title={ok ? `${info.name}${found?.version ? ` ${found.version}` : ''}` : legacy ? 'Seu conector é antigo: baixe o conector.mjs de novo' : `${info.name} não foi encontrado neste computador`} className={cn('flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[11px] font-semibold disabled:opacity-40', engine === id && ok ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                <span className="h-2 w-2 rounded-full" style={{ background: info.color }} />
                {info.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-scroll>
        {msgs.length === 0 && (
          <div className="space-y-3 text-sm text-gray-600">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Sparkles className="h-4 w-4 text-violet-600" /> {agent.name}</p>
            <p>{agent.hint}. Ele lê o briefing, o nicho e o documento inteiro, e escreve aqui com você acompanhando. Escolha blocos pela alça deles para pedir algo só sobre eles.</p>
            <div className="space-y-1.5">
              {(skill?.starters.length ? skill.starters : starters).map((s) => (
                <button key={s} type="button" onClick={() => void run(s)} disabled={busy} className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn('text-sm', m.role === 'user' && 'ml-6')}>
            {m.role === 'user' ? (
              <div className="rounded-xl rounded-br-sm bg-violet-600 px-3 py-2 text-white">
                {m.text}
                {m.note && <span className="mt-1 block text-[10px] uppercase tracking-wide text-violet-200">{m.note}</span>}
              </div>
            ) : (
              <div className={cn('rounded-xl rounded-bl-sm border px-3 py-2', m.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-800')}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {!!m.changed && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>{m.changed} {m.changed === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}</span>
                    {m.id === lastChanged && <button type="button" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline" onClick={() => useCopy.getState().undo()}><Undo2 className="h-3 w-3" /> Desfazer</button>}
                  </div>
                )}
                {!!m.skipped?.length && <p className="mt-1 text-[11px] text-amber-700">{m.skipped.length} mudança(s) ignorada(s): {m.skipped.slice(0, 2).join('; ')}</p>}
              </div>
            )}
          </div>
        ))}
        {busy && job && <JobFeed job={job} lines={6} />}
        {busy && <Working />}
        <div ref={end} />
      </div>

      <div className="space-y-2 border-t p-2.5">
        {selection.length > 0 && (
          <p className="flex items-center justify-between rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] text-violet-900">
            O agente vai trabalhar só em {selection.length} bloco{selection.length > 1 ? 's' : ''} escolhido{selection.length > 1 ? 's' : ''}
            <button type="button" className="font-semibold hover:underline" onClick={() => useCopy.getState().select([])}>Usar o documento todo</button>
          </p>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void run(text)
              }
              e.stopPropagation()
            }}
            rows={2}
            placeholder={`Peça ao ${agent.name.toLowerCase()}… (${formatById(doc.format).label})`}
            className="min-h-[56px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0 bg-white" title="Parar" onClick={() => job && stopJob(job.id)}><Square className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" size="icon" className="h-9 w-9 shrink-0" title="Enviar (Enter)" disabled={!text.trim() || available === null} onClick={() => void run(text)}><Send className="h-4 w-4" /></Button>
          )}
        </div>
        <div className="relative flex items-center gap-1.5">
          {menu && (
            <div className="absolute bottom-full left-0 z-30 mb-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-xl" data-scroll>
              {skills.map((k) => {
                const Icon = skillIcon(k)
                return (
                  <button key={k.id} type="button" onClick={() => { setSkillId(k.id === skillId ? null : k.id); setMenu(false) }} className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50', k.id === skillId && 'bg-violet-50')}>
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-gray-900">{k.name}{k.source !== 'builtin' && <span className="ml-1 font-normal text-gray-400">{k.source === 'personal' ? 'sua' : 'da equipe'}</span>}</span>
                      {k.hint && <span className="block truncate text-[11px] text-gray-500">{k.hint}</span>}
                    </span>
                  </button>
                )
              })}
              <a href="/skills" target="_blank" rel="noreferrer" className="block px-2 py-1.5 text-[11px] text-gray-500 hover:text-gray-800">Gerenciar skills</a>
            </div>
          )}
          <button type="button" onClick={() => setMenu((m) => !m)} className={cn('inline-flex h-7 max-w-[55%] items-center gap-1 rounded-md px-1.5 text-[11px] font-medium', skill ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')} title="Escolher uma skill para este pedido">
            <SkillIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{skill ? skill.name : 'Skills'}</span>
          </button>
          {skill && <button type="button" aria-label={`Tirar a skill ${skill.name}`} onClick={() => setSkillId(null)} className="text-gray-400 hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>}
          <label className={cn('ml-auto inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11px] font-medium', web || agent.web ? 'bg-sky-50 text-sky-800' : 'text-gray-600 hover:bg-gray-100')} title={agent.web ? 'O Pesquisador sempre pesquisa na web' : 'Deixar o agente pesquisar na web neste pedido (um link na mensagem já liga)'}>
            <input type="checkbox" className="sr-only" checked={web || agent.web} disabled={agent.web} onChange={(e) => setWeb(e.target.checked)} />
            <Globe className="h-3.5 w-3.5" /> Web
          </label>
          {msgs.length > 0 && <button type="button" className="text-[11px] text-gray-400 hover:text-gray-700" onClick={() => useCopyChat.getState().clear(doc.id)} title="Começa uma conversa nova: o agente esquece o que foi dito">Nova conversa</button>}
        </div>
      </div>
    </div>
  )
}
