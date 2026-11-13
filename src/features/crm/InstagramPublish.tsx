import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ExternalLink, Images, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { listSets, loadSet } from '@/features/criativos/storage'
import { sizeOf, type CreativeSet, type SetSummary } from '@/features/criativos/types'
import { matchesSearch, useCovers } from '@/features/criativos/covers'
import { CoverStrip, PostCover } from '@/features/criativos/SetCovers'
import { useAccountProjectIds } from '@/features/projects/projectStore'
import { Chip } from '@/features/prospects/ui'
import { cn } from '@/lib/utils'
import { FIELD, plural } from './ui'
import { TrialOption } from './TrialOption'
import type { TrialStrategy } from './trialReels'
import { CaptionCheck } from '@/features/instagram-ia/CaptionCheck'
import { HASHTAG_LIMIT } from '@/features/instagram-ia/legenda'
import {
  creativeFits,
  feedRatio,
  prepareImage,
  prepareVideo,
  publishPost,
  creativeImages,
  renderCreative,
  type IgAccount,
  type Prepared,
  type PublishKind,
  type PublishStep,
  type Published,
} from './instagram'

/**
 * Publicar no Instagram da equipe: feed (foto ou carrossel), story ou reels,
 * com arquivos do computador ou um post pronto do Criativos. A prévia já é o
 * arquivo que vai: foto em JPEG, cortada para a proporção que o feed aceita.
 */

interface Source {
  id: string
  blob: Blob
  name: string
  type: 'image' | 'video'
  /** Vídeo vindo do Criativos: o quadro da capa em ms (carrossel). */
  thumbOffset?: number
}

const KIND_LABEL: Record<PublishKind, string> = { feed: 'Feed', story: 'Story', reel: 'Reels' }
const KIND_HINT: Record<PublishKind, string> = {
  feed: 'Uma foto, ou até 20 fotos e vídeos num carrossel. A primeira define o corte de todas (de 4:5 a 1,91:1).',
  story: 'Uma foto ou um vídeo, de preferência em 9:16. Story não leva legenda pela API.',
  reel: 'Um vídeo MP4 ou MOV, de 3 segundos a 15 minutos, de preferência em 9:16.',
}
const ACCEPT: Record<PublishKind, string> = { feed: 'image/*,video/mp4,video/quicktime', story: 'image/*,video/mp4,video/quicktime', reel: 'video/mp4,video/quicktime' }

const STEPS: { id: PublishStep; label: string }[] = [
  { id: 'enviando', label: 'Enviando os arquivos' },
  { id: 'preparando', label: 'O Instagram prepara o post' },
  { id: 'processando', label: 'Processando o vídeo' },
  { id: 'publicado', label: 'Publicado' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

const CreativePicker: React.FC<{ onPick: (set: CreativeSet, postId: string) => void; busy: boolean }> = ({ onPick, busy }) => {
  // null enquanto a lista de projetos ainda não é da conta aberta (troca de conta): não lista nada misturado
  const projectIds = useAccountProjectIds()
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  const [setKey, setSetKey] = useState('')
  const [opened, setOpened] = useState<CreativeSet | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const covered = useCovers(sets)
  const keyOf = (s: SetSummary) => `${s.projectId ?? ''}/${s.id}`
  const visible = covered.sets?.filter((s) => matchesSearch(s, query)) ?? []

  useEffect(() => {
    if (projectIds === null) return
    let alive = true
    listSets(projectIds ? projectIds.split(',') : [])
      .then((list) => {
        if (!alive) return
        setSets(list)
        setSetKey((cur) => cur || (list[0] ? `${list[0].projectId ?? ''}/${list[0].id}` : ''))
      })
      .catch(() => alive && setSets([]))
    return () => {
      alive = false
    }
  }, [projectIds])

  const summary = covered.sets?.find((s) => keyOf(s) === setKey)
  useEffect(() => {
    const found = sets?.find((s) => `${s.projectId ?? ''}/${s.id}` === setKey)
    if (!found) return
    setLoading(true)
    setOpened(null)
    loadSet(found.id, found.shared ? found.projectId : undefined)
      .then((set) => setOpened(set ?? null))
      .catch(() => setOpened(null))
      .finally(() => setLoading(false))
  }, [setKey, sets])

  if (sets === null)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo os conjuntos do Criativos…
      </p>
    )
  if (!sets.length) return <p className="text-sm text-gray-500">Nenhum conjunto no Criativos ainda.</p>
  return (
    <div className="grid gap-3">
      {sets.length > 3 && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conjunto ou post" className={cn(FIELD, 'h-9')} />}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((s) => (
          <button key={keyOf(s)} type="button" onClick={() => setSetKey(keyOf(s))} className={cn('w-44 shrink-0 rounded-lg p-2 text-left ring-1 ring-inset transition-colors', keyOf(s) === setKey ? 'bg-violet-50 ring-violet-500' : 'ring-gray-200 hover:bg-gray-50')}>
            <CoverStrip summary={s} urls={covered.urls} max={3} className="h-20" />
            <span className="mt-1.5 block truncate text-xs font-medium text-gray-900">{s.name}</span>
            <span className="block truncate text-[11px] text-gray-500">{s.projectName ? `${s.projectName} · ` : ''}{plural(s.posts, 'post', 'posts')}</span>
          </button>
        ))}
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo o conjunto…
        </p>
      )}
      {opened && (
        <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {opened.posts.map((post) => {
            const size = sizeOf(post.format)
            const info = summary?.postsInfo?.find((p) => p.id === post.id)
            return (
              <li key={post.id}>
                <button type="button" disabled={busy} onClick={() => onPick(opened, post.id)} title={`Usar ${post.name}`} className="group block w-full text-left disabled:opacity-50">
                  {info ? (
                    <PostCover post={info} url={info.cover ? covered.urls[info.cover] : undefined} colors={summary?.colors} className="w-full transition-shadow group-hover:ring-2 group-hover:ring-violet-500" />
                  ) : (
                    <span className="flex w-full items-center justify-center rounded-md bg-gray-100 text-[10px] text-gray-500 ring-1 ring-black/10" style={{ aspectRatio: `${size.width} / ${size.height}` }}>{size.label}</span>
                  )}
                  <span className="mt-1 block truncate text-[11px] font-medium text-gray-900">{post.name}</span>
                  <span className="block truncate text-[10px] text-gray-500">{plural(post.slides.length, 'slide', 'slides')}{post.caption ? ' · legenda' : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export const PublishDialog: React.FC<{ account: IgAccount; onClose: () => void; onPublished: () => void; /** Abre em reels com "Publicar como teste" ligado (aba Testes). */ startAsTrial?: boolean }> = ({ account, onClose, onPublished, startAsTrial }) => {
  const [kind, setKind] = useState<PublishKind>(startAsTrial ? 'reel' : 'feed')
  const [from, setFrom] = useState<'arquivos' | 'criativos'>('arquivos')
  const [sources, setSources] = useState<Source[]>([])
  const [prepared, setPrepared] = useState<Prepared[]>([])
  const [preparing, setPreparing] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [caption, setCaption] = useState('')
  const [shareToFeed, setShareToFeed] = useState(true)
  // Reels como teste (trial reel): só quem não segue vê
  const [trial, setTrial] = useState<TrialStrategy | null>(startAsTrial ? 'MANUAL' : null)
  const [step, setStep] = useState<PublishStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Published | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])

  // A prévia é o arquivo final: refaz quando muda a ordem, o tipo ou os arquivos
  useEffect(() => {
    let alive = true
    if (!sources.length) {
      setPrepared([])
      return
    }
    setPreparing(true)
    ;(async () => {
      const out: Prepared[] = []
      let ratio: number | undefined
      for (const s of sources) {
        if (s.type === 'video') {
          out.push({ ...(await prepareVideo(new File([s.blob], s.name, { type: s.blob.type }))), thumbOffset: s.thumbOffset })
          continue
        }
        if (kind === 'feed' && ratio === undefined) {
          const bitmap = await createImageBitmap(s.blob)
          ratio = feedRatio(bitmap.width, bitmap.height)
          bitmap.close()
        }
        out.push(await prepareImage(s.blob, s.name, kind === 'feed' ? ratio : undefined))
      }
      return out
    })()
      .then((out) => {
        if (!alive) return out.forEach((p) => URL.revokeObjectURL(p.url))
        urls.current.forEach((u) => URL.revokeObjectURL(u))
        urls.current = out.map((p) => p.url)
        setPrepared(out)
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setPreparing(false))
    return () => {
      alive = false
    }
  }, [sources, kind])

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const add = (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const next = [...files].map((f): Source => ({ id: uid(), blob: f, name: f.name, type: f.type.startsWith('video/') ? 'video' : 'image' }))
    setSources((cur) => (kind === 'feed' ? [...cur, ...next].slice(0, 20) : next.slice(0, 1)))
  }

  const move = (index: number, by: number) =>
    setSources((cur) => {
      const next = [...cur]
      const [item] = next.splice(index, 1)
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item)
      return next
    })

  const pickCreative = async (set: CreativeSet, postId: string) => {
    const post = set.posts.find((p) => p.id === postId)
    if (!post) return
    setRendering(true)
    setError(null)
    try {
      const fits = creativeFits(post)
      const { hasMotion, postOutput } = await import('@/features/criativos/motion')
      const video = await import('@/features/criativos/video')
      const animated = hasMotion(post) && video.videoSupported()
      if (animated && postOutput(post) === 'video') {
        // Post animado como um vídeo só: reels (ou story no 9:16)
        const images = await creativeImages(set, post.slides)
        const audio = await video.audioFor(post, set.assets)
        const blob = await video.postToMp4(post, images, { audio })
        const target: PublishKind = fits === 'story' ? 'story' : 'reel'
        setKind(target)
        setSources([{ id: uid(), blob, name: `${post.name}.mp4`, type: 'video' }])
      } else if (animated && fits !== 'story') {
        // Carrossel misto: os slides animados em vídeo, os outros em foto
        const images = await creativeImages(set, post.slides)
        const items = await video.postToCarousel(post, images, { audio: await video.audioFor(post, set.assets), base: post.name })
        setKind('feed')
        setSources(items.slice(0, 20).map((item) => ({ id: uid(), blob: item.blob, name: item.name, type: item.type, thumbOffset: item.thumbOffset })))
      } else {
        const blobs = await renderCreative(set, post)
        const target: PublishKind = fits === 'story' ? 'story' : 'feed'
        setKind(target)
        setSources((target === 'story' ? blobs.slice(0, 1) : blobs.slice(0, 20)).map((blob, i) => ({ id: uid(), blob, name: `${post.name}-${i + 1}.jpg`, type: 'image' })))
        if (target === 'story' && blobs.length > 1) toast.message('Story leva um slide só: foi o primeiro.')
      }
      const target: PublishKind = fits === 'story' ? 'story' : 'feed'
      if (target !== 'story' && post.caption && !caption.trim()) setCaption(post.caption)
      setFrom('arquivos')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRendering(false)
    }
  }

  const changeKind = (next: PublishKind) => {
    setKind(next)
    setError(null)
    setSources((cur) => (next === 'feed' ? cur : next === 'reel' ? cur.filter((s) => s.type === 'video').slice(0, 1) : cur.slice(0, 1)))
  }

  const hashtags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  const problem =
    !prepared.length
      ? 'Escolha o que publicar.'
      : kind === 'reel' && prepared[0]?.type !== 'video'
        ? 'Reels pede um vídeo.'
        : caption.length > 2200
          ? 'A legenda passa de 2.200 caracteres.'
          : hashtags > 30
            ? 'O Instagram aceita até 30 hashtags.'
            : null
  const busy = step !== null && step !== 'publicado'
  const hasVideo = prepared.some((p) => p.type === 'video')
  const isReel = kind === 'reel' || (kind === 'feed' && prepared.length === 1 && hasVideo)

  const publish = async () => {
    if (problem || busy) return
    setError(null)
    try {
      const result = await publishPost({
        teamId: account.teamId,
        accountId: account.id,
        kind: kind === 'feed' && prepared.length === 1 && prepared[0].type === 'video' ? 'reel' : kind,
        caption: kind === 'story' ? '' : caption,
        files: prepared,
        shareToFeed,
        trial: trial && isReel ? { strategy: trial, title: prepared[0]?.name.replace(/\.[a-z0-9]+$/i, '') } : undefined,
        onStep: setStep,
      })
      setDone(result)
      onPublished()
    } catch (e) {
      setStep(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const reset = () => {
    setSources([])
    setCaption('')
    setDone(null)
    setStep(null)
    setError(null)
  }


  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Publicar em @{account.username}</DialogTitle>
          <DialogDescription>
            Sai na hora, pela API oficial do Instagram.
            {account.quota ? ` Pela API nas últimas 24 horas: ${account.quota.used} de ${account.quota.total}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-5 w-5" />
            </span>
            <p className="mt-3 text-base font-semibold text-gray-900">{trial && isReel ? 'Teste publicado' : 'Publicado no Instagram'}</p>
            <p className="mt-1 text-sm text-gray-500">{trial && isReel ? 'Só quem não segue vê. Acompanhe em Instagram › Testes: o motor diz se vale levar aos seguidores.' : 'Os números do post aparecem nas próximas atualizações.'}</p>
            <div className="mt-5 flex justify-center gap-2">
              {done.permalink && (
                <Button asChild variant="outline">
                  <a href={done.permalink} target="_blank" rel="noreferrer">
                    Ver no Instagram <ExternalLink className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                Publicar outro
              </Button>
              <Button onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(KIND_LABEL) as PublishKind[]).map((k) => (
                <Chip key={k} active={kind === k} onClick={() => changeKind(k)} disabled={busy}>
                  {KIND_LABEL[k]}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
              <Chip active={from === 'arquivos'} onClick={() => setFrom('arquivos')} disabled={busy}>
                <Upload className="h-3.5 w-3.5" /> Do computador
              </Chip>
              <Chip active={from === 'criativos'} onClick={() => setFrom('criativos')} disabled={busy}>
                <Images className="h-3.5 w-3.5" /> Do Criativos
              </Chip>
            </div>
            <p className="-mt-3 text-xs text-gray-500">{KIND_HINT[kind]}</p>

            {from === 'criativos' ? (
              rendering ? (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Desenhando os slides…
                </p>
              ) : (
                <CreativePicker onPick={(set, postId) => void pickCreative(set, postId)} busy={rendering} />
              )
            ) : (
              <div>
                <input ref={input} type="file" accept={ACCEPT[kind]} multiple={kind === 'feed'} className="hidden" 
                  onChange={(e) => {
                    add(e.target.files)
                    e.target.value = ''
                  }}
                />
                {prepared.length || preparing ? (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {prepared.map((p, i) => (
                      <figure key={p.id} className="w-36 shrink-0">
                        <div className="relative overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-inset ring-black/5">
                          {p.type === 'video' ? (
                            <video src={p.url} muted playsInline className="block w-full" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
                          ) : (
                            <img src={p.url} alt="" className="block w-full" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
                          )}
                          {kind === 'feed' && prepared.length > 1 && <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[11px] font-semibold tabular-nums text-white">{i + 1}</span>}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setSources((cur) => cur.filter((_, j) => j !== i))}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
                            aria-label="Tirar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <figcaption className="mt-1 flex items-center gap-1">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500" title={p.note ?? p.name}>
                            {p.note ?? (p.type === 'video' ? `${Math.round(p.duration ?? 0)} s` : `${p.width}×${p.height}`)}
                          </span>
                          {kind === 'feed' && prepared.length > 1 && (
                            <>
                              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="Mover para a esquerda">
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" disabled={busy || i === prepared.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="Mover para a direita">
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                    {preparing && (
                      <div className="flex w-36 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-gray-400" style={{ aspectRatio: '4 / 5' }}>
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                    {kind === 'feed' && prepared.length < 20 && !preparing && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => input.current?.click()}
                        className="flex w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50"
                        style={{ aspectRatio: '4 / 5' }}
                      >
                        <Upload className="h-4 w-4" /> Mais
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      add(e.dataTransfer.files)
                    }}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-sm text-gray-500 transition-colors hover:bg-gray-50"
                  >
                    <Upload className="h-5 w-5" />
                    <span>
                      <span className="font-medium text-gray-900">Escolher {kind === 'reel' ? 'o vídeo' : kind === 'story' ? 'a foto ou o vídeo' : 'fotos ou vídeos'}</span> ou arrastar para cá
                    </span>
                  </button>
                )}
                {kind === 'feed' && prepared.length === 1 && prepared[0].type === 'video' && <p className="mt-2 text-xs text-gray-500">Um vídeo sozinho no feed sai como reels.</p>}
              </div>
            )}

            {kind !== 'story' && (
              <label className="block">
                <span className="flex items-baseline justify-between text-xs font-medium text-gray-700">
                  Legenda
                  <span className={cn('font-normal tabular-nums', caption.length > 2200 || hashtags > HASHTAG_LIMIT ? 'text-rose-600' : 'text-gray-400')}>
                    {caption.length}/2.200 · {hashtags}/{HASHTAG_LIMIT} hashtags
                  </span>
                </span>
                <textarea className={cn(FIELD, 'mt-1 py-2 leading-relaxed')} rows={6} value={caption} disabled={busy} onChange={(e) => setCaption(e.target.value)} placeholder="Escreva a legenda, com as hashtags no fim." />
              </label>
            )}
            {kind !== 'story' && (
              <CaptionCheck value={caption} onChange={setCaption} disabled={busy} />
            )}

            {isReel && <TrialOption value={trial} onChange={setTrial} disabled={busy} />}
            {isReel && !trial && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Switch checked={shareToFeed} onCheckedChange={setShareToFeed} disabled={busy} />
                Mostrar também na grade do perfil
              </label>
            )}

            {step && (
              <ol className="grid gap-1.5 rounded-lg bg-zinc-50 p-3">
                {STEPS.filter((s) => s.id !== 'processando' || hasVideo).map((s) => {
                  const order = STEPS.findIndex((x) => x.id === s.id)
                  const now = STEPS.findIndex((x) => x.id === step)
                  const state = order < now || step === 'publicado' ? 'done' : order === now ? 'now' : 'next'
                  return (
                    <li key={s.id} className={cn('flex items-center gap-2 text-sm', state === 'next' ? 'text-gray-400' : 'text-gray-800')}>
                      {state === 'done' ? <Check className="h-4 w-4 text-emerald-600" /> : state === 'now' ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4" />}
                      {s.label}
                    </li>
                  )
                })}
              </ol>
            )}

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {problem && prepared.length > 0 && <p className="mr-auto text-xs text-gray-500">{problem}</p>}
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={() => void publish()} disabled={!!problem || busy || preparing || rendering}>
                {busy ? 'Publicando…' : trial && isReel ? 'Publicar teste' : 'Publicar agora'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
