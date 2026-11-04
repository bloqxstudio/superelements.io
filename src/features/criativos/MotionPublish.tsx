import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, ExternalLink, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { crmContext, useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { FEED_RATIO, feedRatio, loadAccounts, prepareImage, prepareVideo, publishPost, type IgAccount, type Prepared, type PublishStep } from '@/features/crm/instagram'
import { insertStories } from '@/features/crm/stories'
import { approveStory } from '@/features/crm/storyPipeline'
import type { StoryIdea } from '@/features/crm/storyPlan'
import { useEditor } from './store'
import { hasMotion, postOutput, slideAsPost, slideDuration, slideHasMotion, timeline } from './motion'
import { slideToBlob } from './render'
import { audioFor, postToCarousel, postToMp4, videoSupported } from './video'
import { sizeOf, type Post } from './types'

/**
 * Publicar um post do Criativos no Instagram da conta, direto do editor, do
 * canvas ou do estúdio de motion: feed (foto, carrossel de fotos ou carrossel
 * misto com os slides animados em vídeo), reels (post animado) ou story. Gera
 * aqui as imagens e o MP4 e publica agora; reels e story também entram na fila
 * programada, que o servidor publica no horário mesmo com este computador desligado.
 */

type When = 'agora' | 'programar'

const STEP_LABEL: Record<PublishStep | 'gerando', string> = {
  gerando: 'Gerando o vídeo',
  enviando: 'Enviando o vídeo',
  preparando: 'O Instagram prepara o post',
  processando: 'Processando o vídeo',
  publicado: 'Publicado',
}

const field = 'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const localInput = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const MotionPublish: React.FC<{ post: Post; open: boolean; onClose: () => void }> = ({ post, open, onClose }) => {
  const [accounts, setAccounts] = useState<IgAccount[] | null>(null)
  const [teamId, setTeamId] = useState<string>()
  const [problem, setProblem] = useState<string>()
  const [accountId, setAccountId] = useState('')
  const { width, height } = sizeOf(post.format)
  const vertical = height / width > 1.7
  const multi = post.slides.length > 1
  const animated = hasMotion(post)
  const kinds = animated ? (['feed', 'reel', 'story'] as const) : (['feed', 'story'] as const)
  const [kind, setKind] = useState<'reel' | 'story' | 'feed'>(() => (!animated ? (vertical ? 'story' : 'feed') : multi && postOutput(post) === 'carousel' ? 'feed' : 'reel'))
  const [caption, setCaption] = useState(post.caption ?? '')
  const [shareToFeed, setShareToFeed] = useState(true)
  const [when, setWhen] = useState<When>('agora')
  const [at, setAt] = useState(() => localInput(Date.now() + 60 * 60_000))
  const [step, setStep] = useState<PublishStep | 'gerando' | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ permalink?: string; scheduled?: number } | null>(null)
  const total = timeline(post).total

  useEffect(() => {
    if (!open) return
    setDone(null)
    setStep(null)
    setCaption(post.caption ?? '')
    let alive = true
    ;(async () => {
      try {
        const team = useCrm.getState().team ?? (await crmContext()).team
        if (!moduleOn(team, 'instagram')) throw new Error('O módulo Instagram está desligado nesta conta.')
        const list = await loadAccounts(team.id)
        if (!alive) return
        setTeamId(team.id)
        setAccounts(list)
        setAccountId((cur) => cur || list[0]?.id || '')
        if (!list.length) setProblem('Nenhuma conta do Instagram conectada nesta conta.')
      } catch (err) {
        if (alive) setProblem(err instanceof Error ? err.message : 'Não consegui ler as contas do Instagram.')
        if (alive) setAccounts([])
      }
    })()
    return () => {
      alive = false
    }
  }, [open, post.caption])

  const account = accounts?.find((a) => a.id === accountId)
  const busy = step !== null && !done
  const tooShort = kind === 'reel' && total < 3
  const storyTooLong = kind === 'story' && animated && total > 60
  const noVideo = (kind === 'reel' || (animated && kind !== 'feed') || (kind === 'feed' && post.slides.some(slideHasMotion))) && !videoSupported()
  // Carrossel: cada slide um item; os animados viram vídeo (3 a 60 s cada), os parados, foto
  const ratio = width / height
  const videoSlides = post.slides.filter(slideHasMotion)
  const outside = ratio < FEED_RATIO.min - 0.01 || ratio > FEED_RATIO.max + 0.01
  // Foto fora da proporção do feed é cortada ao centro; vídeo não dá para cortar
  const feedOff = kind === 'feed' && outside && videoSlides.length > 0
  const shortItem = kind === 'feed' && videoSlides.some((s) => slideDuration(post, s) < 3)
  const carouselBlocked = kind === 'feed' && (feedOff || shortItem || post.slides.length > 20)

  const run = async () => {
    if (!teamId || !account) return
    try {
      if (kind === 'feed') {
        setStep('gerando')
        setProgress(0)
        await useEditor.getState().ensureAssets()
        const { set: current, images } = useEditor.getState()
        const fresh = current?.posts.find((p) => p.id === post.id) ?? post
        const items = await postToCarousel(fresh, images, { onProgress: setProgress, audio: current ? await audioFor(fresh, current.assets) : undefined, base: post.name || 'slide' })
        const files: Prepared[] = []
        for (const item of items) files.push(item.type === 'video' ? await prepareVideo(new File([item.blob], item.name, { type: 'video/mp4' })) : await prepareImage(item.blob, item.name, feedRatio(width, height)))
        const published = await publishPost({ teamId, accountId: account.id, kind: 'feed', caption, files, onStep: setStep })
        files.forEach((f) => URL.revokeObjectURL(f.url))
        setDone({ permalink: published.permalink })
        toast.success(files.length > 1 ? 'Carrossel publicado.' : 'Post publicado.')
        return
      }
      if (kind === 'story' && !animated && when === 'agora') {
        // Story parado: a foto do primeiro slide
        setStep('gerando')
        await useEditor.getState().ensureAssets()
        const { set: current, images } = useEditor.getState()
        const fresh = current?.posts.find((p) => p.id === post.id) ?? post
        const file = await prepareImage(await slideToBlob(fresh.slides[0], fresh.format, images, 'jpg'), `${post.name || 'story'}.jpg`)
        const published = await publishPost({ teamId, accountId: account.id, kind: 'story', caption: '', files: [file], onStep: setStep })
        URL.revokeObjectURL(file.url)
        setDone({ permalink: published.permalink })
        toast.success('Story publicado.')
        return
      }
      if (when === 'programar') {
        const publishAt = new Date(at).getTime()
        if (!Number.isFinite(publishAt) || publishAt < Date.now() + 60_000) throw new Error('Escolha um horário daqui a pelo menos 1 minuto.')
        setStep('gerando')
        await useEditor.getState().flush()
        const set = useEditor.getState().set!
        const [row] = await insertStories([
          {
            teamId,
            accountId: account.id,
            publishAt,
            pillar: animated ? 'motion' : 'criativo',
            title: animated ? `${post.name} (motion)` : post.name,
            idea: {} as StoryIdea,
            setId: set.id,
            setProjectId: set.shared ? set.projectId : undefined,
            postId: post.id,
            status: 'criativo',
            kind,
            caption: kind === 'reel' ? caption : '',
            shareToFeed,
          },
        ])
        await approveStory(row, account.id)
        setDone({ scheduled: publishAt })
        toast.success('Programado. O servidor publica no horário.')
        return
      }
      setStep('gerando')
      setProgress(0)
      await useEditor.getState().ensureAssets()
      const { set: current, images } = useEditor.getState()
      const fresh = current?.posts.find((p) => p.id === post.id) ?? post
      const blob = await postToMp4(fresh, images, { onProgress: setProgress, audio: current ? await audioFor(fresh, current.assets) : undefined })
      const file = await prepareVideo(new File([blob], `${post.name || 'motion'}.mp4`, { type: 'video/mp4' }))
      const published = await publishPost({ teamId, accountId: account.id, kind, caption: kind === 'reel' ? caption : '', files: [file], shareToFeed, onStep: setStep })
      URL.revokeObjectURL(file.url)
      setDone({ permalink: published.permalink })
      toast.success(kind === 'reel' ? 'Reels publicado.' : 'Story publicado.')
    } catch (err) {
      setStep(null)
      toast.error(err instanceof Error ? err.message : 'Não consegui publicar.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar no Instagram</DialogTitle>
          <DialogDescription>
            {post.name} · {post.slides.length} {post.slides.length === 1 ? 'slide' : 'slides'} · {width}×{height}{animated ? ` · ${total.toFixed(1)} s de animação. O vídeo é gerado neste navegador.` : '.'}
          </DialogDescription>
        </DialogHeader>

        {accounts === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo as contas do Instagram…</p>
        ) : problem ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p>{problem}</p>
            <Link to="/crm/instagram" className="font-medium text-gray-900 underline">Conectar no CRM › Instagram</Link>
          </div>
        ) : done ? (
          <div className="space-y-3 text-sm text-gray-700">
            {done.scheduled ? (
              <p>Na fila para {new Date(done.scheduled).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}, em @{account?.username}. Acompanhe em CRM › Instagram › Stories.</p>
            ) : (
              <p>Publicado em @{account?.username}.</p>
            )}
            <div className="flex gap-2">
              {done.permalink && <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white"><a href={done.permalink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver no Instagram</a></Button>}
              {done.scheduled && <Button asChild variant="outline" size="sm" className="bg-white"><Link to="/crm/instagram?aba=stories">Ver a fila</Link></Button>}
              <Button size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.length > 1 && (
              <label className="block text-xs font-medium text-gray-700">Conta
                <select className={cn(field, 'mt-1')} value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={busy}>
                  {accounts.map((a) => (<option key={a.id} value={a.id}>@{a.username}</option>))}
                </select>
              </label>
            )}
            <div className={cn('grid gap-1.5', kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {kinds.map((k) => (
                <button key={k} type="button" disabled={busy} onClick={() => { setKind(k); if (k === 'feed') setWhen('agora') }} className={cn('h-9 rounded-md border text-sm font-medium', kind === k ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>{k === 'reel' ? 'Reels' : k === 'story' ? 'Story' : multi ? 'Carrossel' : 'Feed'}</button>
              ))}
            </div>
            {!animated && kind === 'feed' && <p className="text-xs text-gray-600">{multi ? `Carrossel de ${post.slides.length} fotos.` : 'Uma foto no feed.'}{outside ? ` O feed vai de 4:5 a 1,91:1: ${multi ? 'as fotos saem cortadas' : 'a foto sai cortada'} ao centro.` : ''} Para um reels ou um carrossel com vídeo, anime o post na aba Motion.</p>}
            {!animated && kind === 'story' && multi && <p className="text-xs text-gray-600">{when === 'agora' ? 'Story agora leva só o primeiro slide.' : `Programado, sai uma sequência de ${post.slides.length} stories.`}</p>}
            {noVideo && <p className="text-xs text-amber-700">Este navegador não gera vídeo: use o Chrome ou o Edge atualizados.</p>}
            {kind === 'feed' && animated && (
              <div className="space-y-1 text-xs text-gray-600">
                <p>{post.slides.length} itens: {videoSlides.length ? `${videoSlides.map((s) => `slide ${post.slides.indexOf(s) + 1}`).join(', ')} em vídeo` : 'nenhum slide animado'}{videoSlides.length < post.slides.length ? `, ${post.slides.length - videoSlides.length} em foto` : ''}. Escolha o que anda na aba Motion (Animar só a capa, ou slide a slide).</p>
                {feedOff && <p className="text-amber-700">O carrossel do feed vai de 4:5 a 1,91:1; este post é {width}×{height}. Use Reels ou Story, ou troque o formato.</p>}
                {shortItem && <p className="text-amber-700">Cada vídeo do carrossel precisa de pelo menos 3 segundos: aumente o tempo do slide.</p>}
                {videoSlides.length > 0 && <p className="text-gray-500">Vídeos de {videoSlides.map((s) => `${slideDuration(slideAsPost(post, s), s).toFixed(1)} s`).join(', ')}.</p>}
              </div>
            )}
            {kind !== 'feed' && !vertical && <p className="text-xs text-amber-700">O post não está em 9:16: no {kind === 'reel' ? 'reels' : 'story'} ele aparece com faixas. Para a tela cheia, use o formato Story 9:16.</p>}
            {kind === 'story' && !vertical && when === 'programar' && <p className="text-xs text-amber-700">A fila programada só aceita story em 9:16.</p>}
            {tooShort && <p className="text-xs text-amber-700">O reels precisa de pelo menos 3 segundos: aumente o tempo do slide.</p>}
            {storyTooLong && <p className="text-xs text-amber-700">Story em vídeo vai até 60 segundos.</p>}
            {kind === 'feed' && (
              <label className="block text-xs font-medium text-gray-700">Legenda
                <textarea className={cn(field, 'mt-1 h-28 py-1.5 leading-snug')} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} placeholder="A legenda do carrossel." />
              </label>
            )}
            {kind === 'reel' && (
              <>
                <label className="block text-xs font-medium text-gray-700">Legenda
                  <textarea className={cn(field, 'mt-1 h-28 py-1.5 leading-snug')} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} placeholder="A legenda do reels." />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm text-gray-700">Mostrar também no feed<Switch checked={shareToFeed} onCheckedChange={setShareToFeed} disabled={busy} /></label>
              </>
            )}
            {kind === 'story' && <p className="text-xs text-gray-500">Story não leva legenda pela API.</p>}

            {kind === 'feed' && <p className="text-xs text-gray-500">O carrossel publica agora; a fila programada recebe reels e stories.</p>}
            <div className={cn('grid grid-cols-2 gap-1.5', kind === 'feed' && 'hidden')}>
              {(['agora', 'programar'] as const).map((w) => (
                <button key={w} type="button" disabled={busy} onClick={() => setWhen(w)} className={cn('h-9 rounded-md border text-sm font-medium', when === w ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>{w === 'agora' ? 'Publicar agora' : 'Programar'}</button>
              ))}
            </div>
            {when === 'programar' && (
              <label className="block text-xs font-medium text-gray-700">Dia e hora
                <input type="datetime-local" className={cn(field, 'mt-1')} value={at} onChange={(e) => setAt(e.target.value)} disabled={busy} />
                <span className="mt-1 block font-normal text-gray-500">O servidor publica no horário, mesmo com este computador desligado. Aprovar aqui conta como a aprovação.</span>
              </label>
            )}

            {step && (
              <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> {STEP_LABEL[step]}{step === 'gerando' && when === 'agora' ? `… ${Math.round(progress * 100)}%` : '…'}</p>
            )}
            <Button className="w-full gap-1.5" disabled={busy || !account || tooShort || storyTooLong || carouselBlocked || noVideo || (kind === 'story' && !vertical && when === 'programar')} onClick={() => void run()}>
              {when === 'agora' ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />} {when === 'agora' ? `Publicar ${kind === 'reel' ? 'o reels' : kind === 'story' ? 'o story' : multi ? 'o carrossel' : 'no feed'}` : 'Programar'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** O mesmo diálogo, pelo nome de fora do motion (editor e canvas dos Criativos). */
export const PublishPost = MotionPublish
