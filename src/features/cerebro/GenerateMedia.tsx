import React, { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { callAiQuiet, imageProviderChoice, useCreativeLink } from '@/features/criativos/link'
import { useCrm } from '@/features/crm/crmStore'
import { deleteFile, mediaUrl, uploadFiles, type LoadedVault } from './data'
import { DESIGN_PATH, patternsOf } from './standard'
import { fileName, isImage, type VaultMedia } from './vault'

/**
 * Criar fotos e peças da empresa direto no Cérebro (2026-11-07, o usuário: "permita nas fotos criar fotos
 * e assets para a empresa que estamos construindo"). Usa o serviço de imagens deste computador (o mesmo
 * dos Criativos: Codex, OpenAI ou Gemini, pelo conector). O pedido leva o que o Cérebro sabe da conta
 * (nome, segmento, cores do DESIGN.md) e, se a pessoa escolher, fotos do próprio Cérebro como referência
 * para o produto sair fiel. O que sai é gravado na pasta escolhida, como qualquer arquivo do Cérebro.
 */

type Ratio = 'square' | 'portrait' | 'landscape'

const KINDS: { id: string; label: string; hint: string; ratio: Ratio; transparent?: boolean; template: string }[] = [
  { id: 'produto', label: 'Foto de produto', hint: 'o produto em estúdio, fundo limpo', ratio: 'portrait', template: 'Foto realista de produto em estúdio, luz suave de recorte, fundo limpo e escuro com leve textura, produto nítido e inteiro, enquadramento de catálogo premium.' },
  { id: 'uso', label: 'Em uso / cena', hint: 'o produto no dia a dia do cliente', ratio: 'portrait', template: 'Foto realista e editorial do produto em uso, numa cena real do dia a dia do cliente, luz natural com direção, profundidade de campo, sem pessoas posando para a câmera.' },
  { id: 'detalhe', label: 'Close de detalhe', hint: 'textura, acabamento, reflexo', ratio: 'square', template: 'Macro fotográfico de um detalhe do produto (textura, acabamento, borda, reflexo), luz rasante, muito nítido, fundo desfocado.' },
  { id: 'recorte', label: 'Produto recortado', hint: 'PNG sem fundo para os criativos', ratio: 'square', transparent: true, template: 'O produto sozinho, inteiro, centralizado, vista de três quartos, luz de estúdio, sombras suaves no próprio objeto, SEM fundo (PNG transparente), bordas limpas.' },
  { id: 'objeto', label: 'Objeto 3D / ícone', hint: 'peça gráfica sem fundo', ratio: 'square', transparent: true, template: 'Objeto 3D estilizado e limpo, materiais realistas, iluminação de estúdio, centralizado, SEM fundo (PNG transparente).' },
  { id: 'fundo', label: 'Fundo / textura', hint: 'base para posts e site', ratio: 'portrait', template: 'Fundo abstrato para peças gráficas: textura sutil, gradiente de luz, espaço vazio para texto, sem objetos, sem texto.' },
]

const RATIOS: { id: Ratio; label: string }[] = [
  { id: 'portrait', label: 'Vertical' },
  { id: 'square', label: 'Quadrado' },
  { id: 'landscape', label: 'Horizontal' },
]

const toDataUrl = (blob: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob) })

/** Reduz a referência (a IA não precisa de mais que 1024 px) e devolve como data URL JPEG/PNG. */
async function refData(teamId: string, m: VaultMedia): Promise<string> {
  const blob = await (await fetch(m.url ?? await mediaUrl(teamId, m.path, m.mtime))).blob()
  const bmp = await createImageBitmap(blob)
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c.toDataURL('image/jpeg', 0.88)
}

/** O que o Cérebro sabe da marca, em poucas linhas para o pedido de imagem. */
function brandLine(vault: LoadedVault): string {
  const team = useCrm.getState().team
  const md = vault.notes.find((n) => n.path === DESIGN_PATH)?.content ?? ''
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const colors = [...fm.matchAll(/^\s*([a-z-]+):\s*["']?(#[0-9a-fA-F]{3,8})["']?\s*$/gm)].slice(0, 6).map((m) => `${m[1]} ${m[2]}`)
  const pattern = patternsOf(vault).find((p) => p.isDefault)
  const segment = (team as unknown as { profile?: { segment?: string } } | null)?.profile?.segment
  return [
    team ? `Empresa: ${team.name}${segment ? ` (${segment})` : ''}.` : '',
    colors.length ? `Paleta da marca (use no clima de cor e luz, não como texto): ${colors.join(', ')}.` : '',
    pattern?.rules.length ? `Estilo de foto dos posts da marca: ${pattern.rules.filter((r) => /foto|luz|fundo|imagem|cena/i.test(r)).slice(0, 3).join(' ')}` : '',
  ].filter(Boolean).join('\n')
}

export const GenerateMedia: React.FC<{ teamId: string; vault: LoadedVault; folder: string; folders: string[]; onClose: () => void; onSaved: (folder: string) => void }> = ({ teamId, vault, folder: startFolder, folders, onClose, onSaved }) => {
  const providers = useCreativeLink((s) => s.providers)
  const hasOpenai = providers.includes('openai')
  const [kind, setKind] = useState(KINDS[0])
  const [ratio, setRatio] = useState<Ratio>(KINDS[0].ratio)
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(2)
  const [folder, setFolder] = useState(startFolder || 'fotos')
  const [refs, setRefs] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [made, setMade] = useState<{ path: string; url: string }[]>([])
  const stop = useRef<AbortController | null>(null)
  const photos = useMemo(() => vault.media.filter((m) => isImage(m.path)).slice(0, 60), [vault.media])

  const pick = (k: (typeof KINDS)[number]) => { setKind(k); setRatio(k.ratio) }
  const toggleRef = (p: string) => setRefs((r) => (r.includes(p) ? r.filter((x) => x !== p) : r.length >= 3 ? r : [...r, p]))

  const run = async () => {
    const ask = prompt.trim()
    if (!ask) return
    if (!providers.length) { toast.error('Nenhum serviço de imagem pronto neste computador: abra o conector e entre no Codex, ou guarde uma chave do OpenAI ou do Google em Criativos.'); return }
    const ctrl = new AbortController()
    stop.current = ctrl
    try {
      setBusy('Lendo as referências')
      const references = await Promise.all(refs.map((p) => refData(vault.teamId, vault.media.find((m) => m.path === p)!)))
      const full = [
        kind.template,
        `O que a pessoa pediu: ${ask}`,
        brandLine(vault),
        references.length ? `As imagens anexadas mostram o produto/objeto real da empresa: mantenha a forma, as proporções, as cores e os detalhes dele fielmente; mude só cena, ângulo e luz.` : '',
        'Nunca escreva texto, letras, números nem logos na imagem.',
      ].filter(Boolean).join('\n\n')
      const provider = kind.transparent && hasOpenai ? 'openai' : imageProviderChoice()
      const out: { path: string; url: string }[] = []
      for (let i = 0; i < count; i++) {
        if (ctrl.signal.aborted) break
        setBusy(`Criando ${i + 1} de ${count}`)
        const img = await callAiQuiet<{ data: string }>('image', { prompt: count > 1 ? `${full}\n\nVariação ${i + 1} de ${count}: mude o ângulo ou a composição em relação às outras.` : full, ratio, provider, references, transparent: !!kind.transparent }, ctrl.signal)
        const blob = await (await fetch(img.data)).blob()
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
        const name = `${kind.id}-${ask.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-$/, '')}.${ext}`
        const [path] = await uploadFiles(teamId, folder, [new File([blob], name, { type: blob.type })])
        out.push({ path, url: URL.createObjectURL(blob) })
        setMade((m) => [...m, out[out.length - 1]])
      }
      if (out.length) { toast.success(`${out.length} imagem(ns) guardada(s) em ${folder}.`); onSaved(folder) }
    } catch (e) {
      if (!ctrl.signal.aborted) toast.error(e instanceof Error ? e.message : 'Não criou a imagem')
    } finally { setBusy(null); stop.current = null }
  }

  const discard = async (path: string) => {
    try { await deleteFile(teamId, path); setMade((m) => m.filter((x) => x.path !== path)); onSaved(folder) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não apagou') }
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Sparkles className="h-4 w-4 text-violet-600" />Criar imagem para a empresa</p>
        <button type="button" onClick={() => { stop.current?.abort(); onClose() }} aria-label="Fechar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
      </div>
      {!providers.length && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum serviço de imagem pronto neste computador. Abra o conector e entre no Codex, ou guarde uma chave do OpenAI ou do Google em Criativos.</p>}

      <p className="mb-1.5 text-xs font-medium text-gray-600">O que criar</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button key={k.id} type="button" onClick={() => pick(k)} aria-pressed={kind.id === k.id}
            className={cn('rounded-lg border px-3 py-2 text-left transition-colors', kind.id === k.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300')}>
            <span className="block text-[13px] font-medium text-gray-900">{k.label}</span>
            <span className="block text-[11px] text-gray-500">{k.hint}</span>
          </button>
        ))}
      </div>

      <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="gm-prompt">Descreva a imagem</label>
      <textarea id="gm-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
        placeholder="Ex.: película aplicada no painel TFT de uma BMW GS, moto parada numa estrada de terra no fim de tarde"
        className="mb-3 w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />

      {photos.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-medium text-gray-600">Referências do Cérebro <span className="font-normal text-gray-400">(opcional, até 3: o produto real sai fiel)</span></p>
          <ul className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {photos.map((m) => <RefThumb key={m.path} teamId={vault.teamId} m={m} on={refs.includes(m.path)} onClick={() => toggleRef(m.path)} />)}
          </ul>
        </>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-gray-600">Formato</p>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-[12px]">
            {RATIOS.map((r) => (
              <button key={r.id} type="button" onClick={() => setRatio(r.id)} aria-pressed={ratio === r.id}
                className={cn('rounded-md px-2.5 py-1 font-medium', ratio === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>{r.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="gm-count">Quantas</label>
          <select id="gm-count" value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="gm-folder">Guardar na pasta</label>
          <input id="gm-folder" list="gm-folders" value={folder} onChange={(e) => setFolder(e.target.value)}
            className="h-8 w-full rounded-md border border-gray-200 px-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          <datalist id="gm-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
      </div>
      {kind.transparent && !hasOpenai && <p className="mb-3 text-xs text-gray-500">Sem fundo sai melhor com uma chave do OpenAI; o serviço escolhido pode devolver com fundo.</p>}

      <div className="flex items-center justify-end gap-2">
        {busy && <span className="mr-auto flex items-center gap-1.5 text-xs text-violet-700"><Loader2 className="h-3 w-3 animate-spin" />{busy}…</span>}
        {busy ? <Button size="sm" variant="ghost" onClick={() => stop.current?.abort()}>Parar</Button> : <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>}
        <Button size="sm" onClick={() => void run()} disabled={!prompt.trim() || !!busy || !providers.length}><ImagePlus className="mr-1.5 h-3.5 w-3.5" />Criar</Button>
      </div>

      {made.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
          {made.map((m) => (
            <li key={m.path} className="group relative">
              <img src={m.url} alt={fileName(m.path)} className="aspect-square w-full rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain" />
              <span className="mt-1 block truncate text-[11px] text-gray-500">{fileName(m.path)}</span>
              <button type="button" onClick={() => void discard(m.path)} aria-label="Não gostei, apagar"
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-gray-500 shadow-sm hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const RefThumb: React.FC<{ teamId: string; m: VaultMedia; on: boolean; onClick: () => void }> = ({ teamId, m, on, onClick }) => {
  const [src, setSrc] = useState(m.url)
  React.useEffect(() => { let live = true; if (!m.url) void mediaUrl(teamId, m.path, m.mtime).then((u) => live && setSrc(u)).catch(() => {}); return () => { live = false } }, [teamId, m.path, m.mtime, m.url])
  return (
    <li className="shrink-0">
      <button type="button" onClick={onClick} aria-pressed={on} title={m.label ?? fileName(m.path)}
        className={cn('block h-16 w-16 overflow-hidden rounded-md border-2', on ? 'border-violet-500' : 'border-transparent hover:border-gray-300')}>
        {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-gray-100" />}
      </button>
    </li>
  )
}
