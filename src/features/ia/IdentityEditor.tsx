import React, { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { identityText, useIdentity, type Identity } from './identidade'

const field = 'w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900'

const FIELDS: { key: keyof Identity; label: string; rows: number; hint?: string }[] = [
  { key: 'about', label: 'Quem somos e o que vendemos', rows: 4 },
  { key: 'audience', label: 'Para quem vendemos', rows: 4 },
  { key: 'voice', label: 'Como falamos', rows: 3 },
  { key: 'always', label: 'Sempre (uma por linha)', rows: 4 },
  { key: 'never', label: 'Nunca (uma por linha)', rows: 4 },
  { key: 'visual', label: 'A cara da marca (cores, fontes, logo)', rows: 3 },
]

/** A identidade do estúdio, compartilhada por todos os agentes. */
export const IdentityEditor: React.FC = () => {
  const { identity, save, reset } = useIdentity()
  const [preview, setPreview] = useState(false)
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-500">
        Um documento só, que todos os agentes recebem antes do próprio perfil: criativos, Copy, sites, comercial e rotinas. Mudou aqui, mudou para todos, daqui em diante. Fica guardado neste navegador. Os criativos continuam usando também a marca de cada conjunto.
      </p>
      <label className="block text-xs font-medium text-gray-700">
        Nome do estúdio
        <input className={cn(field, 'mt-1')} value={identity.name} onChange={(e) => save({ name: e.target.value })} />
      </label>
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-xs font-medium text-gray-700">
          {f.label}
          <textarea className={cn(field, 'mt-1 resize-y')} rows={f.rows} value={identity[f.key]} onChange={(e) => save({ [f.key]: e.target.value })} />
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs font-medium text-violet-700 underline">
          {preview ? 'Esconder' : 'Ver'} o texto que os agentes recebem
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={() => window.confirm('Voltar a identidade ao texto de fábrica?') && reset()}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Voltar ao padrão
        </Button>
      </div>
      {preview && <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">{identityText(identity)}</pre>}
    </div>
  )
}
