import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  CalendarDays,
  ChartColumn,
  ChartLine,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Gem,
  Handshake,
  Heart,
  ImagePlus,
  ListOrdered,
  Instagram,
  Lightbulb,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Palette,
  Phone,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/integrations/supabase/client'
import { FIELD, Surface } from '@/features/crm/ui'
import {
  BOOKING_DEFAULT,
  SHIFTS_DEFAULT,
  shiftOrder,
  type BookingShift,
  ICONS,
  PIXEL_DEFAULT,
  PIXEL_ID,
  PIXEL_SUBMIT_EVENTS,
  WEEKDAYS,
  WELCOME_DEFAULT,
  WELCOME_LIMITS,
  allFields,
  bookingDays,
  hasOptions,
  listBookings,
  loadPixelSecret,
  newId,
  optionsOf,
  pixelEvents,
  savePixelSecret,
  setBookingStatus,
  timesOfDay,
  uploadFormLogo,
  type BookingRange,
  type CrmForm,
  type FormBooking,
  type FormBookingRow,
  type FormDefinition,
  type FormPixel,
  type FormSettings,
  type FormWelcome,
  type IconName,
} from '@/features/crm/forms'
import { directUrl } from '@/features/crm/FormPanels'
import { cn } from '@/lib/utils'

/**
 * Painéis do fluxo do formulário: a capa (tela de início), a agenda (horários por formulário, o filtro
 * de quem chega nela e as reuniões marcadas) e o pixel da Meta com a API de Conversões.
 */

const INPUT = `${FIELD} h-9`
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

export const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  rocket: Rocket,
  target: Target,
  'trending-up': TrendingUp,
  'chart-line': ChartLine,
  'chart-column': ChartColumn,
  'circle-check': CircleCheck,
  'badge-check': BadgeCheck,
  trophy: Trophy,
  award: Award,
  star: Star,
  sparkles: Sparkles,
  zap: Zap,
  gem: Gem,
  lightbulb: Lightbulb,
  palette: Palette,
  megaphone: Megaphone,
  'dollar-sign': DollarSign,
  users: Users,
  handshake: Handshake,
  briefcase: Briefcase,
  store: Store,
  'shield-check': ShieldCheck,
  heart: Heart,
  'message-circle': MessageCircle,
  phone: Phone,
  instagram: Instagram,
  'map-pin': MapPin,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  clock: Clock,
}

const copy = (text: string, what = 'Copiado') =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(what),
    () => toast.error('Não consegui copiar')
  )

// ---------- ícone ----------

const IconPicker: React.FC<{ value?: IconName; onChange: (icon?: IconName) => void; label: string }> = ({ value, onChange, label }) => {
  const Current = value ? ICON_COMPONENTS[value] : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`${label}: ${value ?? 'sem ícone'}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 hover:border-violet-300">
          {Current ? <Current className="h-[18px] w-[18px]" strokeWidth={2} /> : <Plus className="h-4 w-4 text-gray-400" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[248px] p-2">
        <div className="grid grid-cols-6 gap-1" role="listbox" aria-label={label}>
          {ICONS.map((name) => {
            const I = ICON_COMPONENTS[name]
            return (
              <button key={name} type="button" role="option" aria-selected={value === name} title={name} onClick={() => onChange(name)} className={cn('flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-zinc-100', value === name && 'bg-violet-50 text-violet-700 ring-1 ring-violet-300')}>
                <I className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => onChange(undefined)} className="mt-2 w-full rounded-md py-1.5 text-xs text-gray-500 hover:bg-zinc-100">
          Sem ícone
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const Counter: React.FC<{ n: number; max: number; unit: string }> = ({ n, max, unit }) => (
  <span className={cn('shrink-0 text-[11px] tabular-nums', n > max ? 'font-semibold text-rose-600' : 'text-gray-400')} aria-live="polite">
    {n}/{max} {unit}
  </span>
)

/** Botões lado a lado, um escolhido (ícone + nome), como as abas da prévia. */
function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { id: T; label: string; icon: LucideIcon }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-zinc-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const I = o.icon
        const on = value === o.id
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)} className={cn('flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium', on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            <I className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const wordsOf = (text: string) => text.replace(/\*\*/g, '').trim().split(/\s+/).filter(Boolean).length

// ---------- capa ----------

export const WelcomeEditor: React.FC<{ form: Pick<CrmForm, 'id' | 'teamId'>; definition: FormDefinition; onChange: (definition: FormDefinition) => void }> = ({ form, definition, onChange }) => {
  const w = definition.welcome
  const file = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const set = (patch: Partial<FormWelcome>) => onChange({ ...definition, welcome: { ...(w ?? { ...WELCOME_DEFAULT, enabled: true }), ...patch } })

  if (!w) {
    return (
      <Surface title="Tela de início">
        <p className="mb-3 text-sm text-gray-600">Uma capa antes da primeira pergunta: headline, os bullets da oferta, o filtro de quem é o público e o botão para começar.</p>
        <Button type="button" onClick={() => onChange({ ...definition, welcome: { ...WELCOME_DEFAULT, bullets: WELCOME_DEFAULT.bullets.map((b) => ({ ...b, id: newId('b') })) } })}>
          <Plus className="mr-1.5 h-4 w-4" /> Criar tela de início
        </Button>
      </Surface>
    )
  }

  const words = wordsOf(w.title)
  const pick = async (f?: File) => {
    if (!f) return
    setUploading(true)
    try {
      set({ logoUrl: await uploadFormLogo(form, f) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }
  const setBullet = (id: string, patch: Partial<FormWelcome['bullets'][number]>) => set({ bullets: w.bullets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

  return (
    <div className="grid gap-4">
      <Surface title="Tela de início" action={<label className="flex items-center gap-2 text-sm text-gray-700"><Switch checked={w.enabled} onCheckedChange={(enabled) => set({ enabled })} /> {w.enabled ? 'Ligada' : 'Desligada'}</label>}>
        <div className="grid gap-4">
          <div>
            <span className={LABEL}>Logo (PNG com fundo transparente)</span>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white px-2">
                {w.logoUrl ? <img src={w.logoUrl} alt="" className="max-h-8 max-w-full object-contain" /> : <span className="text-xs text-gray-400">Sem logo</span>}
              </div>
              <input ref={file} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => file.current?.click()}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />} {w.logoUrl ? 'Trocar' : 'Enviar logo'}
              </Button>
              {w.logoUrl && (
                <button type="button" onClick={() => set({ logoUrl: undefined })} className="text-xs text-gray-500 hover:text-rose-600">
                  Tirar
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={cn(LABEL, 'mb-0')}>Headline: ícone + para quem você vende + resultado</span>
              <Counter n={words} max={WELCOME_LIMITS.titleWords} unit="palavras" />
            </div>
            <div className="flex items-start gap-2">
              <IconPicker value={w.icon} onChange={(icon) => set({ icon })} label="Ícone da headline" />
              <textarea className={cn(FIELD, 'min-h-[64px] flex-1 py-2')} value={w.title} onChange={(e) => set({ title: e.target.value })} aria-label="Headline" />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Use <code className="rounded bg-zinc-100 px-1">**assim**</code> para o negrito. Até {WELCOME_LIMITS.titleWords} palavras, transmitindo um resultado específico.
            </p>
          </div>

          <div>
            <span className={LABEL}>Bullets: promessa, meio 1, meio 2, autoridade (até {WELCOME_LIMITS.bulletChars} caracteres, numa linha só)</span>
            <ul className="grid gap-2">
              {w.bullets.map((b, i) => (
                <li key={b.id} className="flex items-center gap-2">
                  <IconPicker value={b.icon} onChange={(icon) => setBullet(b.id, { icon })} label={`Ícone do bullet ${i + 1}`} />
                  <div className="relative min-w-0 flex-1">
                    <input className={cn(INPUT, 'pr-14', b.text.length > WELCOME_LIMITS.bulletChars && 'border-rose-300')} value={b.text} onChange={(e) => setBullet(b.id, { text: e.target.value })} aria-label={`Bullet ${i + 1}`} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Counter n={b.text.length} max={WELCOME_LIMITS.bulletChars} unit="" />
                    </span>
                  </div>
                  <button type="button" onClick={() => set({ bullets: w.bullets.filter((x) => x.id !== b.id) })} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600" aria-label={`Tirar o bullet ${i + 1}`}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {w.bullets.length < WELCOME_LIMITS.bullets && (
              <button type="button" onClick={() => set({ bullets: [...w.bullets, { id: newId('b'), icon: 'circle-check', text: '' }] })} className="mt-2 text-sm font-medium text-violet-700 hover:underline">
                + Bullet
              </button>
            )}
          </div>

          <div>
            <span className={LABEL}>Rodapé da capa: o filtro de quem é o público (sai em itálico, com a seta →)</span>
            <textarea className={cn(FIELD, 'min-h-[64px] py-2 italic')} value={w.footnote ?? ''} onChange={(e) => set({ footnote: e.target.value || undefined })} placeholder="Exclusivo para empresas com faturamento acima de R$ 30 mil/mês…" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={cn(LABEL, 'mb-0')}>Botão: curto, direto, a ação que a pessoa quer</span>
              <Counter n={w.buttonLabel.length} max={28} unit="" />
            </div>
            <input className={INPUT} value={w.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} aria-label="Texto do botão" />
          </div>
        </div>
      </Surface>
      <Surface title="Alinhamento">
        <div className="grid gap-4">
          <div>
            <span className={LABEL}>Conteúdo na altura da tela</span>
            <Segmented
              label="Conteúdo na altura da tela"
              value={w.valign ?? 'top'}
              onChange={(valign) => set({ valign })}
              options={[
                { id: 'top', label: 'Topo', icon: AlignVerticalJustifyStart },
                { id: 'center', label: 'Centro', icon: AlignVerticalJustifyCenter },
                { id: 'bottom', label: 'Base', icon: AlignVerticalJustifyEnd },
                { id: 'justify', label: 'Distribuído', icon: AlignVerticalSpaceBetween },
              ]}
            />
            <p className="mt-1.5 text-[11px] text-gray-500">
              {(w.valign ?? 'top') === 'justify' ? 'Logo no topo, texto no meio e botão embaixo. ' : ''}Vale quando a capa ocupa a tela: no link direto e na prévia de celular. Dentro de uma página do site, a capa fica no tamanho do conteúdo.
            </p>
          </div>
          {w.logoUrl && (
            <div>
              <span className={LABEL}>Logo</span>
              <Segmented
                label="Posição do logo"
                value={w.logoAlign ?? 'left'}
                onChange={(logoAlign) => set({ logoAlign })}
                options={[
                  { id: 'left', label: 'Esquerda', icon: AlignLeft },
                  { id: 'center', label: 'Centro', icon: AlignCenter },
                  { id: 'right', label: 'Direita', icon: AlignRight },
                ]}
              />
            </div>
          )}
        </div>
      </Surface>
      <Surface title="Conferência da capa">
        <ul className="grid gap-1.5 text-sm">
          {[
            { ok: words > 0 && words <= WELCOME_LIMITS.titleWords, text: `Headline com até ${WELCOME_LIMITS.titleWords} palavras` },
            { ok: !!w.icon, text: 'Headline começa com um ícone' },
            { ok: /\*\*.+\*\*/.test(w.title), text: 'Um trecho de resultado em negrito' },
            { ok: !/vendas reais/i.test(`${w.title} ${w.bullets.map((b) => b.text).join(' ')}`), text: 'Sem a frase "vendas reais"' },
            { ok: w.bullets.length >= 3 && w.bullets.every((b) => b.text && b.text.length <= WELCOME_LIMITS.bulletChars), text: `3 a ${WELCOME_LIMITS.bullets} bullets de até ${WELCOME_LIMITS.bulletChars} caracteres` },
            { ok: w.bullets.length > 0 && w.bullets.every((b) => b.icon), text: 'Cada bullet com um ícone' },
            { ok: !!w.footnote, text: 'Rodapé com o filtro do público' },
            { ok: w.buttonLabel.length > 0 && w.buttonLabel.length <= 28, text: 'Botão curto' },
          ].map((c) => (
            <li key={c.text} className={cn('flex items-center gap-2', c.ok ? 'text-gray-700' : 'text-amber-800')}>
              {c.ok ? <Check className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4" />} {c.text}
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  )
}

// ---------- agenda ----------

const DURATIONS = [15, 20, 30, 45, 60, 90, 120]

const DayRow: React.FC<{ day: number; ranges: BookingRange[]; onChange: (ranges: BookingRange[]) => void }> = ({ day, ranges, onChange }) => {
  const on = ranges.length > 0
  return (
    <li className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)]">
      <label className="flex h-9 items-center gap-2 text-sm font-medium text-gray-800">
        <Switch checked={on} onCheckedChange={(v) => onChange(v ? [{ start: '09:00', end: '18:00' }] : [])} aria-label={`Atende ${WEEKDAYS[day]}`} />
        {WEEKDAYS[day].slice(0, 3)}
      </label>
      {on ? (
        <div className="grid gap-1.5">
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input type="time" step={900} className={cn(INPUT, 'w-[108px] tabular-nums')} value={r.start} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} aria-label={`${WEEKDAYS[day]}: início do intervalo ${i + 1}`} />
              <span className="text-gray-400">–</span>
              <input type="time" step={900} className={cn(INPUT, 'w-[108px] tabular-nums', r.end <= r.start && 'border-rose-300')} value={r.end} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} aria-label={`${WEEKDAYS[day]}: fim do intervalo ${i + 1}`} />
              <button type="button" onClick={() => onChange(ranges.filter((_, j) => j !== i))} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600" aria-label={`Tirar o intervalo ${i + 1} de ${WEEKDAYS[day]}`}>
                <X className="h-4 w-4" />
              </button>
              {i === ranges.length - 1 && ranges.length < 6 && (
                <button type="button" onClick={() => onChange([...ranges, { start: r.end < '23:00' ? r.end : '14:00', end: r.end < '22:00' ? `${String(Number(r.end.slice(0, 2)) + 1).padStart(2, '0')}:${r.end.slice(3)}` : '18:00' }])} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-violet-700" aria-label={`Mais um intervalo em ${WEEKDAYS[day]}`}>
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <span className="flex h-9 items-center text-sm text-gray-400">Sem atendimento</span>
      )}
    </li>
  )
}

/** Um turno: os horários (chips), a ordem de oferta e quantos aparecem de uma vez. */
const ShiftEditor: React.FC<{ shift: BookingShift; onChange: (shift: BookingShift) => void; onRemove: () => void }> = ({ shift, onChange, onRemove }) => {
  const [adding, setAdding] = useState('')
  const sorted = [...shift.times].sort()
  const order = shiftOrder(shift)
  const add = () => {
    if (!/^\d{2}:\d{2}$/.test(adding) || shift.times.includes(adding)) return
    onChange({ ...shift, times: [...shift.times, adding].sort() })
    setAdding('')
  }
  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <input className={cn(INPUT, 'w-32 font-medium')} value={shift.label} onChange={(e) => onChange({ ...shift, label: e.target.value })} aria-label="Nome do turno" />
        <span className="flex-1" />
        <button type="button" onClick={onRemove} className="rounded p-1.5 text-gray-400 hover:bg-zinc-100 hover:text-rose-600" aria-label={`Tirar o turno ${shift.label}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div>
        <span className={LABEL}>Horários do turno</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {sorted.map((t) => (
            <span key={t} className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white pl-2.5 pr-1 text-sm tabular-nums text-gray-800">
              {t}
              <button type="button" onClick={() => onChange({ ...shift, times: shift.times.filter((x) => x !== t) })} className="rounded p-0.5 text-gray-400 hover:text-rose-600" aria-label={`Tirar ${t}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input type="time" step={900} className={cn(INPUT, 'h-8 w-[104px] tabular-nums')} value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} aria-label={`Novo horário em ${shift.label}`} />
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={add} disabled={!adding}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Oferecer primeiro</label>
          <select className={INPUT} value={shift.order} onChange={(e) => onChange({ ...shift, order: e.target.value as BookingShift['order'] })}>
            <option value="late">Os mais tarde</option>
            <option value="early">Os mais cedo</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Aparecem de uma vez</label>
          <select className={INPUT} value={shift.show} onChange={(e) => onChange({ ...shift, show: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'horário' : 'horários'}
              </option>
            ))}
          </select>
        </div>
      </div>
      {order.length > 0 && (
        <p className="text-xs text-gray-600">
          Ordem de oferta:{' '}
          {order.map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && <span className="text-gray-400"> → </span>}
              <span className={cn('tabular-nums', i < shift.show ? 'font-semibold text-gray-900' : 'text-gray-500')}>{t}</span>
            </React.Fragment>
          ))}
          <span className="text-gray-500"> · em negrito, os que aparecem com a agenda vazia</span>
        </p>
      )}
    </div>
  )
}

export const BookingEditor: React.FC<{ definition: FormDefinition; settings: FormSettings; onChange: (settings: FormSettings) => void }> = ({ definition, settings, onChange }) => {
  const b = settings.booking
  const set = (patch: Partial<FormBooking>) => onChange({ ...settings, booking: { ...(b ?? BOOKING_DEFAULT), ...patch } })
  const pickFields = allFields(definition).filter((f) => hasOptions(f.type) || f.type === 'yesno')
  const upcoming = useMemo(() => (b?.enabled ? bookingDays(b, new Date()) : []), [b])

  if (!b) {
    return (
      <Surface title="Agenda">
        <p className="mb-3 text-sm text-gray-600">Depois de responder, quem passa no filtro escolhe um horário para a reunião nos próximos dias. A equipe recebe o aviso no grupo do WhatsApp e a reunião entra no card do lead.</p>
        <Button type="button" onClick={() => onChange({ ...settings, booking: { ...BOOKING_DEFAULT } })}>
          <Plus className="mr-1.5 h-4 w-4" /> Ligar a agenda
        </Button>
      </Surface>
    )
  }

  const gate = b.gate
  const gateField = gate.mode === 'answer' ? pickFields.find((f) => f.id === gate.field) : undefined
  const slotsPerWeek = [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + timesOfDay(b, d).length, 0)
  const priority = (b.mode ?? 'priority') === 'priority'

  return (
    <div className="grid gap-4">
      <Surface title="Agenda" action={<label className="flex items-center gap-2 text-sm text-gray-700"><Switch checked={b.enabled} onCheckedChange={(enabled) => set({ enabled })} /> {b.enabled ? 'Ligada' : 'Desligada'}</label>}>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Nome da reunião</label>
              <input className={INPUT} value={b.meetingName} onChange={(e) => set({ meetingName: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Título da tela</label>
              <input className={INPUT} value={b.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Duração</label>
              <select className={INPUT} value={b.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : d === 60 ? '1 hora' : `${d / 60} h`.replace('.5', ',5')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Dias mostrados</label>
              <select className={INPUT} value={b.days} onChange={(e) => set({ days: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 7].map((d) => (
                  <option key={d} value={d}>
                    Próximos {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Antecedência</label>
              <select className={INPUT} value={b.noticeHours} onChange={(e) => set({ noticeHours: Number(e.target.value) })}>
                {[0, 1, 2, 4, 12, 24].map((h) => (
                  <option key={h} value={h}>
                    {h === 0 ? 'Nenhuma' : `${h} h`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">O lead sempre vê os próximos {b.days} dias que têm horário livre, a partir de amanhã (nunca no mesmo dia, para dar tempo de preparar a reunião). Um dia lotado (ou sem atendimento) sai da lista e o próximo dia de atendimento entra no lugar. Horário de Brasília; um horário reservado sai da lista para os outros.</p>
        </div>
      </Surface>

      <Surface
        title="Horários de atendimento"
        action={priority ? <span className="text-xs text-gray-500">até {(b.shifts ?? []).reduce((n, s) => n + Math.min(s.show, s.times.length), 0)} por dia na tela</span> : <span className="text-xs text-gray-500">{slotsPerWeek} horários por semana</span>}
      >
        <div className="mb-4">
          <Segmented
            label="Como a agenda oferece os horários"
            value={priority ? 'priority' : 'range'}
            onChange={(mode) => set({ mode, shifts: b.shifts?.length ? b.shifts : SHIFTS_DEFAULT, workdays: b.workdays ?? [1, 2, 3, 4, 5] })}
            options={[
              { id: 'priority', label: 'Por prioridade', icon: ListOrdered },
              { id: 'range', label: 'Todos os horários', icon: CalendarDays },
            ]}
          />
          <p className="mt-1.5 text-[11px] text-gray-500">
            {priority ? 'Cada turno mostra só os primeiros horários livres na ordem de prioridade; os da ponta só aparecem quando a agenda vai lotando.' : 'Mostra todos os horários livres dos intervalos de cada dia da semana.'}
          </p>
        </div>
        {priority ? (
          <div className="grid gap-4">
            <div>
              <span className={LABEL}>Dias de atendimento</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias de atendimento">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = (b.workdays ?? []).includes(d)
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => set({ workdays: on ? (b.workdays ?? []).filter((x) => x !== d) : [...(b.workdays ?? []), d].sort() })} className={cn('h-8 rounded-lg border px-3 text-xs font-medium', on ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800')}>
                      {WEEKDAYS[d].slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>
            {(b.shifts ?? []).map((shift) => (
              <ShiftEditor key={shift.id} shift={shift} onChange={(next) => set({ shifts: (b.shifts ?? []).map((s) => (s.id === shift.id ? next : s)) })} onRemove={() => set({ shifts: (b.shifts ?? []).filter((s) => s.id !== shift.id) })} />
            ))}
            {(b.shifts ?? []).length < 4 && (
              <button type="button" onClick={() => set({ shifts: [...(b.shifts ?? []), { id: newId('t'), label: 'Noite', times: ['18:30', '19:30'], order: 'early', show: 2 }] })} className="justify-self-start text-sm font-medium text-violet-700 hover:underline">
                + Turno
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <DayRow key={d} day={d} ranges={b.week[String(d)] ?? []} onChange={(ranges) => set({ week: { ...b.week, [String(d)]: ranges } })} />
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => set({ week: { ...b.week, '2': b.week['1'] ?? [], '3': b.week['1'] ?? [], '4': b.week['1'] ?? [], '5': b.week['1'] ?? [] } })}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar segunda para terça a sexta
              </Button>
            </div>
          </>
        )}
        {b.enabled && (
          <div className="mt-4 rounded-lg bg-zinc-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">O que aparece se alguém responder agora</p>
            {upcoming.length ? (
              <ul className="grid gap-1 text-sm text-gray-800">
                {upcoming.map((d) => (
                  <li key={d.date} className="flex gap-2">
                    <span className="w-24 shrink-0 font-medium tabular-nums">
                      {WEEKDAYS[d.weekday].slice(0, 3)} {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                    </span>
                    <span className="min-w-0 truncate tabular-nums text-gray-600">{d.times.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-amber-800">Nenhum horário livre: ligue algum dia da semana.</p>
            )}
          </div>
        )}
      </Surface>

      <Surface title="Quem vai para a agenda">
        <div className="grid gap-2" role="radiogroup" aria-label="Quem vai para a agenda">
          {(
            [
              { mode: 'answer', label: 'Por resposta', hint: 'Só quem marcou certas opções (ex.: faturamento acima de R$ 30 mil). O resto vê a mensagem final.' },
              ...(definition.kind === 'quiz' ? [{ mode: 'qualified', label: 'Lead qualificado do quiz', hint: 'Quem cai numa faixa de resultado marcada como qualificada.' }] : []),
              { mode: 'all', label: 'Todos', hint: 'Toda pessoa que responde escolhe um horário.' },
            ] as { mode: FormBooking['gate']['mode']; label: string; hint: string }[]
          ).map((o) => (
            <label key={o.mode} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', gate.mode === o.mode ? 'border-violet-300 bg-violet-50/40' : 'border-gray-200')}>
              <input
                type="radio"
                name="gate"
                className="mt-1 accent-violet-600"
                checked={gate.mode === o.mode}
                onChange={() => set({ gate: o.mode === 'answer' ? { mode: 'answer', field: pickFields[pickFields.length - 1]?.id ?? '', values: [] } : { mode: o.mode } as FormBooking['gate'] })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{o.label}</span>
                <span className="block text-xs text-gray-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {gate.mode === 'answer' && (
          <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 p-3">
            {pickFields.length ? (
              <>
                <label className={LABEL}>Pergunta que filtra</label>
                <select className={INPUT} value={gate.field} onChange={(e) => set({ gate: { mode: 'answer', field: e.target.value, values: [] } })}>
                  <option value="">Escolha…</option>
                  {pickFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || 'Sem pergunta'}
                    </option>
                  ))}
                </select>
                {gateField && (
                  <fieldset className="mt-1">
                    <legend className={LABEL}>Respostas que abrem a agenda</legend>
                    <div className="grid gap-1.5">
                      {optionsOf(gateField).map((o) => {
                        const checked = gate.values.includes(o.id)
                        return (
                          <label key={o.id} className="flex items-center gap-2 text-sm text-gray-800">
                            <input type="checkbox" className="accent-violet-600" checked={checked} onChange={() => set({ gate: { ...gate, values: checked ? gate.values.filter((v) => v !== o.id) : [...gate.values, o.id] } })} />
                            {o.label || 'Sem texto'}
                          </label>
                        )
                      })}
                    </div>
                    {!gate.values.length && <p className="mt-2 text-xs text-amber-800">Marque pelo menos uma resposta, senão ninguém chega na agenda.</p>}
                  </fieldset>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-800">Crie uma pergunta de escolha (ex.: faturamento mensal) para filtrar por resposta.</p>
            )}
            <p className="text-xs text-gray-500">Num formulário comum, este filtro também decide quem é lead qualificado: só quem passa dispara o Lead da Meta e o <code className="rounded bg-zinc-100 px-1">lead_qualificado</code>.</p>
          </div>
        )}
      </Surface>

      <Surface title="Textos da agenda">
        <div className="grid gap-3">
          <div>
            <label className={LABEL}>Botão de confirmar</label>
            <input className={INPUT} value={b.confirmLabel} onChange={(e) => set({ confirmLabel: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Título do agradecimento</label>
            <input className={INPUT} value={b.successTitle} onChange={(e) => set({ successTitle: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Mensagem do agradecimento</label>
            <textarea className={cn(FIELD, 'min-h-[64px] py-2')} value={b.successText} onChange={(e) => set({ successText: e.target.value })} />
          </div>
          <p className="text-xs text-gray-500">
            A cada reunião marcada, o aviso vai para o grupo da equipe no WhatsApp (o mesmo dos leads novos, em <Link to="/crm/whatsapp" className="font-medium text-violet-700 hover:underline">CRM › WhatsApp</Link>), e o card do lead ganha a reunião como próximo passo.
          </p>
        </div>
      </Surface>
    </div>
  )
}

const phoneLabel = (phone?: string) => phone?.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') ?? ''
const whenText = (ms: number) => new Date(ms).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export const BookingsList: React.FC<{ form: CrmForm; manager: boolean }> = ({ form, manager }) => {
  const [rows, setRows] = useState<FormBookingRow[] | null>(null)
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    try {
      setRows(await listBookings(form.id))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    }
  }, [form.id])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`form-bookings-${form.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_form_bookings', filter: `form_id=eq.${form.id}` }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [form.id, load])

  const now = Date.now()
  const next = (rows ?? []).filter((r) => r.endsAt >= now)
  const past = (rows ?? []).filter((r) => r.endsAt < now).reverse().slice(0, 20)

  const row = (r: FormBookingRow) => (
    <li key={r.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5', r.status === 'cancelado' && 'opacity-50')}>
      <span className="w-36 shrink-0 text-sm font-medium tabular-nums text-gray-900">{whenText(r.startsAt)}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
        {r.name || 'Sem nome'}
        <span className="text-gray-400"> · {[phoneLabel(r.phone), r.email].filter(Boolean).join(' · ')}</span>
      </span>
      {r.status === 'cancelado' && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-gray-600">Cancelada</span>}
      {r.opportunityId && (
        <Link to={`/crm?oportunidade=${r.opportunityId}`} className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
          Card <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {manager && r.endsAt >= now && (
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-rose-600"
          onClick={() => {
            const status = r.status === 'confirmado' ? 'cancelado' : 'confirmado'
            if (status === 'cancelado' && !window.confirm('Cancelar esta reunião? O horário volta a ficar livre. Avise a pessoa pelo WhatsApp.')) return
            setBookingStatus(r.id, status).then(load, (e) => toast.error(e instanceof Error ? e.message : String(e)))
          }}
        >
          {r.status === 'confirmado' ? 'Cancelar' : 'Reativar'}
        </button>
      )}
    </li>
  )

  return (
    <Surface title={`Reuniões marcadas${next.length ? ` · ${next.filter((r) => r.status === 'confirmado').length} próximas` : ''}`}>
      {error && <p className="mb-2 text-sm text-amber-800">{error}</p>}
      {rows === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
        </p>
      ) : !rows.length ? (
        <p className="py-4 text-center text-sm text-gray-500">Nenhuma reunião marcada ainda.</p>
      ) : (
        <>
          {next.length > 0 && <ul className="divide-y divide-gray-100">{next.map(row)}</ul>}
          {past.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-500">Anteriores ({past.length})</summary>
              <ul className="divide-y divide-gray-100">{past.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </Surface>
  )
}

// ---------- pixel da Meta ----------

export const PixelEditor: React.FC<{ form: CrmForm; settings: FormSettings; manager: boolean; onChange: (settings: FormSettings) => void }> = ({ form, settings, manager, onChange }) => {
  const p = settings.pixel
  const set = (patch: Partial<FormPixel>) => onChange({ ...settings, pixel: { ...(p ?? PIXEL_DEFAULT), ...patch } })
  const [secret, setSecret] = useState<{ accessToken: string; testEventCode: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!manager) return
    loadPixelSecret(form.id).then(
      (s) => {
        setSecret(s ?? { accessToken: '', testEventCode: '' })
        setLoaded(true)
      },
      (e) => {
        toast.error(e instanceof Error ? e.message : String(e))
        setLoaded(true)
      }
    )
  }, [form.id, manager])

  const on = !!p?.enabled
  const valid = !!p && PIXEL_ID.test(p.id)
  const names = pixelEvents(p ?? PIXEL_DEFAULT)
  const url = directUrl(form)

  const events = [
    { name: names.view, when: 'O formulário apareceu na tela' },
    { name: names.first, when: 'Clicou em começar ou respondeu a primeira pergunta' },
    ...(form.definition?.steps?.length ?? 0) > 1 ? [{ name: `${names.step}2 … ${names.step}${form.definition.steps.length}`, when: 'Chegou na pergunta 2, 3… (um evento por pergunta, para ver onde param)' }] : [],
    { name: p?.submitEvent && p.submitEvent !== 'custom' ? p.submitEvent : names.submit, when: 'Enviou as respostas', server: true },
    ...(p?.standardLead && p.submitEvent !== 'Lead' ? [{ name: 'Lead', when: 'Enviou e passou no filtro (quiz qualificado ou resposta da agenda)', server: true }] : []),
    ...(settings.booking?.enabled ? [{ name: names.viewScheduled, when: 'Viu a agenda' }, { name: names.scheduled, when: 'Marcou a reunião', server: true }] : []),
    ...(settings.booking?.enabled && p?.standardSchedule ? [{ name: 'Schedule', when: 'Marcou a reunião (evento padrão)', server: true }] : []),
  ]

  return (
    <div className="grid gap-4">
      <Surface title="Pixel da Meta" action={<label className="flex items-center gap-2 text-sm text-gray-700"><Switch checked={on} onCheckedChange={(enabled) => set({ enabled })} /> {on ? 'Ligado' : 'Desligado'}</label>}>
        <p className="mb-3 text-sm text-gray-600">Roda só dentro deste formulário, no link direto do app e no site (Elementor). Num site que já tem outro pixel, os eventos daqui vão só para este.</p>
        {on && (
          <div className="grid gap-3">
            <div>
              <label className={LABEL} htmlFor="px-id">ID do pixel</label>
              <input id="px-id" className={cn(INPUT, 'font-mono', p?.id && !valid && 'border-rose-300')} value={p?.id ?? ''} onChange={(e) => set({ id: e.target.value.replace(/\D/g, '') })} placeholder="2849219782065000" inputMode="numeric" />
              <p className={cn('mt-1 flex items-center gap-1.5 text-xs', valid ? 'text-emerald-700' : 'text-gray-500')}>
                {valid ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                {valid ? 'ID válido' : 'No Gerenciador de Eventos: Fontes de dados › o pixel › Identificação (15 ou 16 números).'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="px-prefix">Prefixo dos eventos personalizados</label>
                <input id="px-prefix" className={cn(INPUT, 'font-mono')} value={p?.prefix ?? ''} onChange={(e) => set({ prefix: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })} placeholder="Avence" />
              </div>
              <div>
                <label className={LABEL} htmlFor="px-submit">Evento no envio</label>
                <select id="px-submit" className={INPUT} value={p?.submitEvent ?? 'custom'} onChange={(e) => set({ submitEvent: e.target.value as FormPixel['submitEvent'] })}>
                  {PIXEL_SUBMIT_EVENTS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.id === 'custom' ? `${names.submit} (personalizado)` : x.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={!!p?.standardLead} onCheckedChange={(standardLead) => set({ standardLead })} /> Também mandar o <strong className="font-medium">Lead</strong> padrão para quem passou no filtro
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={!!p?.standardSchedule} onCheckedChange={(standardSchedule) => set({ standardSchedule })} /> Mandar o <strong className="font-medium">Schedule</strong> padrão quando marcarem a reunião
            </label>
          </div>
        )}
      </Surface>

      {on && (
        <Surface title="Eventos que este formulário dispara">
          <ul className="divide-y divide-gray-100">
            {events.map((e) => (
              <li key={e.name + e.when} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-gray-900">{e.name}</code>
                <span className="min-w-0 flex-1 text-sm text-gray-600">{e.when}</span>
                {'server' in e && e.server && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">navegador + servidor</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-gray-700">
            <p className="mb-2 font-medium text-gray-900">Conversão personalizada para este formulário</p>
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm marker:text-gray-400">
              <li>Gerenciador de Eventos › Conversões personalizadas › Criar. Fonte da ação: Site.</li>
              <li>Evento: o de cima que você quer otimizar (ex.: <code className="rounded bg-white px-1">{p?.submitEvent && p.submitEvent !== 'custom' ? p.submitEvent : names.submit}</code> ou <code className="rounded bg-white px-1">{names.scheduled}</code>).</li>
              <li>
                Regra <em>URL contém</em>{' '}
                <button type="button" onClick={() => void copy(`/f/${form.id}`, 'Copiado')} className="rounded bg-white px-1 font-mono text-xs ring-1 ring-gray-200 hover:bg-zinc-100">/f/{form.id}</button>{' '}
                (link direto) ou, no site, o endereço da página. Todo evento também leva <code className="rounded bg-white px-1">form_id</code> ={' '}
                <button type="button" onClick={() => void copy(form.id, 'Copiado')} className="rounded bg-white px-1 font-mono text-xs ring-1 ring-gray-200 hover:bg-zinc-100">{form.id.slice(0, 8)}…</button>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-gray-500">
              Para testar: Gerenciador de Eventos › Eventos de teste, cole <button type="button" onClick={() => void copy(url, 'Link copiado')} className="font-mono text-violet-700 hover:underline">{url}</button> e responda o formulário.
            </p>
          </div>
        </Surface>
      )}

      {on && (
        <Surface title="API de Conversões (servidor)">
          {!manager ? (
            <p className="text-sm text-gray-600">Só gestores da conta veem e mudam o token.</p>
          ) : !loaded ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
            </p>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-gray-600">Com o token, o envio, o Lead e o agendamento saem também do servidor, com o mesmo id do navegador (a Meta junta os dois). Pega quem bloqueia o pixel no navegador.</p>
              <div>
                <label className={LABEL} htmlFor="px-token">Token de acesso</label>
                <div className="relative">
                  <input id="px-token" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} className={cn(INPUT, 'pr-10 font-mono')} value={secret?.accessToken ?? ''} onChange={(e) => setSecret((s) => ({ testEventCode: '', ...s, accessToken: e.target.value }))} placeholder="EAAxxxxxxxx…" />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700" aria-label={show ? 'Esconder o token' : 'Mostrar o token'}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Gerenciador de Eventos › o pixel › Configurações › API de Conversões › Gerar token. Fica guardado fora da configuração pública do formulário.</p>
              </div>
              <div>
                <label className={LABEL} htmlFor="px-test">Código de teste (opcional)</label>
                <input id="px-test" className={cn(INPUT, 'w-48 font-mono')} value={secret?.testEventCode ?? ''} onChange={(e) => setSecret((s) => ({ accessToken: '', ...s, testEventCode: e.target.value.replace(/[^A-Za-z0-9]/g, '') }))} placeholder="TEST12345" />
                <p className="mt-1 text-xs text-gray-500">Só enquanto testa em Eventos de teste. Apague depois, senão os eventos do servidor não contam.</p>
              </div>
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setSaving(true)
                    savePixelSecret(form, secret ?? { accessToken: '', testEventCode: '' })
                      .then(() => toast.success('Token salvo'), (e) => toast.error(e instanceof Error ? e.message : String(e)))
                      .finally(() => setSaving(false))
                  }}
                >
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />} Salvar token
                </Button>
                {secret?.accessToken && (
                  <button type="button" className="ml-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600" onClick={() => setSecret({ accessToken: '', testEventCode: '' })}>
                    <Trash2 className="h-3.5 w-3.5" /> Limpar
                  </button>
                )}
              </div>
            </div>
          )}
        </Surface>
      )}
    </div>
  )
}
