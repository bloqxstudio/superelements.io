import { useRef } from 'react'
import { useIaraScreen, type IaraAction, type IaraDone } from '@/features/iara/store'
import type { Reference as SavedReference } from '@/features/referencias/api'
import type { CaptionStyle } from './sceneEdit'
import type { CreativeSet } from './types'
import { BG_LABEL, SHOT_TRANSITION_LABEL, STYLE_IDS, VIDEO_STYLES, parseShots, pick, planCopy, readingText, type VideoPlan } from './videoDirection'

/**
 * O criador de vídeo na Iara (2026-11-10; o usuário: "identifique quando seleciono uma referência, deve selecionar a
 * referência no chat para recriar algo por ali e permitir criar um novo vídeo com base nisso"). A Iara vê a
 * referência escolhida e o plano (ficha, estilo, regras, decupagem), muda o plano na tela, escolhe outra referência,
 * preenche com IA e manda gerar: o mesmo botão "Gerar o vídeo", em modo agente.
 */

type Result = { done: IaraDone[]; data?: unknown }
type Full = IaraAction & { exec?: (args: Record<string, unknown>) => Promise<Result> }

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

export function useCreatorIara(
  set: CreativeSet,
  o: {
    reference?: string
    saved: SavedReference[]
    plan: VideoPlan
    busy: boolean
    setPlan: (fn: (p: VideoPlan) => VideoPlan) => void
    pick: (id: string | undefined) => void
    readMotion?: () => Promise<void>
    fill: () => Promise<void>
    run: () => Promise<{ id: string; name: string; report?: string } | undefined>
  },
) {
  const { plan } = o
  // As ações leem a tela mais nova (depois de mudar a referência e o plano, o preencher usa os valores novos)
  const live = useRef(o)
  live.current = o
  const actions: Full[] = [
    {
      name: 'video_plano',
      doc: `{"referencia"?:id de uma referência salva ("" = sem referência),"ler_movimento"?:true,"como"?:"igual"|"novo","assunto"?,"regras"?:string (obrigatórias, uma por linha; substitui),"estilo"?:${STYLE_IDS.map((s) => `"${s}"`).join('|')},"copy"?,"fundo"?:${Object.keys(BG_LABEL).map((b) => `"${b}"`).join('|')},"legenda"?:"nenhuma"|"pop"|"karaoke"|"caixa"|"contorno","cenas"?:[{"fala","tela","texto","transicao"}],"preencher"?:true} — muda o plano no criador de vídeo aberto (aparece na tela). "preencher" roda o "Preencher com IA" (lê a referência, faz ficha e decupagem) depois das outras mudanças; "ler_movimento" lê o vídeo da referência do Instagram pelo link.`,
      label: (a) => (a.preencher ? 'Preencher o plano do vídeo com IA' : 'Mudar o plano do vídeo'),
      long: (a) => !!a.preencher || !!a.ler_movimento,
      run: async () => ({ label: 'Plano mudado.', ok: true }),
      exec: async (a) => {
        if (o.busy) throw new Error('O vídeo já está sendo gerado.')
        const changed: string[] = []
        if (a.referencia === '') { o.pick(undefined); changed.push('sem referência') }
        else if (typeof a.referencia === 'string') {
          const r = o.saved.find((x) => x.id === a.referencia)
          if (!r) throw new Error('Essa referência não está na lista do criador (só as que têm imagem).')
          o.pick(r.id)
          changed.push(`referência "${r.title || r.id}"`)
        }
        o.setPlan((p) => {
          const n: VideoPlan = { ...p }
          if (a.como === 'igual' || a.como === 'novo') { n.how = a.como; changed.push(`como ${a.como}`) }
          const assunto = str(a.assunto, 300); if (assunto !== undefined) { n.topic = assunto; changed.push('assunto') }
          const regras = str(a.regras); if (regras !== undefined) { n.rules = regras; changed.push('regras') }
          if (typeof a.estilo === 'string' && (STYLE_IDS as string[]).includes(a.estilo)) { n.style = a.estilo as VideoPlan['style']; changed.push(`estilo ${a.estilo}`) }
          const copy = str(a.copy, 1500); if (copy !== undefined) { n.copy = copy; n.shots = []; changed.push('copy (a decupagem volta a ser feita)') }
          if (typeof a.fundo === 'string' && a.fundo in BG_LABEL) { n.background = a.fundo as VideoPlan['background']; changed.push(`fundo ${a.fundo}`) }
          if (typeof a.legenda === 'string') { n.captions = { ...n.captions, style: pick(a.legenda, ['nenhuma', 'pop', 'karaoke', 'caixa', 'contorno'] as const, n.captions.style) as CaptionStyle }; changed.push(`legenda ${n.captions.style}`) }
          if (Array.isArray(a.cenas)) { const shots = parseShots(a.cenas); if (shots.length) { n.shots = shots; changed.push(`${shots.length} cenas`) } }
          return n
        })
        if (a.ler_movimento) {
          await new Promise((r) => setTimeout(r, 300))
          if (live.current.readMotion) { await live.current.readMotion(); changed.push('movimento lido') }
        }
        if (a.preencher) {
          // Espera a tela aplicar a referência e o plano novos antes de preencher
          await new Promise((r) => setTimeout(r, 600))
          await live.current.fill()
          changed.push('preenchido com IA')
        }
        return { done: [{ label: changed.length ? `Plano: ${changed.join(', ')}` : 'Nada mudou no plano.', ok: changed.length > 0 }] }
      },
    },
    {
      name: 'video_gerar',
      doc: '{} — gera o vídeo pelo plano do criador aberto (o botão "Gerar o vídeo"): narra e, em modo agente, o Claude Code ou o Codex escreve, renderiza, compara com a referência e corrige. Leva até ~20 min. Confira o plano com a pessoa antes.',
      label: () => 'Gerar o vídeo pelo plano',
      long: true,
      run: async () => ({ label: 'Vídeo gerado.', ok: true }),
      exec: async () => {
        const out = await live.current.run()
        if (!out) throw new Error('O vídeo não foi gerado.')
        return { done: [{ label: `Vídeo criado: "${out.name}". Abri no estúdio.`, ok: true }], data: { video: out.id, relato_do_agente: out.report } }
      },
    },
  ]
  useIaraScreen({
    id: `criador-video:${set.id}`,
    title: 'Novo vídeo',
    describe: () =>
      [
        `Criador de vídeo do conjunto "${set.name}" (${set.id}). Estilo: ${VIDEO_STYLES[plan.style].label}. Como: ${plan.how === 'igual' ? 'recriar como está' : 'conteúdo novo'}${plan.topic ? `; assunto: ${plan.topic}` : ''}.`,
        o.reference ? `Referência ESCOLHIDA ("esta referência"): ${o.reference}.` : 'Sem referência escolhida.',
        plan.reading ? `Ficha da referência: ${readingText(plan.reading)}` : '',
        plan.rules.trim() ? `Regras obrigatórias:\n${plan.rules.trim()}` : 'Sem regras obrigatórias.',
        plan.shots.length ? `Decupagem:\n${plan.shots.map((x, i) => `${i + 1}. tela: ${x.tela || '—'} · texto: ${x.texto || 'nenhum'} · ${SHOT_TRANSITION_LABEL[x.transicao]} · fala: ${x.fala}`).join('\n')}` : planCopy(plan) ? `Copy: ${planCopy(plan)}` : 'Sem decupagem nem copy (a IA escreve ao gerar).',
        o.saved.length ? `Referências salvas (para trocar): ${o.saved.slice(0, 20).map((r) => `${r.id} "${r.title || r.kind}"`).join('; ')}` : '',
        o.busy ? 'O vídeo está sendo gerado agora.' : 'Para mudar o plano use video_plano; para gerar, video_gerar.',
      ].filter(Boolean).join('\n'),
    selection: () => (o.reference ? `Referência: ${o.reference.slice(0, 60)}` : 'Novo vídeo'),
    actions,
  })
}
