import React from 'react'
import { Building2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgencyLead } from './score'
import { PlatformBadge, SURFACE } from './ui'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Quem assina os sites no rodapé: agências da região, público do plano Agência. */
export const AgencyList: React.FC<{ agencies: AgencyLead[] }> = ({ agencies }) => {
  if (!agencies.length) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
        <Building2 className="h-5 w-5 text-gray-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-900">Nenhum site desta busca assina a agência no rodapé</p>
        <p className="mt-1 max-w-md text-sm text-gray-500">Quando um site traz "Desenvolvido por …", a agência aparece aqui com os clientes dela.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {agencies.map((agency) => (
        <article key={agency.name + agency.url} className={cn(SURFACE, 'p-4')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900">{agency.name}</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {plural(agency.sites.length, 'site nesta busca', 'sites nesta busca')}
                {agency.elementor > 0 && ` · ${agency.elementor} com Elementor`}
              </p>
            </div>
            {agency.url && (
              <a href={agency.url} target="_blank" rel="noreferrer" aria-label={`Abrir o site da ${agency.name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
            {agency.sites.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-700">{lead.name}</span>
                <PlatformBadge platform={lead.scan?.platform ?? 'sem-site'} className="shrink-0" />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
