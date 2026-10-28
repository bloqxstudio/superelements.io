/** Recebe apenas mensagens assinadas pela Meta; nunca registra tokens ou conteúdo em logs. */
export interface IncomingDm {
  account: string
  participant: string
  mid: string
  fromMe: boolean
  body: string
  attachment: string | null
  at: string
}

export async function validSignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, (hex) => parseInt(hex, 16))
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw))
}

const id = (value: unknown): value is string => typeof value === 'string' && /^\d{1,40}$/.test(value)

export function messagesOf(payload: unknown): IncomingDm[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  if (root.object !== 'instagram' || !Array.isArray(root.entry)) return []
  const rows: IncomingDm[] = []
  for (const entry of root.entry) {
    if (!id(entry?.id) || !Array.isArray(entry.messaging)) continue
    for (const event of entry.messaging) {
      const message = event?.message
      if (!message || typeof message.mid !== 'string' || message.mid.length > 1024 || !message.mid) continue
      if (!id(event.sender?.id) || !id(event.recipient?.id)) continue
      const fromMe = event.sender.id === entry.id
      if (!fromMe && event.recipient.id !== entry.id) continue
      const participant = fromMe ? event.recipient.id : event.sender.id
      if (participant === entry.id || message.is_deleted || message.is_unsupported) continue
      if (typeof event.timestamp !== 'number' || !Number.isFinite(event.timestamp) || event.timestamp <= 0 || event.timestamp > Date.now() + 300_000) continue
      const attachment = Array.isArray(message.attachments) && typeof message.attachments[0]?.type === 'string' ? message.attachments[0].type.slice(0, 100) : null
      if (typeof message.text !== 'string' && !attachment) continue
      rows.push({ account: entry.id, participant, mid: message.mid, fromMe, body: typeof message.text === 'string' ? message.text : '', attachment, at: new Date(event.timestamp).toISOString() })
    }
  }
  return rows
}

interface Options {
  verifyToken: string
  secrets: string[]
  store: (message: IncomingDm) => Promise<void>
}

export function webhookHandler(options: Options) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams
      if (options.verifyToken && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === options.verifyToken && params.has('hub.challenge'))
        return new Response(params.get('hub.challenge'), { headers: { 'Content-Type': 'text/plain' } })
      return new Response('Forbidden', { status: 403 })
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    // A Meta não envia JWT do Supabase. A autenticação deste endpoint é a assinatura do corpo.
    if (Number(request.headers.get('content-length')) > 1_048_576) return new Response('Payload too large', { status: 413 })
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > 1_048_576) return new Response('Payload too large', { status: 413 })
    const checks = await Promise.all(options.secrets.filter(Boolean).map((secret) => validSignature(raw, request.headers.get('x-hub-signature-256'), secret)))
    if (!checks.some(Boolean)) return new Response('Invalid signature', { status: 401 })
    let payload: unknown
    try { payload = JSON.parse(raw) } catch { return new Response('Invalid JSON', { status: 400 }) }
    try {
      const messages = messagesOf(payload)
      for (const message of messages) await options.store(message)
      console.info('[instagram-webhook] Eventos de mensagens processados:', messages.length)
      return new Response('EVENT_RECEIVED')
    } catch {
      // Não confirmar o evento se o banco falhar: a Meta poderá tentar entregá-lo novamente.
      console.error('[instagram-webhook] Falha ao guardar evento; aguardando reentrega.')
      return new Response('Retry later', { status: 503 })
    }
  }
}
