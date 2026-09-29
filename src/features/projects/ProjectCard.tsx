import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { cn } from '@/lib/utils'
import { currentAssetUrl } from './localAssets'
import type { Project, ProjectSummary } from './types'

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

const editedAgo = (timestamp: number) => {
  const seconds = (timestamp - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return `Editado ${relative.format(Math.round(seconds / size), unit)}`
  }
  return 'Editado agora mesmo'
}

const sectionsLabel = ({ sections, pages = 1 }: ProjectSummary) => {
  if (sections === 0 && pages <= 1) return 'Canvas vazio'
  const count = sections === 1 ? '1 seção' : `${sections} seções`
  return pages > 1 ? `${pages} páginas · ${count}` : count
}

// Texto do monograma legível sobre a cor principal da marca
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

const ProjectCover: React.FC<{ name: string; summary: ProjectSummary }> = ({ name, summary }) => {
  const [logoFailed, setLogoFailed] = useState(false)
  const main = summary.colors[0]

  return (
    // Pontilhado do canvas do Space
    <div className="relative flex aspect-[16/9] items-center justify-center border-b border-gray-100 bg-zinc-50 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:16px_16px]">
      {summary.logo && !logoFailed ? (
        <img
          src={currentAssetUrl(summary.logo)}
          alt=""
          className="max-h-12 max-w-[55%] object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold',
            !main && 'bg-gray-200 text-gray-500',
            main && (isDark(main) ? 'text-white' : 'text-gray-900')
          )}
          style={main ? { backgroundColor: main } : undefined}
          aria-hidden
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}

      <div className="absolute bottom-3 left-3 flex items-center">
        {summary.colors.length ? (
          <span className="flex gap-1" aria-label="Cores da marca">
            {summary.colors.map((hex) => (
              <span
                key={hex}
                className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </span>
        ) : (
          <span className="text-[11px] text-gray-400">Sem marca</span>
        )}
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: Project
  onEdit: () => void
  /** Dono: exclui o projeto. */
  onDelete: () => void
  /** Quem entrou por convite: sai do projeto. */
  onLeave: () => void
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onLeave }) => (
  <article
    className={cn(
      'group relative overflow-hidden rounded-xl transition-shadow duration-200',
      ISLAND_SURFACE,
      'hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_2px_4px_-1px_rgb(0_0_0/0.08),0_12px_24px_-6px_rgb(0_0_0/0.14)]'
    )}
  >
    <Link
      to={`/projetos/${project.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative">
        <ProjectCover name={project.name} summary={project.summary} />
        {project.role === 'editor' && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
            <Users className="h-3 w-3" aria-hidden />
            Compartilhado com você
          </span>
        )}
      </div>
      <div className="px-4 py-3 pr-12">
        <h2 className="truncate text-sm font-semibold text-gray-900">{project.name}</h2>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {sectionsLabel(project.summary)} · {editedAgo(project.updatedAt)}
        </p>
      </div>
    </Link>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="absolute bottom-3 right-2 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
          aria-label={`Ações de ${project.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Editar detalhes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {project.role === 'editor' ? (
          <DropdownMenuItem onSelect={onLeave}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sair do projeto
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </article>
)
