import React, { useEffect, useRef, useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Music2, Send, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Como o criativo vai ficar no Instagram do cliente, simulado (2026-11-09; o usuário: "visualizar como
 * vai ficar no Instagram dele simuladamente"). Quatro vistas: post no feed, carrossel (deslizar, pontos
 * e contador), Reels (vídeo em tela cheia com a coluna de ações) e story (barras de progresso e toque
 * nas laterais). Imagens e vídeos (MP4) vêm prontos do envio; nada é desenhado aqui além da moldura.
 * É uma simulação: o tamanho e a moldura seguem o app, sem prometer os pixels exatos.
 */

export type PreviewView = 'feed' | 'carrossel' | 'reels' | 'story'

export interface PreviewProps {
  view: PreviewView
  /** Endereços de cada slide (imagem ou .mp4). */
  urls: string[]
  poster?: string
  /** 4x5, 1x1, 9x16 ou 16x9 (a proporção do feed). */
  format: string
  username?: string
  caption?: string
  onSlide?: (index: number) => void
}

const isVideo = (url: string) => /\.mp4(\?|$)/i.test(url)

const ratioCss = (format: string) => {
  const m = /^(\d+)x(\d+)/.exec(format)
  if (!m) return '4 / 5'
  return `${m[1]} / ${m[2]}`
}

const Avatar: React.FC<{ name: string; ring?: boolean; size?: number }> = ({ name, ring, size = 32 }) => (
  <span className={cn('flex shrink-0 items-center justify-center rounded-full p-[2px]', ring ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600' : '')} style={{ width: size, height: size }}>
    <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold uppercase text-white ring-2 ring-white">
      {name.replace(/^@/, '').slice(0, 1) || '·'}
    </span>
  </span>
)

const Media: React.FC<{ url: string; poster?: string; active: boolean; muted: boolean; fit?: 'cover' | 'contain' }> = ({ url, poster, active, muted, fit = 'cover' }) => {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) void v.play().catch(() => undefined)
    else v.pause()
  }, [active])
  if (isVideo(url)) {
    return <video ref={ref} src={url} poster={poster} muted={muted} loop playsInline preload="metadata" className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />
  }
  return <img src={url} alt="" loading="lazy" draggable={false} className={cn('h-full w-full select-none', fit === 'cover' ? 'object-cover' : 'object-contain')} />
}

const Caption: React.FC<{ username: string; caption?: string; light?: boolean }> = ({ username, caption, light }) => {
  const [open, setOpen] = useState(false)
  if (!caption?.trim()) return null
  const long = caption.length > 120 || caption.includes('\n')
  // O corte: a primeira linha (ou 110 letras); reticências só quando a frase foi partida no meio
  const firstLine = caption.split('\n')[0]
  const cut = firstLine.length > 110 ? `${firstLine.slice(0, 110).trimEnd()}… ` : `${firstLine} `
  return (
    <p className={cn('text-[13px] leading-snug', light ? 'text-white' : 'text-gray-900')}>
      <span className="font-semibold">{username}</span>{' '}
      <span className="whitespace-pre-line">{open || !long ? caption : cut}</span>
      {long && !open && (
        <button type="button" onClick={() => setOpen(true)} className={cn('ml-0.5', light ? 'text-white/70' : 'text-gray-500')}>
          mais
        </button>
      )}
    </p>
  )
}

export const InstagramPreview: React.FC<PreviewProps> = ({ view, urls, poster, format, username = 'suaempresa', caption, onSlide }) => {
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const count = urls.length
  const go = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i))
    setIndex(next)
    onSlide?.(next)
  }
  useEffect(() => { setIndex(0) }, [urls])

  // Story: avança sozinho a cada 5 s nas imagens (os vídeos avançam ao tocar)
  useEffect(() => {
    if (view !== 'story' || count < 2 || isVideo(urls[index] ?? '')) return
    const t = setTimeout(() => go(index + 1 < count ? index + 1 : index), 5000)
    return () => clearTimeout(t)
  }, [view, index, count]) // eslint-disable-line react-hooks/exhaustive-deps

  const phone = 'mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_20px_50px_-20px_rgb(0_0_0/0.35)]'

  if (view === 'reels' || view === 'story') {
    const url = urls[index] ?? ''
    return (
      <div className={cn(phone, 'relative bg-black')} style={{ aspectRatio: '9 / 16' }} aria-label={view === 'reels' ? 'Simulação de Reels' : 'Simulação de story'}>
        <Media url={url} poster={index === 0 ? poster : undefined} active muted={muted} />
        {view === 'story' && (
          <>
            {/* Sombra no topo, como no Instagram: as barras e o @ aparecem mesmo sobre imagem clara */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
            <div className="absolute inset-x-2 top-2 flex gap-1" aria-hidden>
              {urls.map((_, i) => (
                <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                  <span className={cn('block h-full bg-white', i < index ? 'w-full' : i === index ? 'w-1/2' : 'w-0')} />
                </span>
              ))}
            </div>
            <div className="absolute left-3 top-5 flex items-center gap-2 text-white">
              <Avatar name={username} size={30} />
              <span className="text-[13px] font-semibold drop-shadow">{username}</span>
              <span className="text-[12px] text-white/70">agora</span>
            </div>
            {count > 1 && (
              <>
                <button type="button" aria-label="Story anterior" onClick={() => go(index - 1)} className="absolute inset-y-0 left-0 w-1/3" />
                <button type="button" aria-label="Próximo story" onClick={() => go(index + 1)} className="absolute inset-y-0 right-0 w-1/3" />
              </>
            )}
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2" aria-hidden>
              <span className="flex h-10 flex-1 items-center rounded-full border border-white/60 px-4 text-[13px] text-white/80">Enviar mensagem</span>
              <Heart className="h-6 w-6 text-white" />
              <Send className="h-6 w-6 text-white" />
            </div>
          </>
        )}
        {view === 'reels' && (
          <>
            <p className="absolute left-4 top-4 text-[17px] font-semibold text-white drop-shadow">Reels</p>
            <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 text-white" aria-hidden>
              <span className="flex flex-col items-center text-[11px]"><Heart className="h-7 w-7" />curtir</span>
              <span className="flex flex-col items-center text-[11px]"><MessageCircle className="h-7 w-7" />0</span>
              <Send className="h-7 w-7" />
              <MoreHorizontal className="h-6 w-6" />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-16">
              <div className="flex items-center gap-2 text-white">
                <Avatar name={username} size={30} />
                <span className="text-[13px] font-semibold">{username}</span>
                <span className="rounded-md border border-white/70 px-2 py-0.5 text-[12px] font-semibold">Seguir</span>
              </div>
              <div className="mt-2 max-w-[80%]"><Caption username="" caption={caption} light /></div>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/90"><Music2 className="h-3.5 w-3.5" aria-hidden /> Áudio original</p>
            </div>
            {count > 1 && (
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-1">
                <button type="button" aria-label="Anterior" disabled={index === 0} onClick={() => go(index - 1)} className="rounded-full bg-black/40 p-1 text-white disabled:opacity-0"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" aria-label="Próximo" disabled={index === count - 1} onClick={() => go(index + 1)} className="rounded-full bg-black/40 p-1 text-white disabled:opacity-0"><ChevronRight className="h-5 w-5" /></button>
              </div>
            )}
          </>
        )}
        {isVideo(url) && (
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Ligar o som' : 'Desligar o som'} className="absolute right-3 top-12 rounded-full bg-black/50 p-1.5 text-white">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    )
  }

  // Feed e carrossel
  return (
    <div className={phone} aria-label={view === 'carrossel' ? 'Simulação de carrossel no feed' : 'Simulação de post no feed'}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={username} ring />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900">{username}</span>
        <MoreHorizontal className="h-5 w-5 text-gray-900" aria-hidden />
      </div>
      <div className="relative bg-gray-100" style={{ aspectRatio: ratioCss(format) }}>
        <div className="flex h-full transition-transform duration-300 ease-out" style={{ width: `${count * 100}%`, transform: `translateX(-${(index * 100) / Math.max(1, count)}%)` }}>
          {urls.map((u, i) => (
            <div key={u} className="h-full" style={{ width: `${100 / Math.max(1, count)}%` }}>
              <Media url={u} poster={i === 0 ? poster : undefined} active={i === index} muted={muted} />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">{index + 1}/{count}</span>
            <button type="button" aria-label="Slide anterior" disabled={index === 0} onClick={() => go(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-gray-900 shadow disabled:opacity-0"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Próximo slide" disabled={index === count - 1} onClick={() => go(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-gray-900 shadow disabled:opacity-0"><ChevronRight className="h-4 w-4" /></button>
          </>
        )}
        {isVideo(urls[index] ?? '') && (
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Ligar o som' : 'Desligar o som'} className="absolute bottom-3 right-3 rounded-full bg-black/60 p-1.5 text-white">
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="relative flex items-center gap-4 text-gray-900" aria-hidden>
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          {count > 1 && (
            <span className="absolute left-1/2 flex -translate-x-1/2 gap-1">
              {urls.map((_, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === index ? 'bg-sky-500' : 'bg-gray-300')} />)}
            </span>
          )}
          <Bookmark className="ml-auto h-6 w-6" />
        </div>
        <div className="mt-2"><Caption username={username} caption={caption} /></div>
        <p className="mt-1.5 text-[11px] uppercase tracking-wide text-gray-400">Agora · simulação</p>
      </div>
    </div>
  )
}

/** A vista de um post enviado: a que veio no envio, ou a que o formato e os slides pedem. */
export function previewViewOf(post: { view?: string; format: string; slides: string[] }): PreviewView {
  if (post.view === 'feed' || post.view === 'carrossel' || post.view === 'reels' || post.view === 'story') return post.view
  if (post.format === '9x16') return post.slides.some(isVideo) ? 'reels' : 'story'
  return post.slides.length > 1 ? 'carrossel' : 'feed'
}
