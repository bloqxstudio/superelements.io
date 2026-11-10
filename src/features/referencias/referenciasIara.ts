import { useIaraScreen, type IaraAction, type IaraDone } from '@/features/iara/store'
import { useWork } from '@/features/ia/work'
import { STYLE_IDS } from '@/features/criativos/videoDirection'
import { videoFromChat } from '@/features/criativos/videoFromChat'
import type { Reference } from './api'
import { KIND_LABEL } from './rules'

/**
 * A tela de Referências na Iara (2026-11-10; o usuário: "identifique quando seleciono uma referência, deve selecionar
 * a referência no chat para recriar algo por ali e permitir criar um novo vídeo com base nisso"). A referência
 * selecionada na tela vira a seleção do chat (o chip da caixa e "esta referência" no pedido), a Iara pode selecionar
 * pelo id e criar um vídeo novo a partir dela pelo mesmo caminho do criador, em modo agente.
 */

type Result = { done: IaraDone[]; data?: unknown }
type Full = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<Result> }

const str = (v: unknown, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const line = (r: Reference) => `- ${r.id} · ${KIND_LABEL[r.kind]}${r.title ? ` "${r.title}"` : ''}${r.author ? ` de @${r.author}` : ''}${r.starred ? ' ★' : ''} · ${r.url}`

export function useReferencesIara(items: Reference[] | undefined, selected: Reference | undefined, select: (id: string | undefined) => void) {
  const find = (id: unknown) => (typeof id === 'string' && id ? items?.find((r) => r.id === id) : undefined)
  const actions: Full[] = [
    {
      name: 'referencia_selecionar',
      doc: '{"referencia":id} — seleciona uma referência na tela de Referências (vira "esta referência"); "referencia":"" tira a seleção.',
      run: async (a) => {
        if (a.referencia === '') { select(undefined); return { label: 'Seleção tirada.', ok: true } }
        const r = find(a.referencia)
        if (!r) return { label: 'Essa referência não está na tela.', ok: false }
        select(r.id)
        return { label: `Selecionada: ${r.title || KIND_LABEL[r.kind]}`, ok: true }
      },
    },
    {
      name: 'video_de_referencia',
      doc: `{"referencia"?:id (padrão: a selecionada),"como"?:"igual"|"novo","assunto"?:string (no "novo"),"regras"?:string (obrigatórias, uma por linha),"estilo"?:${STYLE_IDS.map((s) => `"${s}"`).join('|')},"copy"?:string (a narração exata),"conjunto"?:id ou nome,"ler_movimento"?:boolean} — cria um VÍDEO NOVO a partir da referência, pelo criador de vídeo em modo agente: lê o movimento (reel do Instagram, pelo link, só agora), a IA monta ficha e decupagem, narra, e o Claude Code ou o Codex escreve, renderiza, compara lado a lado com a referência e corrige. Leva até ~20 min. Use este, não criar_video_explicativo, quando houver uma referência.`,
      label: (a) => `Vídeo a partir de "${find(a.referencia)?.title || selected?.title || 'a referência'}"`,
      long: true,
      run: async () => ({ label: 'Vídeo criado.', ok: true }),
      exec: async (a) => {
        const r = find(a.referencia) ?? selected
        if (!r) throw new Error('Selecione uma referência (ou diga qual) para criar o vídeo.')
        const how = a.como === 'novo' ? 'novo' : 'igual'
        const steps: string[] = []
        const { set, scene } = await videoFromChat({
          reference: r,
          how,
          topic: str(a.assunto, 300),
          rules: str(a.regras),
          style: str(a.estilo, 20),
          copy: str(a.copy, 1500),
          set: str(a.conjunto, 120),
          motion: a.ler_movimento !== false,
          onStep: (label, detail) => {
            const text = `${label}${detail ? `: ${detail}` : ''}`
            steps.push(text)
            useWork.setState({ label: `Vídeo · ${text}`.slice(0, 140) })
          },
        })
        const report = (scene.data as { direction?: { agentReport?: string } } | undefined)?.direction?.agentReport
        return {
          done: [{ label: `Vídeo criado: "${scene.name}" no conjunto ${set.name}. Abra em /motion/${set.id}/video?id=${scene.id}`, ok: true }],
          data: { video: scene.id, conjunto: set.id, endereco: `/motion/${set.id}/video?id=${scene.id}`, relato_do_agente: report, passos: steps.slice(-12) },
        }
      },
    },
  ]
  useIaraScreen({
    id: 'referencias',
    title: 'Referências',
    describe: () =>
      [
        `Tela de Referências da conta: ${items?.length ?? 0} referências.`,
        selected ? `Referência SELECIONADA ("esta referência", "essa", "ela"):\n${line(selected)}${selected.notes ? `\n  O que tem de bom: ${selected.notes.slice(0, 400)}` : ''}` : 'Nenhuma referência selecionada (a pessoa clica no círculo do cartão, ou use referencia_selecionar).',
        items?.length ? `Na tela (id · tipo · título · link):\n${items.slice(0, 30).map(line).join('\n')}` : '',
        'Para criar um vídeo a partir de uma referência (recriar como está ou conteúdo novo), use video_de_referencia; ele usa a selecionada se a pessoa não disser outra. Post ou carrossel: criar_de_referencia.',
      ].filter(Boolean).join('\n'),
    selection: () => (selected ? `Referência: ${selected.title || KIND_LABEL[selected.kind]}` : ''),
    actions,
  })
}
