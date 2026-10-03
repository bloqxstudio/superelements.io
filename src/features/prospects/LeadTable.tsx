import React, { useState } from 'react'
import { ChevronDown, ExternalLink, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
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

const Contacts: React.FC<{ lead: Lead; all?: boolean }> = ({ lead, all }) => {
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
      </div>
    </div>
  )
}

const Row: React.FC<{ lead: Lead }> = ({ lead }) => {
  const [open, setOpen] = useState(false)
  const scan = lead.scan
  const versions = [scan?.wpVersion && `WP ${scan.wpVersion}`, scan?.elementorVersion && `Elementor ${scan.elementorVersion}`].filter(Boolean).join(' · ')
  return (
    <>
      <tr className={cn('border-t border-gray-100 align-top', open && 'bg-gray-50/70')}>
        <td className="py-3 pl-4 pr-2">
          <ScorePill score={lead.score} temperature={lead.temperature} />
        </td>
        <td className="max-w-64 px-3 py-3">
          <p className="font-medium text-gray-900">{lead.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[lead.niche, lead.neighborhood || lead.city].filter(Boolean).join(' · ')}
            {lead.units ? ` · ${lead.units} unidades` : ''}
          </p>
        </td>
        <td className="max-w-60 px-3 py-3">
          <div className="flex flex-col items-start gap-1">
            <PlatformBadge platform={scan?.platform ?? 'sem-site'} />
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
          <td colSpan={7} className="p-0">
            <Details lead={lead} />
          </td>
        </tr>
      )}
    </>
  )
}

export const LeadTable: React.FC<{ leads: Lead[] }> = ({ leads }) => (
  <div className={cn(SURFACE, 'overflow-x-auto')}>
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead>
        <tr className="text-xs text-gray-500">
          <th scope="col" className="py-2.5 pl-4 pr-2 font-medium">Nota</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Empresa</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Site</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Contato</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Por quê</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Plano</th>
          <th scope="col" className="w-10 py-2.5 pr-3"><span className="sr-only">Detalhes</span></th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <Row key={lead.id} lead={lead} />
        ))}
      </tbody>
    </table>
  </div>
)
