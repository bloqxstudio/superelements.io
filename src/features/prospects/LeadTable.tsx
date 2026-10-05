import React, { useState } from 'react'
import { ChevronDown, ExternalLink, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGE_LABEL, type Stage } from './funnel'
import { adLibraryLinks, advertises } from './score'
import type { Lead } from './types'
import { PlatformBadge, ScorePill, SURFACE } from './ui'

const href = (url: string) => (/^https?:/i.test(url) ? url : `https://${url}`)
const digits = (phone: string) => phone.replace(/\D/g, '')

const ContactLine: React.FC<{ icon: React.ElementType; label: string; to?: string }> = ({ icon: Icon, label, to }) => (
  <li className="flex min-w-0 items-center gap-1.5">
    <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
    {to ? (
      <a href={to} target={to.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="truncate text-gray-700 underline-offset-2 hover:text-gray-900 hover:underline">
        {label}
      </a>
    ) : (
      <span className="truncate text-gray-700">{label}</span>
    )}
  </li>
)

/** Selo de quem tem rastro de anúncio pago no site. */
export const AdsBadge: React.FC = () => (
  <span className="inline-flex items-center whitespace-nowrap rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-inset ring-sky-600/20" title="O site tem a tag do Google Ads ou um pixel de anúncio">
    Anuncia
  </span>
)

/** Onde conferir se há anúncio no ar agora: a pessoa abre e olha, nada é lido daqui. */
export const AdLinks: React.FC<{ lead: Lead }> = ({ lead }) => {
  const links = adLibraryLinks(lead)
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span className="text-gray-500">Anúncios no ar:</span>
      {links.google && (
        <a href={links.google} target="_blank" rel="noreferrer" className="text-gray-700 underline underline-offset-2 hover:text-gray-900">
          Google
        </a>
      )}
      <a href={links.meta} target="_blank" rel="noreferrer" className="text-gray-700 underline underline-offset-2 hover:text-gray-900">
        Instagram e Facebook
      </a>
    </p>
  )
}

export const Contacts: React.FC<{ lead: Lead; all?: boolean }> =({ lead, all }) => {
  const scan = lead.scan
  const phone = lead.phone || scan?.phones[0]
  const emails = [...new Set([lead.email, ...(scan?.emails ?? [])].filter(Boolean) as string[])]
  const lines = [
    scan?.whatsapp && <ContactLine key="wa" icon={MessageCircle} label={scan.whatsapp} to={`https://wa.me/55${digits(scan.whatsapp)}`} />,
    phone && phone !== scan?.whatsapp && <ContactLine key="tel" icon={Phone} label={phone} to={`tel:+55${digits(phone)}`} />,
    ...(all ? emails : emails.slice(0, 1)).map((email) => <ContactLine key={email} icon={Mail} label={email} to={`mailto:${email}`} />),
    scan?.instagram && <ContactLine key="ig" icon={Instagram} label={scan.instagram} to={`https://www.instagram.com/${scan.instagram.slice(1)}`} />,
  ].filter(Boolean)
  if (!lines.length) return <span className="text-xs text-gray-400">Sem contato no site</span>
  return <ul className="space-y-1 text-xs">{lines}</ul>
}

const Details: React.FC<{ lead: Lead }> = ({ lead }) => {
  const scan = lead.scan
  const facts: [string, React.ReactNode][] = [
    ['Endereço', lead.address],
    ['Categoria', lead.category],
    ['Nota no Google', lead.rating ? `${String(lead.rating).replace('.', ',')} (${lead.reviews ?? 0} avaliações)` : undefined],
    ['Título do site', scan?.title],
    ['Tema', scan?.theme],
    ['Construtor', scan?.builder],
    ['WordPress', scan?.wpVersion],
    ['Elementor', scan?.elementorVersion ? `${scan.elementorVersion}${scan.elementorPro ? ' (com Pro)' : ''}` : undefined],
    [
      'Feito por',
      scan?.agency &&
        (scan.agency.url ? (
          <a href={scan.agency.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-gray-900">
            {scan.agency.name}
          </a>
        ) : (
          scan.agency.name
        )),
    ],
    ['Anúncios', scan?.ads?.length ? scan.ads.join(', ') : undefined],
    ['Vende pelo site', scan?.sales?.length ? scan.sales.join(', ') : undefined],
    ['Resposta do site', scan?.status ? `${scan.status} em ${(scan.ms / 1000).toFixed(1).replace('.', ',')} s` : scan?.error],
    ['Facebook', scan?.facebook && <a href={scan.facebook} target="_blank" rel="noreferrer" className="underline underline-offset-2">{scan.facebook.replace(/^https:\/\/www\./, '')}</a>],
    ['LinkedIn', scan?.linkedin && <a href={scan.linkedin} target="_blank" rel="noreferrer" className="underline underline-offset-2">{scan.linkedin.replace(/^https:\/\/www\./, '')}</a>],
  ]
  return (
    <div className="grid gap-6 bg-gray-50/70 px-4 py-4 md:grid-cols-[1fr_1fr_1.2fr]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs md:col-span-2 md:grid-cols-[auto_1fr_auto_1fr]">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="min-w-0 break-words text-gray-800">{value}</dd>
            </React.Fragment>
          ))}
      </dl>
      <div>
        <p className="text-xs font-medium text-gray-900">Todos os contatos</p>
        <div className="mt-1.5">
          <Contacts lead={lead} all />
        </div>
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Ver no mapa
          </a>
        )}
        <AdLinks lead={lead} />
      </div>
    </div>
  )
}

interface Selection {
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (ids: string[], on: boolean) => void
  /** Etapa no funil de quem já está nele. */
  stages: Map<string, Stage>
}

const Row: React.FC<{ lead: Lead; selection?: Selection }> = ({ lead, selection }) => {
  const [open, setOpen] = useState(false)
  const scan = lead.scan
  const versions = [scan?.wpVersion && `WP ${scan.wpVersion}`, scan?.elementorVersion && `Elementor ${scan.elementorVersion}`].filter(Boolean).join(' · ')
  const stage = selection?.stages.get(lead.id)
  const checked = selection?.selected.has(lead.id) ?? false
  return (
    <>
      <tr className={cn('border-t border-gray-100 align-top', (open || checked) && 'bg-gray-50/70')}>
        {selection && (
          <td className="py-3.5 pl-4 pr-0">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gray-900"
              checked={checked}
              onChange={() => selection.onToggle(lead.id)}
              aria-label={`Marcar ${lead.name}`}
            />
          </td>
        )}
        <td className="py-3 pl-4 pr-2">
          <ScorePill score={lead.score} temperature={lead.temperature} />
        </td>
        <td className="max-w-64 px-3 py-3">
          <p className="font-medium text-gray-900">{lead.name}</p>
          {stage && (
            <span className="mt-1 inline-flex rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20">
              Funil · {STAGE_LABEL[stage]}
            </span>
          )}
          <p className="mt-0.5 text-xs text-gray-500">
            {[lead.niche, lead.neighborhood || lead.city].filter(Boolean).join(' · ')}
            {lead.units ? ` · ${lead.units} unidades` : ''}
          </p>
        </td>
        <td className="max-w-60 px-3 py-3">
          <div className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap gap-1">
              <PlatformBadge platform={scan?.platform ?? 'sem-site'} />
              {advertises(lead) && <AdsBadge />}
            </div>
            {scan?.url && scan.platform !== 'sem-site' && (
              <a href={href(scan.url)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-xs text-gray-700 underline-offset-2 hover:text-gray-900 hover:underline">
                <span className="truncate">{lead.domain}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            )}
            {(versions || (scan?.builder && scan.platform !== 'wp-elementor')) && (
              <p className="text-[11px] text-gray-500">{versions || scan?.builder}</p>
            )}
          </div>
        </td>
        <td className="w-56 max-w-56 px-3 py-3">
          <Contacts lead={lead} />
        </td>
        <td className="min-w-64 px-3 py-3">
          <ul className="space-y-0.5 text-xs text-gray-600">
            {lead.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {lead.reasons.length > 3 && <li className="text-gray-400">+{lead.reasons.length - 3}</li>}
          </ul>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-700">{lead.plan}</td>
        <td className="py-3 pl-1 pr-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Fechar detalhes de ${lead.name}` : `Ver detalhes de ${lead.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', open && 'rotate-180')} />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={selection ? 8 : 7} className="p-0">
            <Details lead={lead} />
          </td>
        </tr>
      )}
    </>
  )
}

export const LeadTable: React.FC<{ leads: Lead[]; selection?: Selection }> = ({ leads, selection }) => {
  const all = leads.length > 0 && leads.every((l) => selection?.selected.has(l.id))
  return (
    <div className={cn(SURFACE, 'overflow-x-auto')}>
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            {selection && (
              <th scope="col" className="py-2.5 pl-4 pr-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-gray-900"
                  checked={all}
                  onChange={() => selection.onToggleAll(leads.map((l) => l.id), !all)}
                  aria-label="Marcar todas as empresas mostradas"
                />
              </th>
            )}
            <th scope="col" className="py-2.5 pl-4 pr-2 font-medium">Nota</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Empresa</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Site</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Contato</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Por quê</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Serviço</th>
            <th scope="col" className="w-10 py-2.5 pr-3"><span className="sr-only">Detalhes</span></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <Row key={lead.id} lead={lead} selection={selection} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
