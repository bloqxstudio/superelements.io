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
import { loadAccounts, prepareVideo, publishPost, type IgAccount, type PublishStep } from '@/features/crm/instagram'
import { insertStories } from '@/features/crm/stories'
import { approveStory } from '@/features/crm/storyPipeline'
import type { StoryIdea } from '@/features/crm/storyPlan'
import { useEditor } from './store'
import { timeline } from './motion'
import { audioFor, postToMp4 } from './video'
import { sizeOf, type Post } from './types'

/**
 * Publicar o motion no Instagram da conta, direto do estúdio: gera o MP4 aqui,
 * e publica agora (reels ou story) ou entra na fila programada dos stories,
 * que o servidor publica no horário mesmo com este computador desligado.
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
  const [kind, setKind] = useState<'reel' | 'story'>('reel')
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
  const storyTooLong = kind === 'story' && total > 60

  const run = async () => {
    if (!teamId || !account) return
    try {
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
            pillar: 'motion',
            title: `${post.name} (motion)`,
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
            {post.name} · {total.toFixed(1)} s · {width}×{height}. O vídeo é gerado neste navegador.
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
            <div className="grid grid-cols-2 gap-1.5">
              {(['reel', 'story'] as const).map((k) => (
                <button key={k} type="button" disabled={busy} onClick={() => setKind(k)} className={cn('h-9 rounded-md border text-sm font-medium', kind === k ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>{k === 'reel' ? 'Reels' : 'Story'}</button>
              ))}
            </div>
            {!vertical && <p className="text-xs text-amber-700">O post não está em 9:16: no {kind === 'reel' ? 'reels' : 'story'} ele aparece com faixas. Para a tela cheia, use o formato Story 9:16.</p>}
            {kind === 'story' && !vertical && when === 'programar' && <p className="text-xs text-amber-700">A fila programada só aceita story em 9:16.</p>}
            {tooShort && <p className="text-xs text-amber-700">O reels precisa de pelo menos 3 segundos: aumente o tempo do slide.</p>}
            {storyTooLong && <p className="text-xs text-amber-700">Story em vídeo vai até 60 segundos.</p>}
            {kind === 'reel' && (
              <>
                <label className="block text-xs font-medium text-gray-700">Legenda
                  <textarea className={cn(field, 'mt-1 h-28 py-1.5 leading-snug')} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} placeholder="A legenda do reels." />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm text-gray-700">Mostrar também no feed<Switch checked={shareToFeed} onCheckedChange={setShareToFeed} disabled={busy} /></label>
              </>
            )}
            {kind === 'story' && <p className="text-xs text-gray-500">Story não leva legenda pela API.</p>}

            <div className="grid grid-cols-2 gap-1.5">
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
            <Button className="w-full gap-1.5" disabled={busy || !account || tooShort || storyTooLong || (kind === 'story' && !vertical && when === 'programar')} onClick={() => void run()}>
              {when === 'agora' ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />} {when === 'agora' ? `Publicar ${kind === 'reel' ? 'o reels' : 'o story'}` : 'Programar'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
