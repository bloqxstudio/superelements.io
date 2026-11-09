import React, { useEffect, useState } from 'react'
import { Clapperboard, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { listSets } from '@/features/criativos/storage'
import type { SetSummary } from '@/features/criativos/types'
import { useIara } from '@/features/iara/store'
import { registerAttachment } from '@/features/iara/workControl'
import { cn } from '@/lib/utils'
import { referenceShotUrl, type Reference } from './api'
import { KIND_LABEL } from './rules'

/**
 * Recriar um criativo a partir de uma referência (2026-11-09; o usuário: "crie um fluxo pra recriar um criativo
 * com base nessa referência, seja criar um vídeo ou post, podendo por ex. criar com base num conteúdo novo ou
 * recriar como está").
 *
 * Usa as linhas de produção que já existem, pela Iara:
 *   - post, carrossel ou story: `criar_de_referencia` (o designer reproduz o layout, a hierarquia e o estilo das
 *     imagens da referência, na marca do conjunto); a capa e os quadros da referência vão como anexos;
 *   - vídeo: `criar_video_explicativo` (Reels 9:16 no estúdio do Motion, na marca), com o roteiro e o estilo
 *     tirados da referência.
 * "Recriar como está" mantém a estrutura, o ritmo e a mensagem, reescritos na voz e na marca da conta. Nos dois
 * modos, nada de logo, nome, foto ou texto literal da outra empresa.
 */

const db = supabase

async function accountSets(teamId: string, isHome: boolean): Promise<SetSummary[]> {
  const q = db.from('space_projects').select('id')
  const { data } = await (isHome ? q.or(`team_id.eq.${teamId},team_id.is.null`) : q.eq('team_id', teamId))
  return listSets(((data ?? []) as { id: string }[]).map((p) => p.id))
}

const toDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

type What = 'post' | 'video'
type How = 'novo' | 'igual'

export const RecreateDialog: React.FC<{ reference: Reference; open: boolean; onClose: () => void }> = ({ reference: r, open, onClose }) => {
  const team = useCrm((s) => s.team)
  const moving = r.kind === 'reels' || r.kind === 'video' || r.kind === 'motion'
  const [what, setWhat] = useState<What>(moving ? 'video' : 'post')
  const [how, setHow] = useState<How>('novo')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<'4x5' | '1x1' | '9x16'>(r.kind === 'story' || moving ? '9x16' : '4x5')
  const [sets, setSets] = useState<SetSummary[]>()
  const [setId, setSetId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !team) return
    void accountSets(team.id, team.isHome).then((l) => { setSets(l); setSetId((cur) => cur || l[0]?.id || '') }, () => setSets([]))
  }, [open, team])

  const chosen = sets?.find((s) => s.id === setId)
  const ready = !!chosen && (how === 'igual' || topic.trim().length > 3)

  const start = async () => {
    if (!team || !chosen || busy) return
    setBusy(true)
    try {
      // A capa e os quadros da referência viram anexos da conversa (o designer vê as imagens)
      const paths = [r.mediaPath, ...r.frames].filter((p): p is string => !!p).slice(0, 4)
      const anexos: string[] = []
      for (const [i, p] of paths.entries()) {
        try {
          const data = await toDataUrl(await referenceShotUrl(team.id, p))
          anexos.push(registerAttachment(`${r.title || 'referência'} ${i === 0 ? '(capa)' : `(quadro ${i})`}`, data).ref)
        } catch { /* sem a imagem: segue com as outras */ }
      }
      const ref = [
        `Referência: ${KIND_LABEL[r.kind]}${r.title ? ` "${r.title}"` : ''} (${r.url}${r.author ? `, de @${r.author}` : ''}${r.likes !== undefined ? `, ${r.likes} curtidas e ${r.comments ?? 0} comentários` : ''}).`,
        r.notes && `O que ela tem de bom: ${r.notes}`,
        r.caption && `Legenda original (só para entender a mensagem, não copie): ${r.caption.slice(0, 600)}`,
      ].filter(Boolean).join(' ')
      const content = how === 'novo'
        ? `Conteúdo novo: ${topic.trim()}. Use da referência só a estrutura, o ritmo, a composição e o estilo.`
        : 'Recrie como está: a mesma estrutura, a mesma sequência de telas, o mesmo ritmo e a mesma ideia central, reescritos na voz e na marca da conta (cores, fontes, logo, tom do Cérebro).'
      const rules = 'Nunca copie logo, nome, foto, rosto nem texto literal da outra empresa.'
      const prompt = what === 'post'
        ? [
            `Recrie um ${format === '9x16' ? 'story' : r.kind === 'carrossel' ? 'carrossel' : 'post'} a partir de uma referência, no conjunto "${chosen.name}", formato ${format}.`,
            anexos.length ? `Use a ação criar_de_referencia com anexo "${anexos[0]}" (os outros anexos, ${anexos.slice(1).join(', ') || 'nenhum'}, são quadros da mesma referência).` : 'Use a ação criar_de_referencia (sem anexo: descreva o layout a partir do que está abaixo).',
            ref, content, rules,
          ].join(' ')
        : [
            `Crie um vídeo (Reels 9:16) a partir de uma referência, no conjunto "${chosen.name}", com a ação criar_video_explicativo.`,
            `No briefing, descreva o roteiro cena a cena e o estilo visual que a referência usa (ritmo, legenda, tipo de animação), para o vídeo seguir essa linha.`,
            anexos.length ? `Os anexos ${anexos.join(', ')} mostram a capa e quadros da referência.` : '',
            ref, content, rules,
          ].filter(Boolean).join(' ')
      useIara.getState().ask(prompt)
      toast.success('Pedido enviado à Iara', { description: `${what === 'post' ? 'O designer monta o post' : 'A linha do vídeo começa'} no conjunto ${chosen.name}. Acompanhe no painel da Iara.` })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const option = (active: boolean) => cn('flex flex-1 items-start gap-2 rounded-lg border p-3 text-left text-sm', active ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recriar a partir da referência</DialogTitle>
          <DialogDescription>{r.title || KIND_LABEL[r.kind]}{r.author ? ` · @${r.author}` : ''}. A Iara cria na marca da conta; nada de logo, foto ou texto da outra empresa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">O que criar</p>
            <div className="flex gap-2">
              <button type="button" className={option(what === 'post')} onClick={() => setWhat('post')}>
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" /><span><b className="block">Post ou carrossel</b><span className="text-xs text-gray-500">Imagem na marca, pelo designer</span></span>
              </button>
              <button type="button" className={option(what === 'video')} onClick={() => { setWhat('video'); setFormat('9x16') }}>
                <Clapperboard className="mt-0.5 h-4 w-4 shrink-0" /><span><b className="block">Vídeo</b><span className="text-xs text-gray-500">Reels animado, no estúdio do Motion</span></span>
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">Como</p>
            <div className="flex gap-2">
              <button type="button" className={option(how === 'novo')} onClick={() => setHow('novo')}>
                <span><b className="block">Com um conteúdo novo</b><span className="text-xs text-gray-500">O estilo da referência, sobre outro assunto</span></span>
              </button>
              <button type="button" className={option(how === 'igual')} onClick={() => setHow('igual')}>
                <span><b className="block">Recriar como está</b><span className="text-xs text-gray-500">Mesma estrutura e ideia, na marca da conta</span></span>
              </button>
            </div>
          </div>
          {how === 'novo' && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-700">Sobre o quê?</span>
              <textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: por que o site do escritório precisa mostrar as obras entregues, com chamada para o WhatsApp." className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-gray-400" />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-700">Conjunto de criativos</span>
              <select value={setId} onChange={(e) => setSetId(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" disabled={!sets}>
                {!sets && <option>Carregando…</option>}
                {sets?.length === 0 && <option value="">Nenhum conjunto: crie um em Criativos</option>}
                {sets?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {what === 'post' && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-700">Formato</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm">
                  <option value="4x5">Feed 4:5</option>
                  <option value="1x1">Quadrado 1:1</option>
                  <option value="9x16">Story 9:16</option>
                </select>
              </label>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={() => void start()} disabled={!ready || busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Criar com a Iara
            </Button>
            <span className="text-xs text-gray-500">{what === 'video' ? 'Leva alguns minutos (roteiro, voz e animação).' : 'O post aparece no conjunto escolhido.'}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
