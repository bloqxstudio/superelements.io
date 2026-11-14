import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy as CopyIcon, Loader2, MoreHorizontal, Plus, Presentation, Search, Trash2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { createBoard, deleteBoard, duplicateBoard, fileUrl, listBoards, type BoardSummary } from '@/features/quadros/data'
import { TEMPLATES, type TemplateArt } from '@/features/quadros/templates'
import '@/features/quadros/quadros.css'

/**
 * /quadros — os quadros livres da conta aberta (estilo Miro/FigJam): criar em branco ou por modelo,
 * abrir, duplicar e apagar. O quadro em si é `src/features/quadros/BoardEditor.tsx`.
 */

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const Thumb: React.FC<{ path?: string }> = ({ path }) => {
  const [src, setSrc] = useState<string>()
  useEffect(() => { let live = true; if (path) void fileUrl(path).then((u) => live && setSrc(u)).catch(() => {}); return () => { live = false } }, [path])
  if (!src) return <div className="qd-thumb-empty"><Presentation className="h-6 w-6" /></div>
  return <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
}

const Boards: React.FC = () => {
  const team = useCrm((s) => s.team)
  const navigate = useNavigate()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [query, setQuery] = useState('')

  const reload = useCallback(async () => {
    if (!team) return
    try { setBoards(await listBoards(team.id)); setError(undefined) } catch (e) { setError((e as Error).message) }
  }, [team])
  useEffect(() => { setBoards(null); void reload() }, [reload])

  const create = async (template?: string) => {
    if (!team || busy) return
    setBusy(template ?? 'blank')
    try {
      const t = TEMPLATES.find((x) => x.id === template)
      const id = t
        ? await (await import('@/features/quadros/compose')).createBoardFrom(team.id, t.name, t.draft())
        : await createBoard(team.id, 'Quadro sem título')
      navigate(`/quadros/${id}`)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(undefined) }
  }

  const duplicate = async (b: BoardSummary) => {
    if (!team) return
    try { await duplicateBoard(team.id, b.id); toast.success('Quadro duplicado'); void reload() } catch (e) { toast.error((e as Error).message) }
  }

  const remove = async (b: BoardSummary) => {
    if (!team || !window.confirm(`Apagar "${b.title}"? Não dá para desfazer.`)) return
    try { await deleteBoard(team.id, b.id); setBoards((list) => list?.filter((x) => x.id !== b.id) ?? null) } catch (e) { toast.error((e as Error).message) }
  }

  if (!team) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-gray-500 md:px-6">Abra uma conta para ver os quadros.</div>

  const shown = (boards ?? []).filter((b) => b.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Quadros</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Canvas livre para planejar e soltar ideias: notas adesivas, formas, setas, desenho e imagens. Quem é da conta edita junto, ao vivo.</p>
        </div>
        <Button onClick={() => void create()} disabled={!!busy}>
          {busy === 'blank' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo quadro
        </Button>
      </div>

      <section className="mt-8" aria-label="Começar por um modelo">
        <h2 className="text-sm font-medium text-gray-700">Começar por um modelo</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => void create(t.id)} disabled={!!busy} className="qd-template">
              <span className="qd-template-art" aria-hidden>{busy === t.id ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" /> : <TemplateArtSvg art={t.art} />}</span>
              <span className="block text-sm font-medium text-gray-900">{t.name}</span>
              <span className="block text-xs text-gray-500">{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-label="Quadros da conta">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-700">Quadros da conta{boards ? ` (${boards.length})` : ''}</h2>
          {(boards?.length ?? 0) > 4 && (
            <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 sm:w-auto">
              <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar quadro" aria-label="Buscar quadro" className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
            </label>
          )}
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!boards && !error && <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
        {boards && boards.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">Nenhum quadro ainda</p>
            <p className="mt-1 text-sm text-gray-500">Crie um em branco ou comece por um modelo acima.</p>
          </div>
        )}
        {shown.length > 0 && (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((b) => (
              <li key={b.id} className="qd-card group">
                <Link to={`/quadros/${b.id}`} className="block">
                  <div className="qd-thumb"><Thumb path={b.thumbPath} /></div>
                  <div className="px-3.5 pb-3 pt-2.5 pr-10">
                    <p className="truncate text-sm font-medium text-gray-900">{b.title}</p>
                    <p className="text-xs text-gray-500">Editado {fmt(b.updatedAt)}</p>
                  </div>
                </Link>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button type="button" aria-label={`Ações de ${b.title}`} className="absolute bottom-3 right-2.5 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-lg">
                      <DropdownMenu.Item onSelect={() => void duplicate(b)} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-gray-100">
                        <CopyIcon className="h-3.5 w-3.5" /> Duplicar
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => void remove(b)} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-red-600 outline-none data-[highlighted]:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Apagar
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default Boards

/** O desenho pequeno de cada modelo: mapa com ligações, colunas, fluxo com setas ou grade de cartões. */
function TemplateArtSvg({ art }: { art: TemplateArt }) {
  const c = art.colors
  const cardEl = (x: number, y: number, w: number, h: number, color: string, key: string | number) => (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#fff" stroke="#e2e0da" strokeWidth={0.8} />
      <rect x={x + 1} y={y + 3} width={1.6} height={h - 6} fill={color} style={{ filter: 'saturate(2.2) brightness(.8)' }} />
      <circle cx={x + 6} cy={y + 6} r={2} fill={color} style={{ filter: 'saturate(2.2) brightness(.8)' }} />
      <rect x={x + 10} y={y + 5} width={w - 14} height={2} rx={1} fill="#cfcdc6" />
    </g>
  )
  let body: React.ReactNode
  if (art.kind === 'mapa') {
    const pts = c.map((_, i) => { const a = (i / c.length) * Math.PI * 2 - Math.PI / 2; return [80 + Math.cos(a) * 52, 45 + Math.sin(a) * 30] })
    body = <>
      {pts.map(([x, y], i) => <line key={`l${i}`} x1={80} y1={45} x2={x} y2={y} stroke="#c9c7c0" strokeWidth={0.8} />)}
      <ellipse cx={80} cy={45} rx={16} ry={9} fill="#1e1e1e" />
      {pts.map(([x, y], i) => cardEl(x - 11, y - 6, 22, 12, c[i], i))}
    </>
  } else if (art.kind === 'colunas') {
    const w = Math.min(28, 140 / c.length - 4)
    body = c.map((color, i) => {
      const x = 10 + i * ((140) / c.length) + 2
      return <g key={i}>
        <rect x={x} y={14} width={w} height={64} rx={3} fill="#ecebe7" />
        <rect x={x} y={8} width={w * 0.6} height={3} rx={1.5} fill="#a8a6a0" />
        {cardEl(x + 2, 18, w - 4, 14, color, 'a')}
        {i % 2 === 0 && cardEl(x + 2, 35, w - 4, 14, color, 'b')}
      </g>
    })
  } else if (art.kind === 'fluxo') {
    const n = c.length, w = 22, gap = (140 - n * w) / (n - 1)
    body = c.map((color, i) => {
      const x = 10 + i * (w + gap)
      return <g key={i}>
        {i > 0 && <path d={`M${x - gap + 2} 45 H${x - 2.5} m-3 -2.5 l3 2.5 l-3 2.5`} stroke="#8a8983" strokeWidth={0.9} fill="none" />}
        {cardEl(x, 36, w, 18, color, 'c')}
      </g>
    })
  } else {
    body = c.map((color, i) => cardEl(18 + (i % 3) * 44, 18 + Math.floor(i / 3) * 30, 38, 24, color, i))
  }
  return <svg viewBox="0 0 160 90" className="h-full w-full">{body}</svg>
}
