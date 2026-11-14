import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, ImagePlus, Loader2, TriangleAlert } from 'lucide-react'

/**
 * Link de envio de fotos (`/enviar/<token>`, sem login): a IA conectada pelo MCP gera o link
 * (`sinfy_link_envio`) porque a imagem anexada no chat do ChatGPT ou do Claude não chega ao servidor.
 * A pessoa escolhe as fotos aqui (celular ou computador); cada uma vira WebP de até 1600 px, como no
 * Cérebro, e vai para a pasta do Cérebro da conta que o link indica. Depois ela volta ao chat.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://nfmfcpcwyavutntnrxqq.supabase.co'
const endpoint = (token: string) => `${SUPABASE_URL}/functions/v1/sinfy-mcp/enviar/${token}`

interface Info { conta: string; pasta: string; restantes: number; expirado: boolean; enviados: string[] }
interface Item { name: string; preview: string; status: 'enviando' | 'ok' | 'erro'; error?: string }

async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.88))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

const EnviarFotos: React.FC = () => {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string>()
  const [items, setItems] = useState<Item[]>([])
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(endpoint(token))
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Link inválido.')
        setInfo(body as Info)
      })
      .catch((e) => setError((e as Error).message))
  }, [token])

  const send = async (files: FileList | null) => {
    if (!files?.length || !info) return
    const list = [...files].slice(0, Math.max(0, info.restantes))
    for (const file of list) {
      const preview = URL.createObjectURL(file)
      setItems((x) => [...x, { name: file.name, preview, status: 'enviando' }])
      const done = (patch: Partial<Item>) => setItems((x) => x.map((it) => (it.preview === preview ? { ...it, ...patch } : it)))
      try {
        const blob = await shrink(file)
        const r = await fetch(endpoint(token), { method: 'POST', headers: { 'x-file-name': encodeURIComponent(file.name) }, body: blob })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? 'Não enviou.')
        done({ status: 'ok' })
        setInfo((i) => (i ? { ...i, restantes: body.restantes ?? i.restantes - 1 } : i))
      } catch (e) {
        done({ status: 'erro', error: (e as Error).message })
      }
    }
    if (input.current) input.current.value = ''
  }

  const sentOk = items.filter((i) => i.status === 'ok').length
  const busy = items.some((i) => i.status === 'enviando')

  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Mandar fotos para a sua IA</h1>
        {error ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-rose-700" role="alert"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>
        ) : !info ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</p>
        ) : info.expirado ? (
          <p className="mt-3 text-sm text-gray-600">Este link venceu. Peça um novo à sua IA.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">
              As fotos vão para o Cérebro de <strong>{info.conta}</strong>, na pasta <code className="break-all rounded bg-gray-100 px-1">{info.pasta}</code>.
            </p>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => void send(e.target.files)} />
            <button
              type="button"
              disabled={busy || info.restantes <= 0}
              onClick={() => input.current?.click()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {info.restantes > 0 ? 'Escolher fotos' : 'Limite de fotos deste link'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">Ainda cabem {info.restantes} foto(s).</p>
            {items.length > 0 && (
              <ul className="mt-5 grid grid-cols-3 gap-2">
                {items.map((it) => (
                  <li key={it.preview} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100" title={it.error ?? it.name}>
                    <img src={it.preview} alt={it.name} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow">
                      {it.status === 'enviando' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-600" /> : it.status === 'ok' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-rose-600" />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* O motivo da falha ficava só no title (hover), que o celular não mostra */}
            {items.some((it) => it.status === 'erro') && (
              <ul className="mt-3 grid gap-1 text-xs text-rose-700" role="alert">
                {items.filter((it) => it.status === 'erro').map((it) => (
                  <li key={it.preview} className="break-words">{it.name}: {it.error ?? 'Não enviou.'}</li>
                ))}
              </ul>
            )}
            {sentOk > 0 && !busy && (
              <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                {sentOk} foto(s) enviada(s). Volte ao chat e diga à sua IA que já mandou.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default EnviarFotos
