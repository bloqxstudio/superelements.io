import React from 'react'
import { IaSwitch } from '@/features/ia/IaSwitch'
import { IA_TASKS, type IaTask } from '@/features/ia/porTarefa'

const Row: React.FC<{ task: IaTask; label: string; hint: string }> = ({ task, label, hint }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 py-2">
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
    <IaSwitch task={task} label={label} />
  </div>
)

/** Qual IA faz cada tipo de trabalho: vale para tudo o que roda daqui em diante, inclusive em segundo plano. */
export const IaPorTarefa: React.FC = () => (
  <section className="rounded-xl border border-gray-200 bg-white p-4">
    <h2 className="text-sm font-semibold text-gray-900">IA de cada trabalho</h2>
    <p className="text-xs text-gray-500">Escolha qual IA faz cada tipo de tarefa. As imagens geradas seguem a configuração do editor de criativos.</p>
    <div className="mt-1 divide-y divide-gray-100">
      {IA_TASKS.map((t) => (
        <Row key={t.id} task={t.id} label={t.label} hint={t.hint} />
      ))}
    </div>
  </section>
)
