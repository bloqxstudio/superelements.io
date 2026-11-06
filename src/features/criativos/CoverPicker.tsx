import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MotionRenderer, entrancesEnd, timeline } from './motion'
import type { ImageMap } from './render'
import { uploadAsset } from './storage'
import { useEditor } from './store'
import { coverAtOf, defaultCoverAt } from './video'
import { sizeOf, type Post } from './types'

/**
 * A capa do vídeo, escolhida do próprio vídeo como no Instagram: uma faixa de
 * quadros sugeridos (cada slide já montado, e mais alguns momentos), um
 * controle para achar o quadro exato e, se preciso, uma imagem enviada. A
 * escolha fica no post (`Post.cover`) e vai como `cover_url` do reels.
 */

/** Os momentos sugeridos: cada slide com as entradas prontas; com um slide só, mais alguns pontos do vídeo. */
export function coverSuggestions(post: Post): number[] {
  const { segments, total } = timeline(post)
  const out = segments.map((s) => s.start + Math.min(s.dur - 0.05, entrancesEnd(s.slide) + 0.3))
  if (segments.length < 4) {
    const after = defaultCoverAt(post)
    const extra = 6 - out.length
    for (let i = 1; i <= extra; i++) out.push(after + ((total - 0.1 - after) * i) / (extra + 1))
  }
  return [...new Set(out.map((t) => Math.round(Math.max(0, Math.min(total - 0.05, t)) * 10) / 10))].sort((a, b) => a - b).slice(0, 8)
}

const saveCover = (postId: string, cover: Post['cover']) =>
  useEditor.getState().edit((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, cover } : p)) }))

/** Um quadro do vídeo desenhado num canvas pequeno. */
const Frame: React.FC<{ renderer: MotionRenderer; post: Post; at: number; width: number; className?: string }> = ({ renderer, post, at, width, className }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const size = sizeOf(post.format)
  const height = Math.round((width * size.height) / size.width)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const ctx = ref.current?.getContext('2d')
      if (!ctx) return
      if (renderer.hasVideo) await renderer.seek(at)
      if (!alive) return
      ctx.save()
      ctx.setTransform((width * 2) / size.width, 0, 0, (height * 2) / size.height, 0, 0)
      renderer.draw(ctx, at)
      ctx.restore()
    })()
    return () => {
      alive = false
    }
  }, [renderer, at, width, height, size.width, size.height])
  return <canvas ref={ref} width={width * 2} height={height * 2} className={cn('block rounded bg-gray-100', className)} style={{ width, height }} />
}

/** `allowImage: false` no carrossel: a Meta só aceita um quadro do próprio vídeo como capa ali. */
export const CoverPicker: React.FC<{ post: Post; images: ImageMap; disabled?: boolean; allowImage?: boolean }> = ({ post, images, disabled, allowImage = true }) => {
  const renderer = useMemo(() => new MotionRenderer(post, images), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => renderer.update(post, images), [renderer, post, images])
  const total = timeline(post).total
  const suggestions = useMemo(() => coverSuggestions(post), [post])
  const at = coverAtOf(post)
  const custom = allowImage && post.cover && 'src' in post.cover ? post.cover.src : undefined
  const customImage = custom ? images.get(custom) : undefined
  const [scrub, setScrub] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const shown = scrub ?? at

  const pick = (t: number) => saveCover(post.id, { at: Math.round(t * 100) / 100 })

  const upload = async (file?: File) => {
    const set = useEditor.getState().set
    if (!file || !set) return
    setUploading(true)
    try {
      const asset = await uploadAsset(set, file, file.name)
      useEditor.getState().edit((s) => ({ ...s, assets: [...s.assets, asset], posts: s.posts.map((p) => (p.id === post.id ? { ...p, cover: { src: `asset:${asset.id}` } } : p)) }))
      await useEditor.getState().ensureImage(`asset:${asset.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui enviar a imagem.')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {customImage ? (
          <img src={(customImage as HTMLImageElement).src} alt="Capa enviada" className="w-[80px] shrink-0 rounded object-cover ring-2 ring-violet-500" style={{ aspectRatio: `${sizeOf(post.format).width} / ${sizeOf(post.format).height}` }} />
        ) : (
          <Frame renderer={renderer} post={post} at={shown} width={80} className="shrink-0 ring-2 ring-violet-500" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-normal leading-snug text-gray-600">
            {custom ? 'Capa: a imagem enviada.' : post.cover && 'at' in post.cover ? `Capa: o quadro de ${at.toFixed(1)} s do vídeo.` : 'Sugerida: o primeiro slide já montado. Escolha outro quadro abaixo.'}
          </p>
          <input
            type="range"
            aria-label="Quadro da capa"
            min={0}
            max={Math.max(0.1, total - 0.05)}
            step={0.05}
            value={shown}
            disabled={disabled}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={() => scrub !== null && (pick(scrub), setScrub(null))}
            onKeyUp={() => scrub !== null && (pick(scrub), setScrub(null))}
            className="w-full"
          />
          <div className="flex items-center gap-2">
            {allowImage && <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Enviar uma imagem
            </button>}
            {post.cover && (custom || 'at' in post.cover) && (
              <button type="button" disabled={disabled} onClick={() => saveCover(post.id, undefined)} className="text-[11px] text-gray-500 underline-offset-2 hover:underline">
                Voltar à sugerida
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {suggestions.map((t) => (
          <button key={t} type="button" disabled={disabled} onClick={() => pick(t)} title={`Quadro de ${t.toFixed(1)} s`} className={cn('shrink-0 rounded p-0.5', !custom && Math.abs(t - at) < 0.06 ? 'ring-2 ring-violet-500' : 'ring-1 ring-gray-200 hover:ring-violet-300')}>
            <Frame renderer={renderer} post={post} at={t} width={44} />
          </button>
        ))}
      </div>
    </div>
  )
}
