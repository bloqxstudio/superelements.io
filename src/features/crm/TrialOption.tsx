import React from 'react'
import { FlaskConical } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { STRATEGY_HINT, STRATEGY_LABEL, type TrialStrategy } from './trialReels'

/**
 * "Publicar como teste" (trial reel) nas telas que publicam reels: o vídeo vai só para quem não segue
 * e entra em CRM › Instagram › Testes, onde o motor diz se vale levar aos seguidores.
 * `value` null = reels normal.
 */
export const TrialOption: React.FC<{ value: TrialStrategy | null; onChange: (value: TrialStrategy | null) => void; disabled?: boolean; className?: string }> = ({ value, onChange, disabled, className }) => (
  <div className={cn('rounded-lg border border-gray-200 p-3', value && 'border-violet-300 bg-violet-50/50', className)}>
    <label className="flex items-center justify-between gap-3 text-sm text-gray-800">
      <span className="flex items-center gap-2 font-medium">
        <FlaskConical className="h-4 w-4 text-violet-600" aria-hidden /> Publicar como teste
      </span>
      <Switch checked={!!value} onCheckedChange={(on) => onChange(on ? 'MANUAL' : null)} disabled={disabled} />
    </label>
    <p className="mt-1 text-xs text-gray-500">Só quem não segue a conta vê. Os seguidores não recebem até o vídeo provar que funciona.</p>
    {value && (
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Quem leva aos seguidores">
        {(Object.keys(STRATEGY_LABEL) as TrialStrategy[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn('rounded-md border px-3 py-2 text-left transition-colors', value === s ? 'border-violet-500 bg-white ring-1 ring-violet-500' : 'border-gray-200 bg-white hover:bg-gray-50')}
          >
            <span className="block text-sm font-medium text-gray-900">{STRATEGY_LABEL[s]}</span>
            <span className="mt-0.5 block text-xs leading-snug text-gray-500">{STRATEGY_HINT[s]}</span>
          </button>
        ))}
      </div>
    )}
  </div>
)
