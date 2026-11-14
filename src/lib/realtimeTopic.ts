import type { RealtimeChannel, RealtimeChannelOptions } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

/**
 * Canal da Realtime com tópico fixo (ex.: `crm-stories-<conta>`), à prova de remontagem rápida.
 *
 * Por quê (revisão de 2026-11-13): a realtime-js devolve o canal que já existe com o mesmo tópico, e
 * `removeChannel` só termina quando o servidor responde. Quando a tela remonta logo em seguida (troca de
 * conta pelo `GuardedOutlet`, StrictMode, voltar à rota), o `.on()/.subscribe()` novo caía no canal antigo
 * ainda saindo e a tela ficava sem tempo real, sem erro nenhum. Aqui a entrada espera o canal antigo com
 * esse tópico sair de vez (o mesmo cuidado de `features/quadros/live.ts`) e só então abre o novo.
 *
 * `build` registra os `.on(...)` no canal e o devolve; o `.subscribe()` fica com o helper. Devolve a
 * função de saída (para o retorno do `useEffect`).
 */
export function subscribeTopic(
  topic: string,
  build: (channel: RealtimeChannel) => RealtimeChannel,
  opts: { config?: RealtimeChannelOptions; onStatus?: (status: string, err?: Error) => void } = {}
): () => void {
  let left = false
  let channel: RealtimeChannel | null = null

  const open = () => {
    if (left) return
    // Ainda há um canal com o tópico (a saída não terminou): não reaproveita um canal fechando
    if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
      console.warn(`[realtime] canal ${topic} ainda saindo; fica sem tempo real desta vez`)
      return
    }
    const current = build(supabase.channel(topic, opts.config))
    channel = current
    current.subscribe((status, err) => {
      if (!left) opts.onStatus?.(status, err)
    })
  }

  const stale = supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`)
  if (stale.length) void Promise.all(stale.map((c) => leaving.get(c) ?? remove(c))).then(open)
  else open()

  return () => {
    left = true
    if (channel) void remove(channel)
    channel = null
  }
}

/** Saídas em andamento: quem entra no mesmo tópico espera esta, em vez de mandar outra saída ao servidor. */
const leaving = new WeakMap<RealtimeChannel, Promise<unknown>>()

function remove(channel: RealtimeChannel) {
  const done = supabase.removeChannel(channel).catch(() => undefined)
  leaving.set(channel, done)
  return done
}
