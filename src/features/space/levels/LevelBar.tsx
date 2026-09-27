import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSpaceStore } from '@/store/spaceStore'
import { LEVELS } from './levels'

interface LevelBarProps {
  /**
   * 'inline': só a fileira de botões, para ficar dentro de uma ilha da barra do
   * Space. 'floating': ilha própria no rodapé do canvas.
   */
  variant?: 'inline' | 'floating'
  /** Só ícones (o nível ativo mantém o nome); o nome e a dica vão para o tooltip. */
  compact?: boolean
}

/** Troca a camada em edição: Estrutura, Movimento, Cores, Tipografia, Forma, Fotos. */
export const LevelBar: React.FC<LevelBarProps> = ({ variant = 'floating', compact = false }) => {
  const editLevel = useSpaceStore((s) => s.editLevel)
  const setEditLevel = useSpaceStore((s) => s.setEditLevel)

  const row = (
    // Dentro da barra do Space (que já é toolbar) a fileira é só um grupo
    <div className="flex items-center gap-0.5" role={variant === 'inline' ? 'group' : 'toolbar'} aria-label="Nível de edição">
      {LEVELS.map((level) => {
        const active = level.id === editLevel
        const Icon = level.icon
        const showLabel = !compact || active
        return (
          <Tooltip key={level.id}>
            <TooltipTrigger asChild>
              {/* span: o tooltip precisa de um alvo que receba o mouse mesmo com o botão desabilitado */}
              <span className="inline-flex">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={showLabel ? undefined : level.label}
                  disabled={level.soon}
                  onClick={() => setEditLevel(level.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[color,background-color,transform] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 ${
                    active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {showLabel && level.label}
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent side={variant === 'floating' ? 'top' : 'bottom'} className="max-w-60 text-xs">
              <p className="font-medium">{level.label}</p>
              <p className="text-muted-foreground">{level.hint}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )

  if (variant === 'inline') return row
  return (
    <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 select-none rounded-xl border border-gray-200 bg-white p-1 shadow-md">
      {row}
    </div>
  )
}
