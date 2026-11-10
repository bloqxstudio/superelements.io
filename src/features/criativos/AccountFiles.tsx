import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FolderOpen, Image as ImageIcon, Images, Loader2, Package, Search, Shapes, Sparkles, Stamp, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { uploadFiles } from '@/features/cerebro/data'
import { dirOf, fileName, type VaultMedia } from '@/features/cerebro/vault'
import { FORM_ICONS, iconPng, searchIcons } from './icons'
import { iconComponent, loadIcons, refreshAccount, refreshPosts, useInsumos } from './insumos'
import { LIBRARY } from './library'
import { uploadAsset, type Where } from './storage'
import { useEditor } from './store'
import type { CreativeSet, SetAsset } from './types'

/**
 * Os insumos da conta dentro do editor de post (2026-11-10, o usuário: "quero acesso aos arquivos da conta
 * direto no editor de post… puxar um logo ou imagem diretamente, sem depender de pedir pro agente" e depois
 * "queria ter mais insumos ali, como ícones, logos, talvez já em grupos, daquela empresa, pra conseguir ver
 * e usar o insumo"). Grupos: Logos (a marca do conjunto, a marca da conta e os arquivos do Cérebro com
 * logo/marca no caminho), Ícones (Lucide na cor da marca, mais os ícones guardados no Cérebro), Produtos
 * (pastas produtos/ do Cérebro), Fotos e imagens (o resto do Cérebro, por pasta), Usadas nos posts (lida só
 * quando o grupo abre) e, só na conta da casa, a biblioteca da Avence (cases e ilustrações).
 * Escolher copia o arquivo para a pasta do conjunto: o post não depende do link assinado (7 dias) nem do
 * arquivo continuar no Cérebro. Caminhos públicos do app (`/brands/…`) e `asset:` do conjunto ficam como estão.
 */

const NO_LOGOS: never[] = []

type Group = 'logos' | 'icones' | 'produtos' | 'fotos' | 'posts' | 'biblioteca'
export interface Picked { src: string; name: string; width: number; height: number; asset?: SetAsset; kind: 'logo' | 'icone' | 'imagem' }
interface Item { key: string; url: string; name: string; folder: string; src?: string }

const GROUPS: { id: Group; label: string; icon: React.ComponentType<{ className?: string }>; upload?: string }[] = [
  { id: 'logos', label: 'Logos', icon: Stamp, upload: 'marca/logos' },
  { id: 'icones', label: 'Ícones', icon: Shapes, upload: 'marca/icones' },
  { id: 'produtos', label: 'Produtos', icon: Package, upload: 'produtos' },
  { id: 'fotos', label: 'Fotos e imagens', icon: ImageIcon, upload: 'arquivos' },
  { id: 'posts', label: 'Usadas nos posts', icon: Images },
  { id: 'biblioteca', label: 'Biblioteca da casa', icon: Sparkles },
]

const isLogo = (p: string) => /(^|[/_-])(logos?|marcas?|logotipos?|simbolos?|brand)([/_.-]|$)/i.test(p) || /logo/i.test(fileName(p))
const isIconFile = (p: string) => /(^|\/)(icones?|icons?)(\/|$)/i.test(p)
const isProduct = (p: string) => /(^|\/)produtos?(\/|$)/i.test(p)

const sizeOfImage = (url: string) =>
  new Promise<{ width: number; height: number }>((ok, fail) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok({ width: img.naturalWidth || 800, height: img.naturalHeight || 800 })
    img.onerror = () => fail(new Error('Não consegui abrir a imagem.'))
    img.src = url
  })

/** SVG vira PNG (até 1600 px): o editor desenha no canvas e o envio lê o tamanho do bitmap. */
async function svgToPng(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = img.naturalWidth || 800
    const h = img.naturalHeight || 800
    const k = 1600 / Math.max(w, h)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * k)
    canvas.height = Math.round(h * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
    if (!png) throw new Error('Não consegui converter o SVG.')
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Traz a imagem escolhida para o conjunto. */
export async function bringToSet(set: Where & Pick<CreativeSet, 'assets'>, url: string, name: string, src?: string): Promise<Omit<Picked, 'kind'>> {
  if (src?.startsWith('asset:')) {
    const a = set.assets.find((x) => x.id === src.slice(6))
    if (a) return { src, name: a.name, width: a.width, height: a.height }
  }
  if (url.startsWith('/')) return { src: url, name, ...(await sizeOfImage(url)) }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Não consegui baixar a imagem da conta.')
  let blob = await res.blob()
  let finalName = name
  if (blob.type === 'image/svg+xml' || /\.svg$/i.test(name)) {
    blob = await svgToPng(blob)
    finalName = name.replace(/\.svg$/i, '') + '.png'
  }
  const asset = await uploadAsset(set, blob, finalName)
  return { src: `asset:${asset.id}`, name: finalName, width: asset.width, height: asset.height, asset }
}

/** Endereço que o navegador mostra para um logo da marca (link, caminho do app ou arquivo do conjunto já carregado). */
function viewUrl(src: string): string | undefined {
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src
  if (src.startsWith('asset:')) {
    const el = useEditor.getState().images.get(src) as (HTMLImageElement | undefined)
    return el && 'src' in el ? el.src : undefined
  }
  return undefined
}

/** Miniatura: o fundo aparece na hora e a imagem entra com um fade quando chega (sem pular). */
const Tile: React.FC<{ item: Item; busy: boolean; onClick: () => void; dark?: boolean }> = ({ item, busy, onClick, dark }) => {
  const [ready, setReady] = useState(false)
  return (
    <button type="button" disabled={busy} onClick={onClick} title={item.name} className="group relative overflow-hidden rounded-lg border border-gray-200 text-left transition-shadow hover:border-violet-400 hover:ring-2 hover:ring-violet-200 disabled:opacity-60">
      <span className={cn('block', dark ? 'bg-gray-900' : ready ? 'bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px]' : 'animate-pulse bg-gray-100')}>
        <img src={item.url} alt={item.name} loading="lazy" decoding="async" onLoad={() => setReady(true)} className={cn('aspect-square w-full object-contain p-2 transition-opacity duration-300', ready ? 'opacity-100' : 'opacity-0')} />
      </span>
      <span className="block truncate border-t border-gray-100 bg-white px-1.5 py-1 text-[11px] text-gray-600">{item.name}</span>
    </button>
  )
}

/** Ícone desenhado direto (troca de cor e traço sem refazer nada). */
const IconTile: React.FC<{ name: string; color: string; stroke: number; busy: boolean; loading: boolean; onClick: () => void }> = ({ name, color, stroke, busy, loading, onClick }) => {
  const Icon = iconComponent(name)
  return (
    <button type="button" disabled={busy} title={name} onClick={onClick} className={cn('relative flex aspect-square items-center justify-center rounded-lg border border-gray-200 transition-colors hover:border-violet-400 hover:ring-2 hover:ring-violet-200 disabled:opacity-60', color === '#ffffff' ? 'bg-gray-800' : 'bg-white')}>
      {Icon ? <Icon color={color} size={28} strokeWidth={stroke} /> : <span className="h-7 w-7 animate-pulse rounded bg-gray-100" />}
      {loading && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70"><Loader2 className="h-4 w-4 animate-spin text-violet-600" /></span>}
    </button>
  )
}

export const AccountFiles: React.FC<{
  open: boolean
  onClose: () => void
  /** Recebe o insumo já copiado para o conjunto. */
  onPick: (p: Picked) => Promise<void> | void
  set: CreativeSet
  title?: string
  /** Tamanho do ícone no post (px), para o PNG sair nítido. */
  iconSize?: number
}> = ({ open, onClose, onPick, set, title, iconSize = 120 }) => {
  const team = useCrm((s) => s.team)
  const [group, setGroup] = useState<Group>('logos')
  const files = useInsumos((s) => (s.team === team?.id ? s.files : undefined))
  const postImgs = useInsumos((s) => (s.team === team?.id ? s.posts : undefined))
  const accountLogos = useInsumos((s) => (s.team === team?.id ? s.logos : NO_LOGOS))
  const loadingFiles = useInsumos((s) => s.loadingFiles)
  const loadingPosts = useInsumos((s) => s.loadingPosts)
  const error = useInsumos((s) => s.error ?? '')
  const [folder, setFolder] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [icons, setIcons] = useState<string[]>([...FORM_ICONS])
  const [, setIconsReady] = useState(0)
  const colors = useMemo(() => [...new Set([...set.brand.colors.map((c) => c.hex.toLowerCase()), '#111111', '#ffffff'])], [set.brand.colors])
  const [color, setColor] = useState(colors[0] ?? '#111111')
  const [stroke, setStroke] = useState(1.75)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { setFolder('') }, [team?.id])
  useEffect(() => { setFolder(''); setQuery('') }, [group])

  // Abre na hora com a cópia guardada; relê por trás
  useEffect(() => {
    if (open && team) void refreshAccount(team)
  }, [open, team])
  useEffect(() => {
    if (open && team && group === 'posts') void refreshPosts(team)
  }, [open, team, group])

  // Logos: os da marca do conjunto e os da marca da conta (sem repetir)
  const brandLogos = useMemo(() => {
    const fromSet = (['logoOnLight', 'logoOnDark'] as const).flatMap((k) => (set.brand[k] ? [{ key: `set-${k}`, src: set.brand[k]!, name: k === 'logoOnLight' ? 'Logo para fundo claro' : 'Logo para fundo escuro', folder: 'Marca deste conjunto' }] : []))
    const fromAccount = accountLogos.filter((l) => !fromSet.some((f) => f.src === l.src)).map((l) => ({ ...l, folder: 'Marca da conta' }))
    return [...fromSet, ...fromAccount].flatMap((l) => { const url = viewUrl(l.src); return url ? [{ ...l, url }] : [] })
  }, [set.brand, accountLogos])

  // Ícones: busca (português ou inglês); cada ícone carrega uma vez e fica guardado
  useEffect(() => {
    if (group !== 'icones') return
    const t = setTimeout(() => void searchIcons(query, 60).then(setIcons), query.trim() ? 150 : 0)
    return () => clearTimeout(t)
  }, [query, group])
  useEffect(() => {
    if (!open || group !== 'icones') return
    let alive = true
    void loadIcons(icons).then(() => alive && setIconsReady((n) => n + 1))
    return () => { alive = false }
  }, [open, group, icons])

  const accountFiles = files ?? []
  const toItem = (m: VaultMedia): Item => ({ key: m.path, url: m.url!, name: fileName(m.path), folder: dirOf(m.path) || 'Raiz' })
  const lists: Record<Group, Item[]> = useMemo(() => ({
    logos: [...brandLogos, ...accountFiles.filter((m) => isLogo(m.path)).map(toItem)],
    icones: accountFiles.filter((m) => isIconFile(m.path) && !isLogo(m.path)).map(toItem),
    produtos: accountFiles.filter((m) => isProduct(m.path) && !isLogo(m.path)).map(toItem),
    fotos: accountFiles.filter((m) => !isLogo(m.path) && !isIconFile(m.path) && !isProduct(m.path)).map(toItem),
    posts: (postImgs ?? []).map((m) => ({ key: m.path, url: m.url!, name: fileName(m.path), folder: m.label || 'Posts' })),
    biblioteca: LIBRARY.map((i) => ({ key: i.id, url: i.src, src: i.src, name: i.label, folder: i.group })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [brandLogos, files, postImgs])
  const loading = group === 'posts' ? (loadingPosts && !postImgs ? 'posts' : '') : loadingFiles && !files ? 'conta' : ''

  const groups = GROUPS.filter((g) => g.id !== 'biblioteca' || team?.isHome)
  const all = lists[group]
  const folders = [...new Set(all.map((i) => i.folder))]
  const q = query.trim().toLowerCase()
  const shown = all.filter((i) => (!folder || i.folder === folder) && (!q || `${i.name} ${i.folder}`.toLowerCase().includes(q)))
  const byFolder = folders.map((f) => [f, shown.filter((i) => i.folder === f)] as const).filter(([, l]) => l.length)
  const count = (g: Group) => (g === 'icones' ? lists.icones.length + FORM_ICONS.length : (g === 'posts' && !postImgs) || (g !== 'biblioteca' && g !== 'logos' && !files) ? undefined : lists[g].length)

  const finish = async (key: string, run: () => Promise<Picked>) => {
    if (busy) return
    setBusy(key)
    try {
      await onPick(await run())
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui usar o insumo.')
    } finally {
      setBusy('')
    }
  }
  const pickItem = (i: Item) => finish(i.key, async () => ({ ...(await bringToSet(set, i.url, i.name, i.src)), kind: group === 'logos' ? 'logo' : group === 'icones' ? 'icone' : 'imagem' }))
  const pickIcon = (name: string) => finish(`icon-${name}`, async () => {
    const blob = await iconPng(name, color, iconSize, stroke)
    if (!blob) throw new Error('Esse ícone não existe.')
    const asset = await uploadAsset(set, blob, `icone-${name}.png`)
    return { src: `asset:${asset.id}`, name: `Ícone ${name}`, width: asset.width, height: asset.height, asset, kind: 'icone' }
  })

  const target = GROUPS.find((g) => g.id === group)?.upload
  const send = async (list: File[]) => {
    if (!team || !list.length || !target) return
    const dir = group === 'fotos' && folder && folder !== 'Raiz' ? folder : target
    setBusy('upload')
    try {
      await uploadFiles(team.id, dir, list)
      toast.success(`${list.length === 1 ? 'Guardada' : `${list.length} guardadas`} em ${dir}/ no Cérebro da conta.`)
      await refreshAccount(team, true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar.')
    } finally {
      setBusy('')
      if (input.current) input.current.value = ''
    }
  }

  const darkLogo = (i: Item) => /escuro|dark|branc|white|negativ/i.test(`${i.key} ${i.name}`)
  const spinner = (text: string) => <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {text}</div>
  const empty = (text: string) => (
    <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
      <FolderOpen className="mx-auto mb-2 h-6 w-6 text-gray-300" />{text}
    </div>
  )
  const grid = (items: Item[]) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {items.map((i) => (
        <div key={i.key} className="relative">
          <Tile item={i} busy={!!busy} dark={group === 'logos' && darkLogo(i)} onClick={() => void pickItem(i)} />
          {busy === i.key && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></span>}
        </div>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="gap-3 sm:p-5">
        <DialogHeader>
          <DialogTitle>{title ?? 'Insumos da conta'}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {team ? <>Logos, ícones, produtos e imagens de {team.name}. Clique para usar no post.</> : 'Abra uma conta para ver os insumos dela.'}
            {team && ((loadingFiles && files) || (group === 'posts' && loadingPosts && postImgs)) && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> atualizando</span>}
          </DialogDescription>
        </DialogHeader>
        {team && (
          <div className="flex min-h-[420px] flex-col gap-3 sm:flex-row">
            <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col">
              {groups.map((g) => {
                const n = count(g.id)
                return (
                  <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={cn('flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm', group === g.id ? 'bg-violet-50 font-medium text-violet-900' : 'text-gray-600 hover:bg-gray-50')}>
                    <g.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 whitespace-nowrap">{g.label}</span>
                    {n !== undefined && <span className="text-xs tabular-nums text-gray-400">{n}</span>}
                  </button>
                )
              })}
            </nav>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[160px] flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={group === 'icones' ? 'Buscar ícone (entrega, café, whatsapp…)' : 'Buscar pelo nome'} className="h-8 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </label>
                {target && (
                  <>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={!!busy} onClick={() => input.current?.click()} title={`Guarda no Cérebro da conta, em ${target}/, para usar aqui e nos próximos posts`}>
                      {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar
                    </Button>
                    <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void send([...(e.target.files ?? [])])} />
                  </>
                )}
              </div>

              {group === 'icones' && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">Cor
                    {colors.map((hex) => (
                      <button key={hex} type="button" title={hex} aria-label={`Cor ${hex}`} onClick={() => setColor(hex)} className={cn('h-5 w-5 rounded-full ring-1 ring-black/15', color === hex && 'ring-2 ring-violet-500 ring-offset-1')} style={{ background: hex }} />
                    ))}
                    <input type="color" aria-label="Outra cor" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#111111'} onChange={(e) => setColor(e.target.value)} className="h-5 w-7 cursor-pointer rounded border border-gray-200 bg-white p-0" />
                  </span>
                  <label className="flex items-center gap-1.5">Traço
                    <input type="range" min={1} max={3} step={0.25} value={stroke} onChange={(e) => setStroke(e.target.valueAsNumber)} className="w-20" />
                  </label>
                </div>
              )}

              {folders.length > 1 && group !== 'icones' && (
                <div className="flex flex-wrap gap-1.5">
                  {['', ...folders].map((f) => (
                    <button key={f || '_all'} type="button" onClick={() => setFolder(f)} className={cn('rounded-full border px-2.5 py-0.5 text-xs', folder === f ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{f || 'Todas'}</button>
                  ))}
                </div>
              )}

              {error && group !== 'posts' && group !== 'biblioteca' && <p className="text-sm text-red-600">{error}</p>}

              {group === 'icones' ? (
                <div className="space-y-4">
                  {lists.icones.length > 0 && (
                    <section className="space-y-1.5">
                      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ícones guardados na conta</h3>
                      {grid(shown)}
                    </section>
                  )}
                  <section className="space-y-1.5">
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{query.trim() ? 'Biblioteca de ícones' : 'Ícones da casa'} · na cor escolhida</h3>
                    {icons.length ? (
                      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
                        {icons.map((n) => (
                          <IconTile key={n} name={n} color={color} stroke={stroke} busy={!!busy} loading={busy === `icon-${n}`} onClick={() => void pickIcon(n)} />
                        ))}
                      </div>
                    ) : empty('Nenhum ícone com esse nome.')}
                  </section>
                </div>
              ) : loading && group !== 'biblioteca' ? (
                spinner(group === 'posts' ? 'Lendo as imagens dos posts da conta…' : 'Lendo os arquivos da conta…')
              ) : !shown.length ? (
                empty(all.length ? 'Nada com esse nome.'
                  : group === 'logos' ? 'Ainda não há logo. Envie o logo aqui (fica em marca/logos/ no Cérebro) ou escreva a marca em Cérebro › Marca.'
                  : group === 'produtos' ? 'Sem fotos de produto. Envie aqui (ficam em produtos/ no Cérebro).'
                  : group === 'posts' ? 'Os posts da conta ainda não usam imagens.'
                  : 'Sem imagens no Cérebro da conta. Use "Enviar".')
              ) : folders.length > 1 && !folder ? (
                <div className="space-y-4">
                  {byFolder.map(([f, items]) => (
                    <section key={f} className="space-y-1.5">
                      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{f} <span className="text-gray-400">· {items.length}</span></h3>
                      {grid(items)}
                    </section>
                  ))}
                </div>
              ) : grid(shown)}
            </div>
          </div>
        )}
        {team && <p className="text-xs text-gray-500">O insumo escolhido é copiado para este conjunto. Para organizar as pastas, abra o <Link to="/cerebro" className="underline" onClick={onClose}>Cérebro</Link>.</p>}
      </DialogContent>
    </Dialog>
  )
}
