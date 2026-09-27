import React, { useMemo } from 'react'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSpaceStore } from '@/store/spaceStore'
import type { SectionLevels, SectionMotion, SectionNodeData } from '@/types/space'
import { useActiveBrand } from '../brand/brandStore'
import type { MotionSpec } from '../brand/layers'
import type { HoverEffect } from '../brand/values'
import { sectionWithTransforms } from '../landingPage'
import { canvasSections, sectionPlace } from '../pages/pages'
import { SelectionHint } from './SelectionHint'
import {
  EASING_OPTIONS,
  ENTRANCE_OPTIONS,
  MOTION_PRESETS,
  motionRows,
  motionSpecText,
  motionText,
  presetOf,
  sameMotion,
  type MotionRow,
} from './motion'

/**
 * Nível Movimento: escolher o movimento das seções selecionadas (o da marca,
 * o original, um predefinido ou um próprio), ver no canvas e na lista o que
 * cada peça passa a fazer, e aplicar.
 */

const label = 'text-[10px] font-semibold uppercase tracking-wide text-gray-400'

const Option: React.FC<{ active: boolean; title: string; detail: string; onClick: () => void; disabled?: boolean }> = ({
  active,
  title,
  detail,
  onClick,
  disabled,
}) => (
  <button
    type="button"
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-40 ${
      active ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
    }`}
  >
    <span className={`block text-xs font-medium ${active ? 'text-violet-900' : 'text-gray-800'}`}>{title}</span>
    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{detail}</span>
  </button>
)

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            o.value === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const HOVER_OPTIONS: { value: HoverEffect; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'lift', label: 'Sobe' },
  { value: 'grow', label: 'Cresce' },
]

const Field: React.FC<{ title: string; value?: string; children: React.ReactNode }> = ({ title, value, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between text-[11px]">
      <span className="font-medium text-gray-700">{title}</span>
      {value && <span className="tabular-nums text-gray-500">{value}</span>}
    </div>
    {children}
  </div>
)

const select = 'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-violet-400 focus:outline-none'

/** Ajustes finos de um movimento próprio. */
const SpecEditor: React.FC<{ spec: MotionSpec; onChange: (patch: Partial<MotionSpec>) => void }> = ({ spec, onChange }) => {
  const moves = !!spec.entrance && spec.entrance !== 'none'
  const easings = spec.easing && !EASING_OPTIONS.some((o) => o.value === spec.easing) ? [...EASING_OPTIONS, { value: spec.easing, label: spec.easing }] : EASING_OPTIONS
  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
      <Field title="Entrada">
        <select className={select} value={spec.entrance ?? 'none'} onChange={(e) => onChange({ entrance: e.target.value as MotionSpec['entrance'] })}>
          {ENTRANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {moves && (
        <>
          <Field title="Duração" value={`${spec.duration ?? 1250}ms`}>
            <input type="range" min={200} max={2000} step={50} value={spec.duration ?? 1250} onChange={(e) => onChange({ duration: +e.target.value })} className="w-full accent-violet-600" />
          </Field>
          <Field title="Intervalo entre peças" value={`${spec.stagger ?? 0}ms`}>
            <input type="range" min={0} max={300} step={10} value={spec.stagger ?? 0} onChange={(e) => onChange({ stagger: +e.target.value })} className="w-full accent-violet-600" />
          </Field>
          <Field title="Curva">
            <select className={select} value={spec.easing ?? 'ease-out'} onChange={(e) => onChange({ easing: e.target.value })}>
              {easings.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <Field title="O que entra">
        <Segmented
          value={spec.animate ?? 'existing'}
          options={[
            { value: 'content', label: 'Todo o conteúdo' },
            { value: 'existing', label: 'Só o que já anima' },
          ]}
          onChange={(animate) => onChange({ animate })}
        />
      </Field>
      <Field title="Hover dos botões">
        <Segmented value={spec.hover ?? 'none'} options={HOVER_OPTIONS} onChange={(hover) => onChange({ hover })} />
      </Field>
      <Field title="Hover dos cards">
        <Segmented value={spec.cardHover ?? spec.hover ?? 'none'} options={HOVER_OPTIONS} onChange={(cardHover) => onChange({ cardHover })} />
      </Field>
    </div>
  )
}

const STATUS_DOT: Record<MotionRow['status'], string> = {
  new: 'bg-emerald-500',
  changed: 'bg-violet-500',
  removed: 'bg-gray-400',
  same: 'bg-gray-200',
}

const Row: React.FC<{ row: MotionRow; pending: boolean }> = ({ row, pending }) => (
  <li className="flex gap-2 py-1">
    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${pending ? STATUS_DOT[row.status] : 'bg-violet-400'}`} />
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium text-gray-800">{row.label}</p>
      {pending && row.status !== 'same' ? (
        <p className="text-[11px] leading-snug text-gray-500">
          <span className={row.status === 'new' ? 'text-gray-400' : 'line-through decoration-gray-300'}>{motionText(row.before)}</span>
          <span className="px-1 text-gray-400">→</span>
          <span className={row.status === 'removed' ? 'text-gray-400' : 'text-gray-900'}>{motionText(row.after)}</span>
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-gray-500">{motionText(row.after)}</p>
      )}
    </div>
  </li>
)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const MotionLevel: React.FC = () => {
  const nodes = useSpaceStore((s) => s.nodes)
  const pages = useSpaceStore((s) => s.pages)
  const connections = useSpaceStore((s) => s.connections)
  const selectedIds = useSpaceStore((s) => s.selectedIds)
  const draft = useSpaceStore((s) => s.motionDraft)
  const setMotionDraft = useSpaceStore((s) => s.setMotionDraft)
  const setSectionLevels = useSpaceStore((s) => s.setSectionLevels)
  const replayMotion = useSpaceStore((s) => s.replayMotion)
  const brand = useActiveBrand()
  const brandMotion = brand?.layers.motion

  const all = canvasSections(pages, nodes)
  const sections = all.filter((s) => selectedIds.includes(s.id))
  const saved = sections.map((s) => (s.data as SectionNodeData).levels?.motion)
  const common = saved.length && saved.every((m) => sameMotion(m, saved[0])) ? (saved[0] ?? { source: 'brand' }) : null
  const choice: SectionMotion | null = draft ?? common
  const customSpec = choice?.source === 'custom' ? choice.spec : undefined
  const preset = customSpec && presetOf(customSpec)

  // Escolher o que as seções já têm não deixa nada pendente
  const pick = (motion: SectionMotion) => setMotionDraft(saved.length && saved.every((m) => sameMotion(m, motion)) ? null : motion)
  const baseSpec = (): MotionSpec => customSpec ?? (brandMotion ? { animate: 'existing', ...brandMotion } : MOTION_PRESETS[0].spec)
  const editSpec = (patch: Partial<MotionSpec>) => pick({ source: 'custom', spec: { ...baseSpec(), ...patch } })

  const plan = useMemo(
    () =>
      sections.map((section, i) => {
        const before = sectionWithTransforms(section, nodes, connections, brand) ?? []
        const after = draft ? sectionWithTransforms(section, nodes, connections, brand, draft) ?? [] : before
        return { section, place: sectionPlace(pages, section.id), rows: motionRows(before, after), key: `${section.id}-${i}` }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, pages, connections, brand, draft, selectedIds]
  )

  const apply = () => {
    if (!draft || !sections.length) return
    const previous: Record<string, SectionLevels | undefined> = {}
    const next: Record<string, SectionLevels | undefined> = {}
    for (const section of sections) {
      const levels = (section.data as SectionNodeData).levels
      previous[section.id] = levels
      next[section.id] = { ...levels, motion: draft.source === 'brand' ? undefined : draft }
    }
    setSectionLevels(next)
    setMotionDraft(null)
    replayMotion()
    toast.success(`Movimento aplicado em ${plural(sections.length, 'seção', 'seções')}`, {
      description: 'A prévia da página e a cópia para o Elementor já usam o movimento novo.',
      action: { label: 'Desfazer', onClick: () => setSectionLevels(previous) },
    })
  }

  const counts = plan.flatMap((p) => p.rows).reduce(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { new: 0, changed: 0, removed: 0, same: 0 } as Record<MotionRow['status'], number>
  )
  const changes = counts.new + counts.changed + counts.removed

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {!sections.length && <SelectionHint>Selecione as seções que vão receber o movimento. Clique numa seção do canvas; Shift + clique junta outras.</SelectionHint>}

        <section className="space-y-2">
          <p className={label}>Origem</p>
          <Option
            active={choice?.source === 'brand'}
            title="Da marca"
            detail={brandMotion ? motionSpecText(brandMotion) : brand ? 'A marca não define movimento: fica o da seção' : 'Sem marca: fica o da seção'}
            onClick={() => pick({ source: 'brand' })}
            disabled={!sections.length}
          />
          <Option
            active={choice?.source === 'original'}
            title="Original da seção"
            detail="As animações que a seção trouxe, sem a marca"
            onClick={() => pick({ source: 'original' })}
            disabled={!sections.length}
          />
        </section>

        <section className="space-y-2">
          <p className={label}>Predefinidos</p>
          <div className="grid grid-cols-2 gap-2">
            {MOTION_PRESETS.map((p) => (
              <Option
                key={p.id}
                active={preset?.id === p.id}
                title={p.label}
                detail={p.description}
                onClick={() => pick({ source: 'custom', spec: p.spec })}
                disabled={!sections.length}
              />
            ))}
          </div>
          <Option
            active={!!customSpec && !preset}
            title="Personalizado"
            detail="Entrada, tempo, intervalo e hover do seu jeito"
            onClick={() => pick({ source: 'custom', spec: baseSpec() })}
            disabled={!sections.length}
          />
          {customSpec && <SpecEditor spec={customSpec} onChange={editSpec} />}
        </section>

        {sections.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className={label}>{draft ? 'O que vai mudar' : 'Movimento atual'}</p>
              {draft && (
                <p className="text-[11px] text-gray-500">
                  {changes ? [counts.new && `${counts.new} novas`, counts.changed && `${counts.changed} mudam`, counts.removed && `${counts.removed} param`].filter(Boolean).join(' · ') : 'nada muda'}
                </p>
              )}
            </div>
            {plan.map(({ section, place, rows, key }) => {
              const visible = draft ? rows.filter((r) => r.status !== 'same') : rows
              return (
                <div key={key} className="rounded-lg border border-gray-100">
                  <p className="flex items-baseline justify-between gap-2 border-b border-gray-100 px-3 py-1.5">
                    <span className="truncate text-[11px] font-semibold text-gray-700">
                      {place} · {(section.data as SectionNodeData).title}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">{plural(rows.filter((r) => r.after).length, 'peça anima', 'peças animam')}</span>
                  </p>
                  {visible.length ? (
                    <ul className="px-3 py-1">
                      {visible.map((row) => (
                        <Row key={row.id + row.label} row={row} pending={!!draft} />
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-[11px] text-gray-400">{draft ? 'Nada muda nesta seção.' : 'Nenhuma peça anima.'}</p>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={replayMotion} title="Rever as animações nas miniaturas">
          <Play className="h-3.5 w-3.5" />
          Tocar
        </Button>
        <div className="flex-1" />
        {draft && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMotionDraft(null)}>
            Descartar
          </Button>
        )}
        <Button size="sm" className="h-8 text-xs" disabled={!draft || !sections.length} onClick={apply}>
          {sections.length ? `Aplicar em ${plural(sections.length, 'seção', 'seções')}` : 'Aplicar'}
        </Button>
      </footer>
    </>
  )
}
