import React, { useEffect, useState } from 'react'
import { Loader2, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { cn } from '@/lib/utils'
import { profileNow } from './perfis'
import { describeFreq, runRoutine, useRoutines, type Freq, type Routine } from './rotinas'
import { FORMAT_CHOICES, NICHE_CHOICES, STAGE_CHOICES, TASKS, taskById, type ParamDef, type TaskId } from './tarefas'

const field = 'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900'
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const when = (t?: number) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–')

const Param: React.FC<{ def: ParamDef; value: string; sets: SetSummary[]; onChange: (v: string) => void }> = ({ def, value, sets, onChange }) => {
  const v = value ?? def.default ?? ''
  const choices = def.kind === 'stage' ? STAGE_CHOICES : def.kind === 'niche' ? [{ id: '', label: 'Sem nicho' }, ...NICHE_CHOICES] : def.kind === 'format' ? FORMAT_CHOICES : def.kind === 'set' ? sets.map((s) => ({ id: s.id, label: s.name })) : null
  return (
    <label className="block text-xs font-medium text-gray-700">
      {def.label}
      {choices ? (
        <select className={cn(field, 'mt-1')} value={v} onChange={(e) => onChange(e.target.value)}>
          {def.kind === 'set' && !sets.length && <option value="">Nenhum conjunto</option>}
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : def.kind === 'long' ? (
        <textarea className={cn(field, 'mt-1 h-auto resize-y py-2')} rows={2} placeholder={def.placeholder} value={v} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cn(field, 'mt-1')} type={def.kind === 'number' ? 'number' : 'text'} min={1} placeholder={def.placeholder} value={v} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

const NewRoutine: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const add = useRoutines((s) => s.add)
  const [task, setTask] = useState<TaskId>('funil')
  const [name, setName] = useState('')
  const [params, setParams] = useState<Record<string, string>>({})
  const [freq, setFreq] = useState<Freq>('diaria')
  const [every, setEvery] = useState(6)
  const [time, setTime] = useState('08:00')
  const [weekday, setWeekday] = useState(1)
  const [sets, setSets] = useState<SetSummary[]>([])
  const def = taskById(task)
  useEffect(() => void listSets().then(setSets).catch(() => setSets([])), [])
  useEffect(() => setParams({}), [task])

  const create = () => {
    const filled = Object.fromEntries(def.params.map((p) => [p.key, params[p.key] ?? p.default ?? (p.kind === 'set' ? sets[0]?.id ?? '' : '')]))
    add({ name: name.trim() || def.label, task, params: filled, freq, every, time, weekday, enabled: true })
    onDone()
  }
  const needsText = def.params.some((p) => p.kind === 'long')
  const missing = needsText && !def.params.filter((p) => p.kind === 'long').every((p) => (params[p.key] ?? '').trim())

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          O que fazer
          <select className={cn(field, 'mt-1')} value={task} onChange={(e) => setTask(e.target.value as TaskId)}>
            {TASKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({profileNow(t.agent).name})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-700">
          Nome da rotina
          <input className={cn(field, 'mt-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder={def.label} />
        </label>
      </div>
      <p className="text-xs text-gray-500">{def.hint}</p>
      {def.params.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {def.params.map((p) => (
            <div key={p.key} className={p.kind === 'long' ? 'sm:col-span-2' : ''}>
              <Param def={p} value={params[p.key] ?? ''} sets={sets} onChange={(v) => setParams((c) => ({ ...c, [p.key]: v }))} />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-gray-700">
          Quando
          <select className={cn(field, 'mt-1')} value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
            <option value="diaria">Todo dia</option>
            <option value="semanal">Toda semana</option>
            <option value="horas">A cada X horas</option>
          </select>
        </label>
        {freq === 'semanal' && (
          <label className="text-xs font-medium text-gray-700">
            Dia
            <select className={cn(field, 'mt-1')} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
        {freq === 'horas' ? (
          <label className="text-xs font-medium text-gray-700">
            A cada (horas)
            <input className={cn(field, 'mt-1')} type="number" min={1} max={168} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))} />
          </label>
        ) : (
          <label className="text-xs font-medium text-gray-700">
            Horário
            <input className={cn(field, 'mt-1')} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={missing} onClick={create}>
          Criar rotina
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

const Row: React.FC<{ r: Routine }> = ({ r }) => {
  const update = useRoutines((s) => s.update)
  const remove = useRoutines((s) => s.remove)
  const running = useRoutines((s) => s.running)
  const def = taskById(r.task)
  const mine = running === r.id
  return (
    <li className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-500">
            {def.label} · {profileNow(def.agent).name} · {describeFreq(r)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} /> Ligada
          </label>
          <Button type="button" size="sm" variant="outline" disabled={!!running} onClick={() => void runRoutine(r.id, true)}>
            {mine ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} Rodar agora
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Apagar a rotina" onClick={() => window.confirm(`Apagar "${r.name}"?`) && remove(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Próxima: {r.enabled ? when(r.nextRun) : 'desligada'} · Última: {when(r.lastRun)}
        {r.lastStatus === 'erro' && <span className="ml-1 font-semibold text-red-600">com erro</span>}
      </p>
      {r.lastMessage && <p className={cn('whitespace-pre-wrap rounded-md p-2 text-xs', r.lastStatus === 'erro' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700')}>{r.lastMessage}</p>}
    </li>
  )
}

/** Rotinas: tarefas dos agentes que se repetem sozinhas. */
export const RoutinesPanel: React.FC = () => {
  const routines = useRoutines((s) => s.routines)
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-gray-500">
        As rotinas rodam sozinhas neste navegador, enquanto o app está aberto e a IA conectada. Se estiver fechado na hora marcada, a rotina atrasada roda uma vez quando você abrir. Nenhuma rotina envia mensagem nem muda cartão de etapa: elas escrevem notas, documentos e posts para você revisar.
      </p>
      {adding ? (
        <NewRoutine onDone={() => setAdding(false)} />
      ) : (
        <Button type="button" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova rotina
        </Button>
      )}
      {routines.length === 0 && !adding && <p className="text-sm text-gray-500">Nenhuma rotina ainda. Exemplos: rever o funil todo dia às 8h, uma pesquisa por semana, três posts por semana.</p>}
      <ul className="space-y-3">
        {routines.map((r) => (
          <Row key={r.id} r={r} />
        ))}
      </ul>
    </div>
  )
}
