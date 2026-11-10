import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CaptionCheck } from '@/features/instagram-ia/CaptionCheck'
import { crmContext, useCrm } from '@/features/crm/crmStore'
import { moduleOn } from '@/features/crm/modules'
import { loadAccounts, prepareImage, prepareVideo, publishPost, type IgAccount, type PublishStep } from '@/features/crm/instagram'
import { TrialOption } from '@/features/crm/TrialOption'
import type { TrialStrategy } from '@/features/crm/trialReels'
import { writeCaption } from './captionAi'
import { useAiAvailable } from './link'
import { SceneRunner, type SceneInput } from './scene'
import { sceneDataOf } from './sceneEdit'
import { useEditor } from './store'
import { videoSupported } from './video'
import { sizeOf, type CodeScene, type CreativeSet } from './types'

/**
 * Publicar a animação como Reels direto do estúdio de vídeo (2026-11-09; o usuário: "permita postar como reels
 * direto do editor de vídeo"). O MP4 sai neste navegador (o mesmo do "Baixar MP4"), a capa é um quadro escolhido
 * do próprio vídeo e a legenda pode ser escrita pela IA a partir da narração e do contexto da conta
 * (`writeCaption`). Publica pela mesma função do resto do app (`publishPost`, Edge Function `instagram`), só
 * quando a pessoa clica. Sem programar: a fila programada do servidor gera vídeo de post, não de cena em código.
 */

const STEP_LABEL: Record<PublishStep | 'gerando', string> = {
  gerando: 'Gerando o vídeo',
  enviando: 'Enviando o vídeo',
  preparando: 'O Instagram prepara o reels',
  processando: 'O Instagram processa o vídeo',
  publicado: 'Publicado',
}
const field = 'h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Input = Omit<SceneInput, 'code' | 'width' | 'height' | 'duration'>

/** O quadro de capa: no meio da segunda parte (a animação já montada), ou pouco depois da metade. */
const defaultCoverAt = (scene: CodeScene) => {
  const parts = sceneDataOf(scene.data).parts
  return parts?.[1] ? Math.min(scene.duration - 0.2, (parts[1].start + parts[1].end) / 2) : scene.duration * 0.55
}

export const ScenePublish: React.FC<{
  set: CreativeSet
  scene: CodeScene
  open: boolean
  onClose: () => void
  /** O MP4 da cena (o mesmo do "Baixar MP4"). */
  render: (onProgress: (p: number) => void) => Promise<Blob>
  /** O que a cena recebe (imagens, marca, dados) para desenhar o quadro da capa. */
  input: () => Promise<Input>
}> = ({ set, scene, open, onClose, render, input }) => {
  const ai = useAiAvailable()
  const [accounts, setAccounts] = useState<IgAccount[] | null>(null)
  const [teamId, setTeamId] = useState<string>()
  const [accountId, setAccountId] = useState('')
  const [problem, setProblem] = useState<string>()
  const [caption, setCaption] = useState(scene.caption ?? '')
  const [writing, setWriting] = useState(false)
  const [shareToFeed, setShareToFeed] = useState(true)
  const [trial, setTrial] = useState<TrialStrategy | null>(null)
  const [coverAt, setCoverAt] = useState(() => defaultCoverAt(scene))
  const [coverUrl, setCoverUrl] = useState<string>()
  const [step, setStep] = useState<PublishStep | 'gerando' | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ permalink?: string } | null>(null)
  const runner = useRef<SceneRunner | null>(null)
  const { width, height } = sizeOf(scene.format)
  const vertical = height / width > 1.7
  const busy = step !== null && !done

  useEffect(() => {
    if (!open) return
    setDone(null)
    setStep(null)
    setCaption(scene.caption ?? '')
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
        setProblem(list.length ? undefined : 'Nenhuma conta do Instagram conectada nesta conta.')
      } catch (err) {
        if (!alive) return
        setProblem(err instanceof Error ? err.message : 'Não consegui ler as contas do Instagram.')
        setAccounts([])
      }
    })()
    return () => { alive = false }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Um worker da cena enquanto o diálogo está aberto, para desenhar a capa escolhida
  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      const r = new SceneRunner({ code: scene.code, width, height, duration: scene.duration, ...(await input()) })
      try {
        await r.load()
        if (alive) runner.current = r
        else r.dispose()
        if (alive) setCoverAt((t) => t)
      } catch {
        r.dispose()
      }
    })()
    return () => {
      alive = false
      runner.current?.dispose()
      runner.current = null
    }
  }, [open, scene.code, scene.duration, scene.format]) // eslint-disable-line react-hooks/exhaustive-deps

  const coverBlob = async (t: number, w: number) => {
    const r = runner.current
    if (!r) throw new Error('A cena ainda está carregando.')
    const bmp = await r.frame(t)
    const c = Object.assign(document.createElement('canvas'), { width: w, height: Math.round((w * bmp.height) / bmp.width) })
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('capa'))), 'image/jpeg', 0.9))
  }

  // A prévia da capa acompanha o controle (o quadro pedido por último ganha)
  useEffect(() => {
    if (!open) return
    let alive = true
    const timer = setTimeout(async () => {
      for (let i = 0; i < 40 && !runner.current && alive; i++) await new Promise((r) => setTimeout(r, 250))
      if (!alive || !runner.current) return
      try {
        const url = URL.createObjectURL(await coverBlob(coverAt, 270))
        if (alive) setCoverUrl((old) => { if (old) URL.revokeObjectURL(old); return url })
        else URL.revokeObjectURL(url)
      } catch { /* a prévia tenta de novo no próximo movimento */ }
    }, 120)
    return () => { alive = false; clearTimeout(timer) }
  }, [open, coverAt])

  const saveCaption = (text: string) => {
    if ((scene.caption ?? '') === text) return
    useEditor.getState().edit((s) => ({ ...s, scenes: (s.scenes ?? []).map((x) => (x.id === scene.id ? { ...x, caption: text } : x)) }))
  }

  const write = async () => {
    setWriting(true)
    try {
      const parts = sceneDataOf(scene.data).parts ?? []
      const texts = parts.length ? parts.map((p, i) => `${i + 1}. ${p.label}: ${p.text}`).join('\n') : scene.prompt ?? scene.name
      const out = await writeCaption(set, { id: scene.id, name: scene.name, texts })
      setCaption(out.caption)
      saveCaption(out.caption)
      toast.success('Legenda escrita. Revise antes de publicar.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui escrever a legenda.')
    } finally {
      setWriting(false)
    }
  }

  const publish = async () => {
    const account = accounts?.find((a) => a.id === accountId)
    if (!teamId || !account) return
    saveCaption(caption)
    try {
      setStep('gerando')
      setProgress(0)
      const blob = await render(setProgress)
      const file = await prepareVideo(new File([blob], `${scene.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'reels'}.mp4`, { type: 'video/mp4' }))
      const cover = await prepareImage(await coverBlob(coverAt, 1080), 'capa.jpg')
      const published = await publishPost({ teamId, accountId: account.id, kind: 'reel', caption, files: [file], shareToFeed, cover, trial: trial ? { strategy: trial, title: scene.name } : undefined, onStep: setStep })
      URL.revokeObjectURL(file.url)
      URL.revokeObjectURL(cover.url)
      setDone({ permalink: published.permalink })
      toast.success(trial ? 'Teste publicado: só quem não segue vê.' : 'Reels publicado.')
    } catch (err) {
      setStep(null)
      toast.error(err instanceof Error ? err.message : 'Não consegui publicar.')
    }
  }

  const tooShort = scene.duration < 3
  const tooLong = scene.duration > 15 * 60
  const account = accounts?.find((a) => a.id === accountId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar como Reels</DialogTitle>
          <DialogDescription>{scene.name} · {scene.duration.toFixed(1)} s · {width}×{height}. O vídeo é gerado neste navegador e publicado no Instagram da conta.</DialogDescription>
        </DialogHeader>

        {accounts === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo as contas do Instagram…</p>
        ) : problem ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p>{problem} Você ainda pode baixar o MP4 e postar pelo celular.</p>
            <Link to="/crm/instagram" className="font-medium text-gray-900 underline">Conectar no CRM › Instagram</Link>
          </div>
        ) : done ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p>{trial ? <>Teste publicado em @{account?.username}: só quem não segue vê. Acompanhe em CRM › Instagram › Testes.</> : <>Reels publicado em @{account?.username}.</>}</p>
            <div className="flex gap-2">
              {done.permalink && <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white"><a href={done.permalink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver no Instagram</a></Button>}
              <Button size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
            <div>
              <p className="mb-1 text-xs font-medium text-gray-700">Capa</p>
              <div className="relative aspect-[9/16] w-[150px] overflow-hidden rounded-lg bg-gray-900 shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
                {coverUrl ? <img src={coverUrl} alt="Capa do reels" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-white/70" /></span>}
              </div>
              <input type="range" aria-label="Quadro da capa" min={0} max={Math.max(0.1, scene.duration - 0.05)} step={0.05} value={coverAt} disabled={busy} onChange={(e) => setCoverAt(e.target.valueAsNumber)} className="mt-2 w-full accent-gray-900" />
              <p className="text-[11px] tabular-nums text-gray-500">Quadro em {coverAt.toFixed(1)} s</p>
            </div>
            <div className="space-y-3">
              {accounts.length > 1 && (
                <label className="block text-xs font-medium text-gray-700">Conta
                  <select className={cn(field, 'mt-1')} value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={busy}>
                    {accounts.map((a) => (<option key={a.id} value={a.id}>@{a.username}</option>))}
                  </select>
                </label>
              )}
              {accounts.length === 1 && <p className="text-xs text-gray-600">Conta: <b>@{accounts[0].username}</b></p>}
              <label className="block text-xs font-medium text-gray-700">Legenda
                <textarea className={cn(field, 'mt-1 h-36 py-1.5 leading-snug')} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={(e) => saveCaption(e.target.value)} disabled={busy || writing} placeholder={writing ? 'A IA está escrevendo a legenda…' : 'A legenda do reels.'} />
              </label>
              {!writing && (
                <CaptionCheck
                  value={caption}
                  disabled={busy}
                  onChange={(next) => {
                    setCaption(next)
                    saveCaption(next)
                  }}
                />
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 bg-white text-xs" disabled={busy || writing || !ai} onClick={() => void write()} title={ai ? 'A IA escreve a partir da narração, do Plano, da voz da marca e do Instagram da conta' : 'Conecte a IA desta máquina (o conector)'}>
                  {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-violet-600" />} {caption.trim() ? 'Reescrever com IA' : 'Escrever com IA'}
                </Button>
                <span className="ml-auto text-[11px] tabular-nums text-gray-400">{caption.length}/2200</span>
              </div>
              <TrialOption value={trial} onChange={setTrial} disabled={busy} />
              {!trial && <label className="flex items-center justify-between gap-2 text-sm text-gray-700">Mostrar também no feed<Switch checked={shareToFeed} onCheckedChange={setShareToFeed} disabled={busy} /></label>}
              {!vertical && <p className="text-xs text-amber-700">O vídeo não está em 9:16: no reels ele aparece com faixas.</p>}
              {tooShort && <p className="text-xs text-amber-700">O reels precisa de pelo menos 3 segundos.</p>}
              {tooLong && <p className="text-xs text-amber-700">O reels vai até 15 minutos.</p>}
              {!videoSupported() && <p className="text-xs text-amber-700">Este navegador não gera vídeo: use o Chrome ou o Edge atualizados.</p>}
              {step && <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> {STEP_LABEL[step]}{step === 'gerando' ? `… ${Math.round(progress * 100)}%` : '…'}</p>}
              <Button className="w-full gap-1.5" disabled={busy || !account || tooShort || tooLong || !videoSupported() || !coverUrl} onClick={() => void publish()}><Send className="h-4 w-4" /> Publicar o reels agora</Button>
              <p className="text-[11px] text-gray-500">Publica só quando você clicar. Leva de 1 a 3 minutos (gerar, enviar e o Instagram processar).</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
