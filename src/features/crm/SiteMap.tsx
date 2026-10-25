import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MapPin } from 'lucide-react'
import { money } from './ads'
import { BR_SHAPES, BR_VIEWBOX } from './brazilShapes'
import { compact, percent } from './instagram'
import { countryLabel, isLiveSession, pathLabel, placeLabel, type EndpointInfo, type SessionFilter, type SiteReport, type SiteSession } from './site'
import { UF_NAME, inBrazil, projectBr, ufOf } from './siteGeo'
import { metaByUf, type MetaView } from './siteMeta'
import { Surface, plural } from './ui'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'

/**
 * O mapa do painel Site: os estados pintados pelas visitas do período (ou
 * pelo que a Meta conta dos anúncios em cada estado), as cidades em bolhas e
 * quem está no site agora piscando no lugar dele. Clicar num estado aproxima
 * e mostra as cidades; a lista ao lado faz o mesmo pelo teclado. A cidade sai
 * do IP (função `site-visitas` com a MaxMind): visitas de antes, ou sem a
 * MaxMind, ficam em "sem localização".
 */

type Layer = 'site' | 'meta'
type MetaMetric = 'linkClicks' | 'impressions' | 'spend'

const META_METRIC: Record<MetaMetric, string> = { linkClicks: 'Cliques no link', impressions: 'Impressões', spend: 'Valor usado' }

type Box = [number, number, number, number]

const SITE_INK = '24, 24, 27'
const META_INK = '37, 99, 235'
const EMPTY = '#f1f1f3'

/** O estado com folga em volta, sem aproximar demais um estado pequeno */
function boxOf(uf: string | null): Box {
  const shape = uf ? BR_SHAPES.find((s) => s.uf === uf) : undefined
  if (!shape) return BR_VIEWBOX
  const [x0, y0, x1, y1] = shape.box
  const size = Math.max(x1 - x0, y1 - y0, 90) * 1.25
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  return [cx - size / 2, cy - size / 2, size, size]
}

/** A caixa que junta os estados com números, quadrada e com folga; perto do país inteiro, o país inteiro */
function fitBox(ufs: string[]): Box {
  const boxes = BR_SHAPES.filter((s) => ufs.includes(s.uf)).map((s) => s.box)
  if (!boxes.length) return BR_VIEWBOX
  const x0 = Math.min(...boxes.map((b) => b[0]))
  const y0 = Math.min(...boxes.map((b) => b[1]))
  const x1 = Math.max(...boxes.map((b) => b[2]))
  const y1 = Math.max(...boxes.map((b) => b[3]))
  const size = Math.max(x1 - x0, y1 - y0, 220) * 1.2
  if (size > Math.max(BR_VIEWBOX[2], BR_VIEWBOX[3]) * 0.7) return BR_VIEWBOX
  return [(x0 + x1) / 2 - size / 2, (y0 + y1) / 2 - size / 2, size, size]
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** O viewBox anda até o novo enquadramento (sem animação com movimento reduzido) */
function useViewBox(target: Box) {
  const [box, setBox] = useState<Box>(target)
  const current = useRef(box)
  current.current = box
  useEffect(() => {
    const from = current.current
    if (reducedMotion()) return setBox(target)
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 380)
      const e = 1 - Math.pow(1 - t, 3)
      setBox(from.map((v, i) => v + (target[i] - v) * e) as Box)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(',')])
  return box
}

/** Quantas unidades do mapa cabem num pixel da tela (para bolhas e letras do mesmo tamanho em qualquer zoom) */
function useUnit(ref: React.RefObject<SVGSVGElement>, box: Box) {
  const [size, setSize] = useState({ w: 600, h: 520 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width || 600, h: entry.contentRect.height || 520 }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return 1 / Math.min(size.w / box[2], size.h / box[3])
}

interface Tip {
  x: number
  y: number
  title: string
  lines: string[]
}

export const SiteMap: React.FC<{
  report: SiteReport
  live: SiteSession[]
  meta?: MetaView
  endpoint?: EndpointInfo
  onVisits: (filter: Partial<SessionFilter>) => void
  onOpenSession: (session: SiteSession) => void
}> = ({ report, live, meta, endpoint, onVisits, onOpenSession }) => {
  const [layer, setLayer] = useState<Layer>('site')
  const [metric, setMetric] = useState<MetaMetric>('linkClicks')
  const [selected, setSelected] = useState<string | null>(null)
  const [whole, setWhole] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const currency = meta?.currency ?? 'BRL'

  const site = useMemo(() => {
    const byUf = new Map<string, { sessions: number; visitors: number; converted: number; meta: number }>()
    let located = 0
    for (const r of report.regions) {
      located += r.sessions
      const uf = r.country === 'BR' ? ufOf(r.region) : undefined
      if (!uf) continue
      const current = byUf.get(uf) ?? { sessions: 0, visitors: 0, converted: 0, meta: 0 }
      byUf.set(uf, { sessions: current.sessions + r.sessions, visitors: current.visitors + r.visitors, converted: current.converted + r.converted, meta: current.meta + r.meta })
    }
    return { byUf, unknown: Math.max(0, report.totals.sessions - located) }
  }, [report])
  const metaUf = useMemo(() => (meta ? metaByUf(meta) : new Map()), [meta])
  const hasMeta = metaUf.size > 0
  const showMeta = layer === 'meta' && hasMeta

  const valueOf = (uf: string) => (showMeta ? (metaUf.get(uf)?.[metric] ?? 0) : (site.byUf.get(uf)?.sessions ?? 0))
  const max = Math.max(1, ...BR_SHAPES.map((s) => valueOf(s.uf)))
  const format = (n: number) => (showMeta && metric === 'spend' ? money(n, currency, true) : compact(n))

  const cities = useMemo(() => report.cities.filter((c) => c.country === 'BR' && Number.isFinite(c.lat) && inBrazil(c.lat, c.lon)), [report.cities])
  const maxCity = Math.max(1, ...cities.map((c) => c.sessions))
  const foreign = report.countries.filter((c) => c.key && c.key !== 'BR')

  const liveDots = useMemo(
    () =>
      live
        .filter(isLiveSession)
        .map((s) => {
          if (s.lat !== undefined && s.lon !== undefined && inBrazil(s.lat, s.lon)) return { s, at: projectBr(s.lat, s.lon) }
          const shape = BR_SHAPES.find((b) => b.uf === ufOf(s.region))
          return shape && s.country === 'BR' ? { s, at: [shape.cx, shape.cy] as [number, number] } : undefined
        })
        .filter((d): d is { s: SiteSession; at: [number, number] } => !!d),
    [live]
  )

  const ranking = BR_SHAPES.map((s) => ({ uf: s.uf, value: valueOf(s.uf) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  // Abre aproximado nos estados com números (e em quem está no site agora); "Brasil inteiro" mostra tudo
  const withData = [...ranking.map((r) => r.uf), ...liveDots.map((d) => ufOf(d.s.region)).filter((uf): uf is string => !!uf)]
  const fit = useMemo(() => fitBox(withData), [withData.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const zoomable = fit !== BR_VIEWBOX
  const box = useViewBox(selected ? boxOf(selected) : whole || !zoomable ? BR_VIEWBOX : fit)
  const unit = useUnit(svgRef, box)

  const point = (e: React.PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 }
  }
  const stateLines = (uf: string) => {
    const s = site.byUf.get(uf)
    const m = metaUf.get(uf)
    const lines = [s ? `${plural(s.sessions, 'visita', 'visitas')} · ${plural(s.converted, 'contato', 'contatos')}` : 'Nenhuma visita com localização']
    if (m) lines.push(`Meta: ${compact(m.linkClicks)} cliques no link · ${money(m.spend, currency, true)}`)
    return lines
  }

  const sel = selected ? { site: site.byUf.get(selected), meta: metaUf.get(selected), cities: cities.filter((c) => ufOf(c.region) === selected) } : undefined
  const ink = showMeta ? META_INK : SITE_INK
  const noGeo = report.totals.sessions > 0 && report.regions.length === 0

  return (
    <Surface
      title="Mapa"
      action={
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip active={!showMeta} onClick={() => setLayer('site')} className="h-7 px-2.5 text-xs">
            Visitas do site
          </Chip>
          {hasMeta && (
            <Chip active={showMeta} onClick={() => setLayer('meta')} className="h-7 px-2.5 text-xs">
              Anúncios da Meta
            </Chip>
          )}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div ref={wrapRef} className="relative">
          <svg
            ref={svgRef}
            viewBox={box.join(' ')}
            preserveAspectRatio="xMidYMid meet"
            className="h-[360px] w-full touch-manipulation select-none sm:h-[460px]"
            role="img"
            aria-label={`Mapa do Brasil com ${showMeta ? `${META_METRIC[metric].toLowerCase()} da Meta` : 'as visitas do site'} por estado${liveDots.length ? `; ${liveDots.length} no site agora` : ''}`}
            onPointerLeave={() => setTip(null)}
          >
            <g>
              {BR_SHAPES.map((shape) => {
                const v = valueOf(shape.uf)
                const t = v > 0 ? Math.sqrt(v / max) : 0
                return (
                  <path
                    key={shape.uf}
                    d={shape.d}
                    fill={v > 0 ? `rgba(${ink}, ${0.1 + 0.75 * t})` : EMPTY}
                    stroke={selected === shape.uf ? '#18181b' : '#ffffff'}
                    strokeWidth={selected === shape.uf ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer transition-[fill] duration-200 hover:brightness-95"
                    onClick={() => setSelected((current) => (current === shape.uf ? null : shape.uf))}
                    onPointerMove={(e) => setTip({ ...point(e), title: UF_NAME[shape.uf], lines: stateLines(shape.uf) })}
                  />
                )
              })}
            </g>
            <g aria-hidden>
              {BR_SHAPES.filter((s) => valueOf(s.uf) > 0 || selected === s.uf).map((s) => {
                const t = Math.sqrt(valueOf(s.uf) / max)
                return (
                  <text
                    key={s.uf}
                    x={s.cx}
                    y={s.cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10 * unit}
                    fontWeight={600}
                    fill={t > 0.55 ? '#ffffff' : '#52525b'}
                    className="pointer-events-none"
                  >
                    {s.uf}
                  </text>
                )
              })}
            </g>
            {!showMeta && (
              <g>
                {cities.map((c) => {
                  const [x, y] = projectBr(c.lat, c.lon)
                  const r = (3 + 12 * Math.sqrt(c.sessions / maxCity)) * unit
                  return (
                    <circle
                      key={`${c.region}-${c.city}`}
                      cx={x}
                      cy={y}
                      r={r}
                      fill={c.converted ? 'rgba(5, 150, 105, 0.85)' : 'rgba(250, 250, 250, 0.92)'}
                      stroke={c.converted ? '#ffffff' : '#18181b'}
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                      onPointerMove={(e) =>
                        setTip({ ...point(e), title: `${c.city}${c.region ? `, ${c.region}` : ''}`, lines: [`${plural(c.sessions, 'visita', 'visitas')} · ${plural(c.visitors, 'pessoa', 'pessoas')}`, plural(c.converted, 'contato', 'contatos')] })
                      }
                      onClick={() => onVisits({ region: ufOf(c.region) ?? c.region ?? undefined, city: c.city })}
                      className="cursor-pointer"
                    />
                  )
                })}
              </g>
            )}
            <g>
              {liveDots.map(({ s, at: [x, y] }) => (
                <g
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => onOpenSession(s)}
                  onPointerMove={(e) =>
                    setTip({ ...point(e), title: `No site agora · ${placeLabel(s)}`, lines: [`Em ${pathLabel(s.exit ?? s.landing)}`, [s.channel, s.device].filter(Boolean).join(' · ')] })
                  }
                >
                  <circle cx={x} cy={y} r={7 * unit} fill="rgba(16, 185, 129, 0.35)" className="motion-safe:animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                  <circle cx={x} cy={y} r={4.5 * unit} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          </svg>

          {!selected && zoomable && (
            <button
              type="button"
              onClick={() => setWhole((w) => !w)}
              className="absolute left-0 top-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200 hover:text-gray-900"
            >
              {whole ? 'Aproximar' : 'Brasil inteiro'}
            </button>
          )}

          {tip && (
            <div
              className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: Math.min(tip.x + 12, (wrapRef.current?.clientWidth ?? 600) - 240), top: tip.y + 12 }}
            >
              <p className="font-semibold">{tip.title}</p>
              {tip.lines.filter(Boolean).map((line) => (
                <p key={line} className="text-zinc-300">
                  {line}
                </p>
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-1 left-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {!showMeta && cities.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-zinc-900 bg-white" /> cidade
                <span className="ml-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600" /> com contato
              </span>
            )}
            {liveDots.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {liveDots.length} no site agora
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {showMeta && (
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Número da Meta">
              {(Object.keys(META_METRIC) as MetaMetric[]).map((m) => (
                <Chip key={m} active={metric === m} onClick={() => setMetric(m)} className="h-7 px-2.5 text-xs">
                  {META_METRIC[m]}
                </Chip>
              ))}
            </div>
          )}

          {selected && sel ? (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button type="button" onClick={() => setSelected(null)} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900">
                    <ArrowLeft className="h-3.5 w-3.5" /> Todos os estados
                  </button>
                  <h3 className="text-base font-semibold text-gray-900">{UF_NAME[selected]}</h3>
                </div>
                {sel.site && (
                  <button type="button" onClick={() => onVisits({ region: selected })} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                    Ver as visitas
                  </button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
                <Num label="Visitas" value={compact(sel.site?.sessions ?? 0)} sub={plural(sel.site?.visitors ?? 0, 'pessoa', 'pessoas')} />
                <Num label="Contatos" value={compact(sel.site?.converted ?? 0)} sub={sel.site?.sessions ? `${percent((sel.site.converted ?? 0) / sel.site.sessions, 0)} das visitas` : undefined} />
                {sel.meta && (
                  <>
                    <Num label="Cliques no link (Meta)" value={compact(sel.meta.linkClicks)} sub={`${money(sel.meta.spend, currency, true)} usados`} />
                    <Num
                      label="Chegaram ao site"
                      value={compact(sel.site?.meta ?? 0)}
                      sub={sel.meta.linkClicks ? arrivalText((sel.site?.meta ?? 0) / sel.meta.linkClicks) : undefined}
                    />
                  </>
                )}
              </dl>
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Cidades</h4>
                {sel.cities.length ? (
                  <ul className="grid gap-1">
                    {sel.cities.slice(0, 10).map((c) => (
                      <li key={c.city}>
                        <button
                          type="button"
                          onClick={() => onVisits({ region: selected, city: c.city })}
                          className="-mx-2 flex w-[calc(100%+16px)] items-baseline justify-between gap-3 rounded-md px-2 py-1 text-left text-sm hover:bg-zinc-50"
                        >
                          <span className="min-w-0 truncate text-gray-800">{c.city}</span>
                          <span className="shrink-0 tabular-nums text-gray-900">
                            {compact(c.sessions)}
                            {c.converted > 0 && <span className="ml-1.5 text-xs font-medium text-emerald-700">{plural(c.converted, 'contato', 'contatos')}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma cidade identificada neste estado.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{showMeta ? `${META_METRIC[metric]} por estado` : 'Visitas por estado'}</h3>
                {ranking.length ? (
                  <ul className="grid gap-0.5">
                    {ranking.slice(0, 10).map((r) => {
                      const s = site.byUf.get(r.uf)
                      return (
                        <li key={r.uf}>
                          <button
                            type="button"
                            onClick={() => setSelected(r.uf)}
                            className="-mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate text-gray-700">
                                {UF_NAME[r.uf]}
                                <span className="ml-1.5 text-xs text-gray-400">
                                  {showMeta ? (s?.meta ? `${compact(s.meta)} chegaram ao site` : '') : s?.converted ? plural(s.converted, 'contato', 'contatos') : ''}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-gray-900">{format(r.value)}</span>
                            </span>
                            <span className="block h-1.5 rounded-r bg-gray-100" aria-hidden>
                              <span className="block h-1.5 rounded-r" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: `rgb(${ink})` }} />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{showMeta ? 'A Meta não mandou estados neste período.' : 'Nenhuma visita com localização neste período.'}</p>
                )}
              </div>

              {!showMeta && (foreign.length > 0 || site.unknown > 0) && (
                <div className="grid gap-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  {foreign.length > 0 && <p>Fora do Brasil: {foreign.slice(0, 6).map((c) => `${countryLabel(c.key)} ${c.sessions}`).join(' · ')}</p>}
                  {site.unknown > 0 && <p>{plural(site.unknown, 'visita', 'visitas')} sem cidade ou estado.</p>}
                </div>
              )}
              {showMeta && <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">A Meta conta por estado, sem cidade. "Chegaram ao site": visitas que vieram de anúncio da Meta, pela localização do IP.</p>}
            </div>
          )}

          {noGeo && <GeoHint endpoint={endpoint} mapReady={report.mapReady} />}
        </div>
      </div>
    </Surface>
  )
}

/** Mais visitas que cliques acontece (a mesma pessoa volta pelo anúncio; a Meta conta até ontem) */
const arrivalText = (ratio: number) => (ratio <= 1 ? `${percent(ratio, 0)} dos cliques` : 'mais visitas que cliques')

const Num: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums text-gray-900">{value}</dd>
    {sub && <dd className="text-xs text-gray-500">{sub}</dd>}
  </div>
)

/** Ainda sem localização: o que falta ligar */
const GeoHint: React.FC<{ endpoint?: EndpointInfo; mapReady: boolean }> = ({ endpoint, mapReady }) => (
  <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20">
    <p className="flex items-center gap-1.5 font-semibold">
      <MapPin className="h-3.5 w-3.5" /> As visitas ainda não têm cidade
    </p>
    {mapReady && endpoint?.status === 'ok' && (endpoint.version ?? 1) >= 2 && endpoint.geo ? (
      <p className="mt-1">A localização está ligada: as próximas visitas chegam com cidade e estado.</p>
    ) : (
      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
        <li>Aplicar a migração 20261025230000_site_visitas_mapa.sql.</li>
        <li>Criar uma conta grátis no GeoLite da MaxMind e gerar uma chave de licença.</li>
        <li>Pôr os segredos MAXMIND_ACCOUNT_ID e MAXMIND_LICENSE_KEY no Supabase.</li>
        <li>Publicar de novo a função site-visitas (com --no-verify-jwt).</li>
      </ol>
    )}
  </div>
)
