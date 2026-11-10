import React, { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useChat } from '@/features/space/chat/chatStore'
import { CHAT_AGENTS, CHAT_AGENT_IDS, type ChatAgentId, type ChatAgentModel } from '@/features/space/chat/protocol'
import { cn } from '@/lib/utils'
import { IaSwitch } from './IaSwitch'
import { modelName, modelOptions } from './modelos'
import { IA_TASKS } from './porTarefa'

/**
 * Agente e modelo (2026-11-10, o usuário: "seletor de qual modelo e agente vai executar qual ação… agora não está
 * abrindo a seleção, pode reorganizar a tela toda"). A barra da caixa do chat (400 px na Iara) não cabia o
 * agente, o modelo e as tarefas: o seletor encolhia até sumir e o painel das tarefas era cortado pela borda.
 * Agora a caixa tem um botão só ("Claude Code · Sonnet 5.5") que abre esta janela, por cima de tudo:
 * em cima o agente e o modelo do chat, embaixo quem faz cada tipo de trabalho.
 */

/** Os modelos em grupos de família, na ordem em que vêm. */
const byGroup = (models: ChatAgentModel[]) => {
  const out: [string, ChatAgentModel[]][] = []
  for (const m of models) {
    const last = out[out.length - 1]
    if (last && last[0] === (m.group ?? '')) last[1].push(m)
    else out.push([m.group ?? '', [m]])
  }
  return out
}

const ModelRow: React.FC<{ model: { id: string; name: string; hint?: string }; chosen: boolean; onPick: () => void; disabled?: boolean }> = ({ model, chosen, onPick, disabled }) => (
  <button
    type="button"
    role="radio"
    aria-checked={chosen}
    disabled={disabled}
    onClick={onPick}
    className={cn(
      'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-50',
      chosen ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
    )}
  >
    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', chosen ? 'border-white bg-white text-gray-900' : 'border-gray-300')}>
      {chosen && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
    <span className="min-w-0">
      <span className="block text-[13px] font-semibold leading-tight">{model.name}</span>
      {model.hint && <span className={cn('mt-0.5 block text-[11px] leading-snug', chosen ? 'text-white/70' : 'text-gray-500')}>{model.hint}</span>}
    </span>
  </button>
)

export const AgentModelDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; busy?: boolean }> = ({ open, onOpenChange, busy }) => {
  const { agents, agent, setAgent, models, setModel } = useChat(
    useShallow((s) => ({ agents: s.agents, agent: s.agent, setAgent: s.setAgent, models: s.models, setModel: s.setModel }))
  )
  const listed = agents.find((a) => a.id === agent)?.models
  const options = modelOptions(agent, listed)
  const current = models[agent] ?? ''
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-5">
        <DialogHeader>
          <DialogTitle>Agente e modelo</DialogTitle>
          <DialogDescription>Quem responde neste chat e quem faz cada trabalho que a Iara e as telas disparam. Fica salvo neste navegador.</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="am-chat">
          <h3 id="am-chat" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Este chat
          </h3>
          <div role="radiogroup" aria-label="Agente do chat" className="mt-2 grid grid-cols-2 gap-2">
            {CHAT_AGENT_IDS.map((id) => {
              const status = agents.find((a) => a.id === id)
              const ok = status?.available !== false
              const chosen = id === agent
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={!ok || busy}
                  onClick={() => setAgent(id)}
                  title={ok ? status?.version : status?.reason}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50',
                    chosen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHAT_AGENTS[id].color }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{CHAT_AGENTS[id].name}</span>
                    <span className="block truncate text-[11px] text-gray-500">{ok ? modelName(id, models[id], agents.find((a) => a.id === id)?.models) : 'Não encontrado neste computador'}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div role="radiogroup" aria-label={`Modelo do ${CHAT_AGENTS[agent].name}`} className="mt-3 max-h-[min(20rem,40vh)] overflow-y-auto rounded-xl border border-gray-200 p-1.5">
            {agent === 'codex' && <ModelRow model={{ id: '', name: 'Padrão', hint: 'O modelo configurado no Codex deste computador' }} chosen={!current} disabled={busy} onPick={() => setModel(agent, '')} />}
            {!options.length && agent === 'codex' && <p className="px-2.5 py-2 text-[11px] text-gray-500">O Codex não listou outros modelos (atualize o conector ou abra o Codex uma vez).</p>}
            {byGroup(options).map(([group, items]) => (
              <div key={group || 'todos'} className="py-0.5">
                {group && <p className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{group}</p>}
                {items.map((m) => (
                  <ModelRow key={m.id} model={m} chosen={current === m.id} disabled={busy} onPick={() => setModel(agent, m.id)} />
                ))}
              </div>
            ))}
          </div>
          {busy && <p className="mt-1.5 text-[11px] text-amber-700">O agente está trabalhando: a troca vale quando ele terminar.</p>}
        </section>

        <section aria-labelledby="am-tarefas">
          <h3 id="am-tarefas" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Quem faz cada trabalho
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">“Do chat” usa o modelo escolhido acima para aquele agente.</p>
          <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {IA_TASKS.map((t) => (
              <div key={t.id} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{t.label}</p>
                  <p className="text-[11px] leading-snug text-gray-500">{t.hint}</p>
                </div>
                <div className="shrink-0">
                  <IaSwitch task={t.id} label={t.label} compact />
                </div>
              </div>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}

/** O botão da caixa do chat: o agente e o modelo de agora; abre a janela acima. */
export const AgentModelButton: React.FC<{ busy?: boolean; working?: ChatAgentId[] }> = ({ busy, working = [] }) => {
  const [open, setOpen] = useState(false)
  const { agents, agent, models } = useChat(useShallow((s) => ({ agents: s.agents, agent: s.agent, models: s.models })))
  const info = CHAT_AGENTS[agent]
  const name = modelName(agent, models[agent], agents.find((a) => a.id === agent)?.models)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Escolher o agente e o modelo deste chat e de cada trabalho"
        className="inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', working.includes(agent) && 'animate-pulse')} style={{ background: info.color }} />
        <span className="shrink-0 font-semibold text-gray-900">{info.name}</span>
        <span className="truncate text-gray-500">· {name}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
      </button>
      <AgentModelDialog open={open} onOpenChange={setOpen} busy={busy} />
    </>
  )
}
