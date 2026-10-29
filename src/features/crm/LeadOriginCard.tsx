import React from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import { CAMPAIGN_STATUS, PRESET_LABEL, type LeadOrigin } from '@/features/crm/leadOrigin'

const money = (value: number, currency = 'BRL') => {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency })
  } catch {
    return `R$ ${value.toFixed(2)}`
  }
}

const dayText = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '')

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-3 py-1.5 text-xs">
    <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
    <dd className="min-w-0 flex-1 break-words text-gray-900">{children}</dd>
  </div>
)

/** "Origem do lead": canal, página, campanha com o gasto e os campos do formulário (aba Empresa do cartão). */
export const LeadOriginCard: React.FC<{ origin: LeadOrigin }> = ({ origin }) => {
  const c = origin.campaign
  const utm = Object.entries(origin.utm ?? {})
  const fields = Object.entries(origin.fields ?? {})
  return (
    <section aria-label="Origem do lead">
      <p className="text-xs font-medium text-gray-700">Origem do lead</p>
      <dl className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200 px-3">
        <Row label="Canal">
          <span className="font-medium">{origin.channel}</span>
          {origin.paid && <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">tráfego pago</span>}
        </Row>
        <Row label="Chegou em">{new Date(origin.receivedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Row>
        {origin.form && <Row label="Formulário">{origin.form}</Row>}
        {origin.page && (
          <Row label="Página">
            <a href={origin.page.startsWith('http') ? origin.page : `https://${origin.page}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
              {origin.page.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </Row>
        )}
        {origin.referrer && <Row label="Veio de">{origin.referrer.replace(/^https?:\/\/(www\.)?/, '')}</Row>}
      </dl>

      {c && (
        <div className="mt-3 rounded-lg border border-gray-200 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> Campanha
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {c.name}
            {c.status && <span className="ml-2 text-xs font-normal text-gray-500">{CAMPAIGN_STATUS[c.status] ?? c.status}</span>}
          </p>
          {(c.adset || c.ad) && (
            <p className="mt-0.5 text-xs text-gray-500">{[c.adset && `Conjunto: ${c.adset}`, c.ad && `Anúncio: ${c.ad}`].filter(Boolean).join(' · ')}</p>
          )}
          {c.from === 'meta' && c.spend !== undefined ? (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ['Valor usado', money(c.spend, c.currency)],
                  ['Resultados', c.result?.value ? String(c.result.value) : c.leads ? String(c.leads) : '—'],
                  ['Custo por resultado', c.result?.cost ? money(c.result.cost, c.currency) : c.leads ? money(c.spend / c.leads, c.currency) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-zinc-50 px-2 py-1.5">
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">
                Números da Meta, {PRESET_LABEL[c.preset ?? ''] ?? c.preset}
                {c.since && c.until ? ` (${dayText(c.since)} a ${dayText(c.until)})` : ''}, lidos na hora em que o lead chegou.
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[11px] text-gray-500">Só o nome veio no link: os números de gasto aparecem quando a campanha está na conta de anúncios conectada (Meta).</p>
          )}
        </div>
      )}

      {utm.length > 0 && (
        <p className="mt-3 break-words text-[11px] leading-relaxed text-gray-500">
          {utm.map(([k, v]) => `utm_${k}=${v}`).join(' · ')}
        </p>
      )}
      {fields.length > 0 && (
        <dl className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 px-3">
          {fields.map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, ' ')}>
              {v}
            </Row>
          ))}
        </dl>
      )}
    </section>
  )
}
