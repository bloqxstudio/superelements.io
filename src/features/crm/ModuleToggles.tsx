import React from 'react'
import { Switch } from '@/components/ui/switch'
import { MODULES, type ModuleId } from './modules'

/** Os módulos do produto com um interruptor cada, em dois grupos (Produção e CRM). */
export const ModuleToggles: React.FC<{
  value: Record<string, boolean>
  onChange: (id: ModuleId, on: boolean) => void
  disabled?: boolean
  /** Id do módulo que está salvando agora (o interruptor espera). */
  busyId?: ModuleId | null
}> = ({ value, onChange, disabled, busyId }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {(['Produção', 'CRM'] as const).map((group) => (
      <div key={group}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {MODULES.filter((m) => m.group === group).map((m) => {
            const on = value[m.id] !== false
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{m.label}</span>
                  <span className="block text-xs text-gray-500">{m.hint}</span>
                </span>
                <Switch checked={on} disabled={disabled || busyId === m.id} onCheckedChange={(next) => onChange(m.id, next)} aria-label={`${m.label}: ${on ? 'ligado' : 'desligado'}`} />
              </li>
            )
          })}
        </ul>
      </div>
    ))}
  </div>
)
