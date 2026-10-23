import type { Plugin } from 'vite'
import type { EditRequest } from '../../src/features/criativos/edit.ts'
import type { PlanRequest } from '../../src/features/criativos/plan.ts'
import { CREATIVE_EVENTS, type CreativeAgentInfo, type CreativeImageRequest, type CreativeCall, type CreativeProgress, type CreativeResult } from '../../src/features/criativos/protocol.ts'
import { CHAT_AGENTS } from '../../src/features/space/chat/protocol.ts'
import { checkAgents } from '../space/chatPlugin.ts'
import { generateImage, hasKey, imageProvider, imageProviders, saveImageKey } from './imagem.ts'
import { editCreatives } from './edit.ts'
import { planPosts } from './plan.ts'

/**
 * A IA dos criativos, no mesmo canal do chat do Space: o websocket do Vite no
 * `npm run dev` e o conector (`scripts/connector/conector.ts`) no app publicado.
 * A aba manda `criativos:chamar` com um id e recebe `criativos:resposta` com o
 * mesmo id; `criativos:parar` cancela. O Claude Code roda nesta máquina, sem
 * ferramentas, e só devolve texto e operações (`edit.ts`, `plan.ts`).
 */

const FORMATS = ['4x5', '1x1', '9x16']

const planInput = (body: Partial<PlanRequest>): PlanRequest => ({
  brief: String(body.brief ?? '').slice(0, 3000),
  format: FORMATS.includes(String(body.format)) ? (body.format as PlanRequest['format']) : '4x5',
  slides: Math.min(10, Math.max(1, Number(body.slides) || 5)),
  posts: Math.min(4, Math.max(1, Number(body.posts) || 1)),
  cases: Array.isArray(body.cases) ? body.cases.slice(0, 12) : [],
})

const editInput = (body: Partial<EditRequest>): EditRequest => ({
  agent: body.agent === 'codex' ? 'codex' : 'claude',
  canGenerateImages: !!body.canGenerateImages && !!imageProvider(),
  message: String(body.message ?? '').slice(0, 4000),
  scope: ['layer', 'slide', 'post', 'set'].includes(String(body.scope)) ? (body.scope as EditRequest['scope']) : 'set',
  postId: body.postId ? String(body.postId) : undefined,
  slideId: body.slideId ? String(body.slideId) : undefined,
  layerId: body.layerId ? String(body.layerId) : undefined,
  brand: body.brand as EditRequest['brand'],
  posts: body.posts ?? [],
  fonts: Array.isArray(body.fonts) ? body.fonts.slice(0, 60).map(String) : [],
  images: Array.isArray(body.images) ? body.images.slice(0, 80) : [],
  cases: Array.isArray(body.cases) ? body.cases.slice(0, 12) : [],
  image: typeof body.image === 'string' && body.image.length < 2_000_000 ? body.image : undefined,
  previews: Array.isArray(body.previews) ? body.previews.slice(0, 10).filter((x) => typeof x === 'string' && x.length < 1_000_000) : [],
  references: Array.isArray(body.references)
    ? body.references.slice(0, 8).map((r) => ({ kind: String(r?.kind ?? ''), label: String(r?.label ?? '').slice(0, 120), text: String(r?.text ?? '').slice(0, 12_000), images: Array.isArray(r?.images) ? r.images.slice(0, 8).filter((x) => typeof x === 'string' && x.length < 700_000) : [] }))
    : [],
  projects: Array.isArray(body.projects) ? body.projects.slice(0, 60).map((p) => String(p).slice(0, 80)) : [],
  history: Array.isArray(body.history) ? body.history.slice(-6) : [],
  attachments: Array.isArray(body.attachments)
    ? body.attachments.slice(0, 4).filter((a) => typeof a?.data === 'string' && a.data.length < 3_000_000).map((a) => ({ name: String(a.name ?? 'imagem').slice(0, 80), src: String(a.src ?? ''), data: a.data }))
    : [],
  skill: body.skill && typeof body.skill.instructions === 'string' ? { name: String(body.skill.name ?? 'Skill').slice(0, 80), instructions: body.skill.instructions.slice(0, 30000) } : undefined,
})

export const criativos = (): Plugin => ({
  name: 'superelements-criativos',
  apply: 'serve',
  configureServer(server) {
    const runs = new Map<string, AbortController>()
    const send = (result: CreativeResult) => server.ws.send(CREATIVE_EVENTS.result, result)

    server.ws.on(CREATIVE_EVENTS.hello, () => {
      void checkAgents().then((found) => {
        const agents: CreativeAgentInfo[] = found.map((a) => ({ id: a.id, name: CHAT_AGENTS[a.id].name, available: a.available, version: a.version }))
        server.ws.send(CREATIVE_EVENTS.status, { ia: agents.some((a) => a.available), agents, images: imageProvider(), providers: imageProviders(), keys: { openai: hasKey('openai'), gemini: hasKey('gemini') } })
      })
    })

    server.ws.on(CREATIVE_EVENTS.call, (call: CreativeCall) => {
      void (async () => {
        const id = String(call?.id ?? '')
        if (!id) return
        const controller = new AbortController()
        runs.set(id, controller)
        try {
          if (call.kind === 'edit') {
            const input = editInput(call.request as Partial<EditRequest>)
            if (!input.message.trim()) throw new Error('Escreva o que quer mudar.')
            send({ id, ok: true, data: await editCreatives(input, controller.signal, (step) => server.ws.send(CREATIVE_EVENTS.progress, { id, step } satisfies CreativeProgress)) })
          } else if (call.kind === 'plan') {
            send({ id, ok: true, data: await planPosts(planInput(call.request as Partial<PlanRequest>), controller.signal) })
          } else if (call.kind === 'image') {
            const req = call.request as Partial<CreativeImageRequest>
            const ratio = req.ratio === 'portrait' || req.ratio === 'landscape' ? req.ratio : 'square'
            const prefer = req.provider === 'codex' || req.provider === 'openai' || req.provider === 'gemini' ? req.provider : undefined
            send({ id, ok: true, data: await generateImage(String(req.prompt ?? ''), ratio, controller.signal, prefer) })
          } else throw new Error('Pedido desconhecido.')
        } catch (error) {
          if (controller.signal.aborted) return
          send({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
        } finally {
          runs.delete(id)
        }
      })()
    })

    // A chave vai do navegador só até este computador; fica no arquivo da pessoa e nunca volta para a tela
    server.ws.on(CREATIVE_EVENTS.key, (data: { provider?: string; key?: string }) => {
      if (data?.provider === 'openai' || data?.provider === 'gemini') {
        saveImageKey(data.provider, String(data.key ?? '').slice(0, 300))
        server.ws.send(CREATIVE_EVENTS.status, { images: imageProvider(), providers: imageProviders(), keys: { openai: hasKey('openai'), gemini: hasKey('gemini') } })
      }
    })

    server.ws.on(CREATIVE_EVENTS.stop, (data: { id?: string }) => {
      runs.get(String(data?.id ?? ''))?.abort()
    })
  },
})
