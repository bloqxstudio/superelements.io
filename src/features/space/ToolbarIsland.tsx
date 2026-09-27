import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Superfície das ilhas e painéis que flutuam sobre o canvas. A elevação vem da
 * sombra em camadas (o anel de 1px faz o papel da borda), não de uma borda sólida.
 */
export const ISLAND_SURFACE =
  'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08),0_4px_12px_-2px_rgb(0_0_0/0.08)]'

/** Ilha de ferramentas: rounded-xl com p-1, então os botões dentro usam rounded-lg (12 = 8 + 4). */
export const ToolbarIsland: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    role="toolbar"
    className={cn('pointer-events-auto flex items-center gap-0.5 rounded-xl p-1', ISLAND_SURFACE, className)}
    {...props}
  />
)

export const ToolDivider: React.FC = () => <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-gray-200" />

interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  /** Nome do botão; vira o texto ao lado do ícone e o nome acessível quando ele fica só com o ícone. */
  label: string
  /** false: só o ícone (o nome vai para aria-label e para o tooltip). */
  showLabel?: boolean
  /** Botão de ligar/desligar (painel aberto, por exemplo). */
  pressed?: boolean
  tone?: 'default' | 'danger'
  /** Sem o encolher ao clicar. */
  static?: boolean
}

/** Botão das ilhas: h-8, rounded-lg, texto xs. */
export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ icon: Icon, label, showLabel = true, pressed, tone = 'default', static: isStatic, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={showLabel ? undefined : label}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-medium',
        'transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-40',
        !isStatic && 'active:scale-[0.96]',
        showLabel || children ? 'px-2.5' : 'w-8',
        pressed
          ? 'bg-gray-100 text-gray-900'
          : tone === 'danger'
            ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children ?? (showLabel && label)}
    </button>
  )
)
ToolButton.displayName = 'ToolButton'

interface HintProps {
  label: string
  /** Segunda linha do tooltip: o que o botão faz. */
  hint?: string
  side?: 'top' | 'bottom'
  children: React.ReactNode
}

/**
 * Tooltip dos botões das ilhas. O alvo é um span para o tooltip abrir também
 * com o botão desabilitado, que não recebe eventos de mouse.
 */
export const Hint: React.FC<HintProps> = ({ label, hint, side = 'bottom', children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">{children}</span>
    </TooltipTrigger>
    <TooltipContent side={side} className="max-w-60 text-xs">
      <p className="font-medium">{label}</p>
      {hint && <p className="text-muted-foreground">{hint}</p>}
    </TooltipContent>
  </Tooltip>
)
