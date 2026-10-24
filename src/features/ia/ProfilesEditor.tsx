import React, { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AREAS } from '@/features/operations/jobs'
import { cn } from '@/lib/utils'
import { isEdited, personaOf, useProfileList, useProfiles, type AgentProfile } from './perfis'

const field = 'w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900'

const Editor: React.FC<{ p: AgentProfile }> = ({ p }) => {
  const save = useProfiles((s) => s.save)
  const reset = useProfiles((s) => s.reset)
  const edited = useProfiles((s) => isEdited(p.id, s.overrides))
  const [preview, setPreview] = useState(false)
  const set = (patch: Partial<AgentProfile>) => save(p.id, patch)
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {p.name} <span className="font-normal text-gray-500">· {AREAS[p.area].label}</span>
          </h3>
          <p className="text-xs text-gray-500">Vale em: {p.scope}</p>
        </div>
        {edited && (
          <Button type="button" variant="ghost" size="sm" onClick={() => reset(p.id)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Voltar ao padrão
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          Nome
          <input className={cn(field, 'mt-1')} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Cargo
          <input className={cn(field, 'mt-1')} value={p.role} onChange={(e) => set({ role: e.target.value })} />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        O que faz
        <textarea className={cn(field, 'mt-1 resize-y')} rows={2} value={p.goal} onChange={(e) => set({ goal: e.target.value })} />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Como faz (método, tom, prioridades)
        <textarea className={cn(field, 'mt-1 resize-y')} rows={4} value={p.instructions} onChange={(e) => set({ instructions: e.target.value })} />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Regras que valem sempre (uma por linha)
        <textarea className={cn(field, 'mt-1 resize-y')} rows={4} value={p.rules} onChange={(e) => set({ rules: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={p.web} onChange={(e) => set({ web: e.target.checked })} />
        Pode abrir páginas e pesquisar na web nas rotinas
      </label>
      <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs font-medium text-violet-700 underline">
        {preview ? 'Esconder' : 'Ver'} o texto que o agente recebe
      </button>
      {preview && <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">{personaOf(p)}</pre>}
    </div>
  )
}

/** Edita o perfil de cada agente: o que faz e como faz. Vale em todo trabalho dele daqui em diante. */
export const ProfilesEditor: React.FC = () => {
  const list = useProfileList()
  const areas = [...new Set(list.map((p) => p.area))]
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-gray-500">
        O que está escrito aqui vai junto de todo pedido do agente (nos criativos, na Copy, nas rotinas e no ▶ do funil). Fica guardado neste navegador. O cargo de fábrica não muda: é por ele que o escritório sabe quem está trabalhando.
      </p>
      {areas.map((a) => (
        <section key={a} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{AREAS[a].label}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.filter((p) => p.area === a).map((p) => (
              <Editor key={p.id} p={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
