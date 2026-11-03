import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRODUCTS, type ProductId } from './modules'

/** O produto da conta, um cartão por produto: decide o menu e os módulos que ela recebe. */
export const ProductPicker: React.FC<{
  value: ProductId
  onChange: (product: ProductId) => void
  disabled?: boolean
  /** A conta da Avence fica no Completo. */
  only?: ProductId[]
}> = ({ value, onChange, disabled, only }) => (
  <div role="radiogroup" aria-label="Produto da conta" className="grid gap-2 sm:grid-cols-3">
    {PRODUCTS.filter((p) => !only || only.includes(p.id)).map((p) => {
      const picked = value === p.id
      return (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={picked}
          disabled={disabled}
          onClick={() => !picked && onChange(p.id)}
          className={cn(
            'relative rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60',
            picked ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
          )}
        >
          <span className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900">
            {p.label}
            {picked && <Check className="h-4 w-4 shrink-0" aria-hidden />}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">{p.hint}</span>
        </button>
      )
    })}
  </div>
)
