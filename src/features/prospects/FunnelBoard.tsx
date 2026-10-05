import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Copy, ExternalLink, MapPin, MessageCircle, RotateCcw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useProjectList, useProjectStore } from '@/features/projects/projectStore'
import { cn } from '@/lib/utils'
import { getFunnelSettings, removeOpportunity, saveFunnelSettings, updateOpportunity } from './api'
import {
  BRIEF_FIELDS,
  DEFAULT_SETTINGS,
  money,
  nextStage,
  OPEN_STAGES,
  STAGE_LABEL,
  STAGES,
  valueOf,
  type FunnelSettings,
  type Offer,
  type Opportunity,
  type OpportunityPatch,
  type Stage,
} from './funnel'
import { AdLinks, AdsBadge, Contacts } from './LeadTable'
import { advertises } from './score'
import { draftOffer } from './offer'
import { PlatformBadge, ScorePill, SURFACE } from './ui'

const FIELD = 'w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const digits = (phone: string) => phone.replace(/\D/g, '')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Tipo do arraste: só cartão do funil cai numa coluna (texto ou arquivo arrastado não). */
const DRAG_TYPE = 'application/x-superelements-oportunidade'

type SetItems = React.Dispatch<React.SetStateAction<Opportunity[]>>

/** Projeto do Space pelo nome (o funil guarda o nome; o link precisa do id). */
const useProjectIds = () => {
  useProjectList()
  const projects = useProjectStore((s) => s.projects)
  return useMemo(() => new Map(projects.map((p) => [p.name.trim().toLowerCase(), p.id])), [projects])
}

/** "são leopoldo" → "São Leopoldo" (a região vem como a pessoa digitou na busca). */
const placeCase = (text: string) =>
  text.replace(/\p{L}+/gu, (word, at: number) => (at > 0 && /^(de|da|do|das|dos|e)$/i.test(word) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))

/** Cidade e UF da empresa: a cidade que o mapa deu, com a UF da busca. */
const cityOf = (o: Opportunity) => {
  const [regionCity = '', uf = ''] = o.region.split(',').map((part) => part.trim())
  const city = o.lead.city || placeCase(regionCity)
  return [city, uf.toUpperCase()].filter(Boolean).join(', ')
}

const whatsappOf = (o: Opportunity) => o.lead.scan?.whatsapp ?? (o.lead.phone && digits(o.lead.phone).length === 11 ? o.lead.phone : undefined)

// ---------------------------------------------------------------- cartão

const Card: React.FC<{
  item: Opportunity
  value: number
  active: boolean
  dragging: boolean
  onOpen: () => void
  onAdvance: (stage: Stage) => void
  onDrag: (id: string | null) => void
}> = ({ item, value, active, dragging, onOpen, onAdvance, onDrag }) => {
  const lead = item.lead
  const next = nextStage(item.stage)
  const wa = whatsappOf(item)
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, item.id)
        e.dataTransfer.setData('text/plain', lead.name)
        e.dataTransfer.effectAllowed = 'move'
        onDrag(item.id)
      }}
      onDragEnd={() => onDrag(null)}
      // Clique em qualquer parte abre o painel; o link do WhatsApp e o botão de avançar fazem só o deles
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a, button')) onOpen()
      }}
      className={cn(
        'cursor-grab rounded-lg bg-white p-3 ring-1 transition-[box-shadow,opacity] active:cursor-grabbing',
        active ? 'ring-2 ring-gray-900' : 'ring-gray-200 hover:ring-gray-300',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
          {/* O nome é o botão para quem navega pelo teclado */}
          <button type="button" onClick={onOpen} className="text-left focus-visible:underline focus-visible:outline-none">
            {lead.name}
          </button>
        </h3>
        <span className="shrink-0 rounded bg-gray-100 px-1.5 text-xs font-semibold tabular-nums text-gray-700">{lead.score}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-gray-500">{lead.niche}</p>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-700" title={lead.address ?? cityOf(item)}>
        <MapPin className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
        <span className="truncate">{[lead.neighborhood, cityOf(item)].filter(Boolean).join(' · ')}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PlatformBadge platform={lead.scan?.platform ?? 'sem-site'} />
        {advertises(lead) && <AdsBadge />}
        {item.projectName && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20">Space</span>}
        {value > 0 && <span className="ml-auto text-xs font-semibold tabular-nums text-gray-900">{money(value)}</span>}
      </div>
      {item.nextStep && (
        <p className="mt-2 line-clamp-2 text-xs text-gray-700">
          <span className="text-gray-400">Próximo: </span>
          {item.nextStep}
          {item.nextDate && <span className="text-gray-500"> · {new Date(`${item.nextDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
        {wa ? (
          <a href={`https://wa.me/55${digits(wa)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900" aria-label={`WhatsApp de ${lead.name}`}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
          </a>
        ) : (
          <span className="text-xs text-gray-400">Sem WhatsApp</span>
        )}
        {next && (
          <button type="button" onClick={() => onAdvance(next)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900">
            {STAGE_LABEL[next]} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------- campos do painel

/** Campo que grava sozinho quando a pessoa sai dele. */
const Field: React.FC<{
  label: string
  value?: string
  placeholder?: string
  type?: 'text' | 'date' | 'area' | 'money'
  rows?: number
  onSave: (value: string) => void
}> = ({ label, value, placeholder, type = 'text', rows = 4, onSave }) => {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const save = () => {
    if (draft.trim() !== (value ?? '')) onSave(draft)
  }
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      {type === 'area' ? (
        <textarea className={cn(FIELD, 'mt-1 py-2 leading-relaxed')} rows={rows} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      ) : type === 'money' ? (
        <span className="relative mt-1 block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
          <input type="number" min={0} step={10} inputMode="decimal" className={cn(FIELD, 'h-9 pl-9 tabular-nums')} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
        </span>
      ) : (
        <input type={type} className={cn(FIELD, 'mt-1 h-9')} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      )}
    </label>
  )
}

const amount = (text: string) => {
  const n = Number(text.replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? undefined : n
}

/** O serviço e por quanto; o valor soma o serviço e o plano mensal dos primeiros meses. */
const OfferSection: React.FC<{ item: Opportunity; settings: FunnelSettings; onPatch: (patch: OpportunityPatch) => void }> = ({ item, settings, onPatch }) => {
  const offer: Offer = item.offer ?? draftOffer(item.lead).offer
  const change = (patch: Partial<Offer>) => onPatch({ offer: { ...offer, ...patch } })
  const value = valueOf({ offer }, settings)
  return (
    <section className="space-y-3">
      <Field label="Serviço que vamos vender" type="area" rows={3} value={offer.service} onSave={(v) => change({ service: v.trim() })} />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Valor do serviço (uma vez)"
          type="money"
          value={offer.price === undefined ? '' : String(offer.price)}
          placeholder={`${settings.price} (padrão)`}
          onSave={(v) => change({ price: amount(v) })}
        />
        <Field
          label="Plano mensal (opcional)"
          type="money"
          value={offer.monthly === undefined ? '' : String(offer.monthly)}
          placeholder={settings.monthly ? `${settings.monthly} (padrão)` : 'sem plano'}
          onSave={(v) => change({ monthly: amount(v) })}
        />
      </div>
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
        <span className="font-semibold tabular-nums text-gray-900">{money(value.total)}</span>
        {value.monthly > 0 ? (
          <>
            {' '}
            em {settings.months} meses: {money(value.price)} do serviço + {money(value.monthly)}/mês
          </>
        ) : (
          ' do serviço, sem plano mensal'
        )}
      </p>
    </section>
  )
}

/** O roteiro de venda: começa no padrão (offer.ts) e quem vende ajusta. */
const BriefSection: React.FC<{ item: Opportunity; onPatch: (patch: OpportunityPatch) => void }> = ({ item, onPatch }) => {
  const [confirm, setConfirm] = useState(false)
  const brief = item.brief ?? draftOffer(item.lead).brief
  const copy = async () => {
    const text = BRIEF_FIELDS.map((f) => `${f.label}\n${brief[f.key]}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(`${item.lead.name}\n\n${text}`)
      toast.success('Roteiro copiado')
    } catch {
      toast.error('Não deu para copiar', { description: 'O navegador bloqueou a área de transferência.' })
    }
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copiar roteiro
        </Button>
        {confirm ? (
          <span className="flex items-center gap-2 text-xs text-gray-600">
            Trocar pelo roteiro padrão?
            <button type="button" className="font-medium text-gray-900 underline" onClick={() => (setConfirm(false), onPatch({ brief: draftOffer(item.lead).brief }))}>
              Trocar
            </button>
            <button type="button" className="text-gray-500" onClick={() => setConfirm(false)}>
              Manter
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Refazer com o padrão
          </button>
        )}
      </div>
      {BRIEF_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} type="area" rows={f.key === 'what' ? 4 : 6} value={brief[f.key]} onSave={(v) => onPatch({ brief: { ...brief, [f.key]: v.trim() } })} />
      ))}
    </section>
  )
}

// ---------------------------------------------------------------- painel

const Panel: React.FC<{
  item: Opportunity
  settings: FunnelSettings
  projectId?: string
  onClose: () => void
  onPatch: (patch: OpportunityPatch) => void
  onRemove: () => void
}> = ({ item, settings, projectId, onClose, onPatch, onRemove }) => {
  const [tab, setTab] = useState<'venda' | 'empresa'>('venda')
  const [confirm, setConfirm] = useState(false)
  const lead = item.lead
  const scan = lead.scan
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.18)] md:top-[57px]" aria-label={`Oportunidade: ${lead.name}`}>
      <header className="border-b border-gray-100 px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{lead.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{[lead.niche, lead.address ?? item.region].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <select aria-label="Etapa" className={cn(FIELD, 'h-9 w-auto')} value={item.stage} onChange={(e) => onPatch({ stage: e.target.value as Stage })}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-sm font-semibold tabular-nums text-gray-900">{money(valueOf(item, settings).total)}</span>
        </div>
        <div className="mt-3 flex gap-1" role="tablist">
          {(
            [
              ['venda', 'Oferta e roteiro'],
              ['empresa', 'Empresa e acompanhamento'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('-mb-px border-b-2 px-2 py-2 text-sm font-medium', tab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900')}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {tab === 'venda' ? (
          <>
            <OfferSection item={item} settings={settings} onPatch={onPatch} />
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Roteiro de venda</h3>
              <BriefSection item={item} onPatch={onPatch} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <ScorePill score={lead.score} temperature={lead.temperature} />
              <div className="min-w-0 space-y-1">
                <PlatformBadge platform={scan?.platform ?? 'sem-site'} />
                {scan?.url && scan.platform !== 'sem-site' && (
                  <a href={scan.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-gray-700 underline-offset-2 hover:underline">
                    {lead.domain} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                )}
              </div>
            </div>

            <section>
              <p className="text-xs font-medium text-gray-700">Contato</p>
              <div className="mt-1.5">
                <Contacts lead={lead} all />
              </div>
              {lead.mapsUrl && (
                <a href={lead.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 underline-offset-2 hover:underline">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Ver no mapa
                </a>
              )}
              <AdLinks lead={lead} />
            </section>

            <section>
              <p className="text-xs font-medium text-gray-700">Por que é oportunidade</p>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {lead.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>

            <div className="space-y-1.5">
              <Field label="Projeto no Space" value={item.projectName} placeholder="Nome do projeto" onSave={(v) => onPatch({ projectName: v })} />
              {item.projectName &&
                (projectId ? (
                  <Link to={`/projetos/${projectId}`} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                    Abrir no Space <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : (
                  <p className="text-xs text-gray-400">Nenhum projeto com esse nome na conta.</p>
                ))}
            </div>
            <Field label="Vídeo (opcional)" value={item.video} placeholder="Caminho ou link do vídeo" onSave={(v) => onPatch({ video: v })} />
            <div className="grid grid-cols-[1fr_9.5rem] gap-2">
              <Field label="Próximo passo" value={item.nextStep} placeholder="Ex.: mandar a primeira mensagem" onSave={(v) => onPatch({ nextStep: v })} />
              <Field label="Quando" type="date" value={item.nextDate} onSave={(v) => onPatch({ nextDate: v })} />
            </div>
            <Field label="Notas" type="area" value={item.notes} placeholder="Quem atendeu, o que pediu, objeções…" onSave={(v) => onPatch({ notes: v })} />

            <section>
              <p className="text-xs font-medium text-gray-700">Histórico</p>
              <ol className="mt-1 space-y-0.5 text-xs text-gray-600">
                {[...item.history].reverse().map((h) => (
                  <li key={h.at + h.stage}>
                    <span className="tabular-nums text-gray-400">{day(h.at)}</span> · {STAGE_LABEL[h.stage]}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>

      <footer className="border-t border-gray-100 px-5 py-3">
        {confirm ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600">Tirar do funil? A oferta e as notas se perdem.</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Manter
              </Button>
              <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" onClick={onRemove}>
                Tirar
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-700">
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Tirar do funil
          </button>
        )}
      </footer>
    </aside>
  )
}

// ---------------------------------------------------------------- funil

/** Valores padrão da oferta (cada oportunidade pode mudar os dela). */
const SettingsBar: React.FC<{ settings: FunnelSettings; onSave: (s: FunnelSettings) => void }> = ({ settings, onSave }) => {
  const [price, setPrice] = useState(String(settings.price))
  const [monthly, setMonthly] = useState(settings.monthly ? String(settings.monthly) : '')
  const [months, setMonths] = useState(String(settings.months))
  useEffect(() => {
    setPrice(String(settings.price))
    setMonthly(settings.monthly ? String(settings.monthly) : '')
    setMonths(String(settings.months))
  }, [settings])
  const save = () => {
    const next: FunnelSettings = {
      price: amount(price) ?? settings.price,
      monthly: amount(monthly) ?? 0,
      months: Math.max(1, Math.round(Number(months)) || DEFAULT_SETTINGS.months),
    }
    if (next.price !== settings.price || next.monthly !== settings.monthly || next.months !== settings.months) onSave(next)
  }
  const moneyInput = (value: string, set: (v: string) => void, label: string, placeholder?: string) => (
    <label className="flex items-center gap-2">
      {label}
      <span className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
        <input type="number" min={0} step={50} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} onBlur={save} className={cn(FIELD, 'h-8 w-28 pl-8 text-xs tabular-nums')} />
      </span>
    </label>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
      {moneyInput(price, setPrice, 'Serviço')}
      {moneyInput(monthly, setMonthly, 'Plano mensal', 'nenhum')}
      {settings.monthly > 0 && (
        <label className="flex items-center gap-2">
          por
          <input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} onBlur={save} className={cn(FIELD, 'h-8 w-14 text-xs tabular-nums')} />
          meses
        </label>
      )}
    </div>
  )
}

/**
 * Funil de oportunidades: uma coluna por etapa, do mapeado ao fechado. O
 * cartão vai de uma coluna para outra arrastando (ou pelo botão de avançar);
 * cada oportunidade tem a oferta com o valor e o roteiro de venda.
 */
export const Funnel: React.FC<{ items: Opportunity[]; onChange: SetItems }> = ({ items, onChange }) => {
  const projectIds = useProjectIds()
  const [settings, setSettings] = useState<FunnelSettings>(DEFAULT_SETTINGS)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [region, setRegion] = useState('todas')
  const [niche, setNiche] = useState('todos')
  const [text, setText] = useState('')

  useEffect(() => {
    getFunnelSettings().then(setSettings).catch(() => {})
  }, [])

  const saveSettings = async (next: FunnelSettings) => {
    setSettings(next)
    try {
      setSettings(await saveFunnelSettings(next))
    } catch (e) {
      toast.error('Não deu para salvar o ajuste', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const regions = useMemo(() => [...new Set(items.map((o) => o.region))].sort(), [items])
  const niches = useMemo(() => [...new Set(items.map((o) => o.lead.niche))].sort(), [items])
  const visible = useMemo(() => {
    const query = text.trim().toLowerCase()
    return items
      .filter((o) => (region === 'todas' || o.region === region) && (niche === 'todos' || o.lead.niche === niche))
      .filter((o) => !query || [o.lead.name, o.lead.domain, o.projectName, o.notes].some((v) => v?.toLowerCase().includes(query)))
      .sort((a, b) => b.lead.score - a.lead.score || a.lead.name.localeCompare(b.lead.name, 'pt-BR'))
  }, [items, region, niche, text])

  /** Grava no servidor e mantém a empresa como a tela já tinha (com a nota pela regra atual). */
  const patch = async (id: string, change: OpportunityPatch) => {
    try {
      const updated = await updateOpportunity(id, change)
      onChange((prev) => prev.map((o) => (o.id === id ? { ...updated, lead: o.lead } : o)))
    } catch (e) {
      toast.error('Não deu para salvar', { description: e instanceof Error ? e.message : undefined })
    }
  }

  /** Muda a etapa na hora e confirma no servidor; se falhar, volta. */
  const move = async (id: string, stage: Stage, undo = true) => {
    const current = items.find((o) => o.id === id)
    if (!current || current.stage === stage) return
    onChange((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)))
    try {
      const updated = await updateOpportunity(id, { stage })
      onChange((prev) => prev.map((o) => (o.id === id ? { ...updated, lead: o.lead } : o)))
      if (undo) {
        toast(`${current.lead.name} → ${STAGE_LABEL[stage]}`, { action: { label: 'Desfazer', onClick: () => void move(id, current.stage, false) } })
      }
    } catch (e) {
      onChange((prev) => prev.map((o) => (o.id === id ? current : o)))
      toast.error('Não deu para mover', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const remove = async (id: string) => {
    try {
      await removeOpportunity(id)
      setOpenId(null)
      onChange((prev) => prev.filter((o) => o.id !== id))
    } catch (e) {
      toast.error('Não deu para tirar do funil', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const open = items.find((o) => o.id === openId)
  const total = (list: Opportunity[]) => list.reduce((sum, o) => sum + valueOf(o, settings).total, 0)
  const openValue = total(items.filter((o) => OPEN_STAGES.includes(o.stage)))
  const wonValue = total(items.filter((o) => o.stage === 'fechado'))
  const contacted = items.filter((o) => ['contatado', 'conversa', 'proposta', 'fechado', 'perdido'].includes(o.stage)).length
  const answered = items.filter((o) => ['conversa', 'proposta', 'fechado'].includes(o.stage)).length

  if (!items.length) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
        <h2 className="text-sm font-semibold text-gray-900">O funil está vazio</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          Abra uma busca, marque as empresas que interessam e use "Pôr no funil" ou "Pôr na fila da página". Elas aparecem aqui, uma coluna por etapa.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={cn(SURFACE, 'px-4 py-3')}>
          <p className="text-xs text-gray-500">Valor em aberto</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{money(openValue)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">da fila da página à proposta</p>
        </div>
        <div className={cn(SURFACE, 'px-4 py-3')}>
          <p className="text-xs text-gray-500">Ganho</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{money(wonValue)}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{plural(items.filter((o) => o.stage === 'fechado').length, 'fechado', 'fechados')}</p>
        </div>
        <div className={cn(SURFACE, 'px-4 py-3')}>
          <p className="text-xs text-gray-500">Contatados</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{contacted}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">de {plural(items.length, 'oportunidade', 'oportunidades')}</p>
        </div>
        <div className={cn(SURFACE, 'px-4 py-3')}>
          <p className="text-xs text-gray-500">Responderam</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{answered}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{contacted ? `${Math.round((answered / contacted) * 100)}% dos contatados` : 'ninguém contatado ainda'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Procurar por nome, site, projeto ou nota" aria-label="Procurar no funil" className={cn(FIELD, 'h-9 w-72')} />
          {regions.length > 1 && (
            <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Região" className={cn(FIELD, 'h-9 w-auto')}>
              <option value="todas">Todas as regiões</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          {niches.length > 1 && (
            <select value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Nicho" className={cn(FIELD, 'h-9 w-auto')}>
              <option value="todos">Todos os nichos</option>
              {niches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </div>
        <SettingsBar settings={settings} onSave={saveSettings} />
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
        <div className="flex gap-3">
          {STAGES.map((stage) => {
            const cards = visible.filter((o) => o.stage === stage.id)
            const columnValue = total(cards)
            const target = dragId !== null && over === stage.id && items.find((o) => o.id === dragId)?.stage !== stage.id
            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (over !== stage.id) setOver(stage.id)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((v) => (v === stage.id ? null : v))
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(DRAG_TYPE)
                  setOver(null)
                  setDragId(null)
                  if (id) {
                    e.preventDefault()
                    void move(id, stage.id)
                  }
                }}
                className={cn(SURFACE, 'flex w-72 shrink-0 flex-col p-2.5 transition-colors', target ? 'bg-violet-50 ring-2 ring-violet-400' : 'bg-gray-50/80')}
              >
                <header className="px-1 pb-2" title={stage.hint}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-gray-900">{stage.label}</h2>
                    <span className="text-xs tabular-nums text-gray-500">
                      {cards.length}
                      {columnValue > 0 && ` · ${money(columnValue)}`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{stage.hint}</p>
                </header>
                <div className="min-h-16 flex-1 space-y-2">
                  {cards.map((item) => (
                    <Card
                      key={item.id}
                      item={item}
                      value={valueOf(item, settings).total}
                      active={item.id === openId}
                      dragging={item.id === dragId}
                      onOpen={() => setOpenId(item.id)}
                      onAdvance={(next) => void move(item.id, next)}
                      onDrag={(id) => {
                        setDragId(id)
                        if (!id) setOver(null)
                      }}
                    />
                  ))}
                  {!cards.length && (
                    <p className={cn('rounded-lg border border-dashed px-3 py-6 text-center text-xs', target ? 'border-violet-300 text-violet-700' : 'border-gray-200 text-gray-400')}>
                      {dragId ? 'Solte aqui' : 'Nenhuma'}
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
      {visible.length < items.length && <p className="text-xs text-gray-500">{plural(items.length - visible.length, 'oportunidade escondida', 'oportunidades escondidas')} pelos filtros.</p>}

      {open && (
        <Panel
          key={open.id}
          item={open}
          settings={settings}
          projectId={open.projectName ? projectIds.get(open.projectName.trim().toLowerCase()) : undefined}
          onClose={() => setOpenId(null)}
          onPatch={(change) => void patch(open.id, change)}
          onRemove={() => void remove(open.id)}
        />
      )}
    </div>
  )
}
