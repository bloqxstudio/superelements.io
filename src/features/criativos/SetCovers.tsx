import React from 'react'
import { Clapperboard, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sizeOf, type PostInfo, type SetSummary } from './types'

/**
 * As capas de um conjunto nas listas (Criativos, Motion, Publicar no
 * Instagram): os primeiros posts lado a lado, cada um na proporção dele, com a
 * marca de animado. Sem capa ainda, um bloco com as cores da marca.
 */

const ratio = (p: PostInfo) => {
  const { width, height } = sizeOf(p.format)
  return `${width} / ${height}`
}

export const PostCover: React.FC<{ post: PostInfo; url?: string; colors?: string[]; className?: string; showName?: boolean }> = ({ post, url, colors = [], className, showName }) => (
  <span className={cn('relative block overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/10', className)} style={{ aspectRatio: ratio(post) }}>
    {url ? (
      <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-left-top" />
    ) : (
      <span className="absolute inset-0 flex items-center justify-center" style={{ background: colors[0] ? `linear-gradient(135deg, ${colors[0]}, ${colors[1] ?? colors[0]})` : undefined }}>
        <ImageIcon className="h-4 w-4 text-white/70 mix-blend-difference" aria-hidden />
      </span>
    )}
    {post.motion && (
      <span className="absolute left-1 top-1 flex h-4 items-center gap-0.5 rounded bg-violet-600/90 px-1 text-[9px] font-semibold text-white" title="Tem animação">
        <Clapperboard className="h-2.5 w-2.5" aria-hidden /> Motion
      </span>
    )}
    {post.slides > 1 && <span className="absolute right-1 top-1 rounded bg-black/55 px-1 text-[9px] font-semibold text-white">{post.slides}</span>}
    {showName && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[10px] font-medium text-white">{post.name}</span>}
  </span>
)

/** Até `max` capas do conjunto numa faixa; o resto vira "+N". */
export const CoverStrip: React.FC<{ summary: SetSummary; urls: Record<string, string>; max?: number; className?: string }> = ({ summary, urls, max = 3, className }) => {
  const posts = summary.postsInfo ?? []
  if (!posts.length)
    return (
      <div className={cn('flex h-24 items-center gap-1 rounded-md bg-gray-50 px-3', className)}>
        {summary.colors.length ? summary.colors.map((c) => <span key={c} className="h-5 w-5 rounded-md ring-1 ring-black/10" style={{ background: c }} />) : <span className="text-xs text-gray-400">Gerando as capas…</span>}
      </div>
    )
  const shown = posts.slice(0, max)
  const rest = summary.posts - shown.length
  return (
    <div className={cn('grid h-28 gap-1.5', className)} style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
      {shown.map((p, i) => (
        <span key={p.id} className="relative block h-full min-w-0 overflow-hidden">
          {/* Preenche a célula da faixa: sem isso a proporção do post (9:16) esticava a altura e cobria o nome do conjunto */}
          <PostCover post={p} url={p.cover ? urls[p.cover] : undefined} colors={summary.colors} className="absolute inset-0 h-full w-full" />
          {rest > 0 && i === shown.length - 1 && <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">+{rest}</span>}
        </span>
      ))}
    </div>
  )
}
