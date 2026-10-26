import { createClient } from '@supabase/supabase-js'
import pino from 'pino'
import { dbAuthState } from './auth.ts'
import { openSession, type NumberPatch, type Session } from './session.ts'

/**
 * O serviço do WhatsApp da equipe (CRM › WhatsApp). Conecta o número de cada
 * equipe como aparelho conectado (WhatsApp › Aparelhos conectados), pela
 * biblioteca Baileys, sem intermediário. Fala só com o Supabase: de 2 em 2 s
 * lê a tabela `crm_whatsapp_numbers` e conecta quem o gestor pediu (`wanted`),
 * desconecta quem ele tirou, e escreve ali o QR code e o estado. As chaves da
 * sessão ficam em `crm_whatsapp_auth`, então o serviço não guarda nada no
 * disco.
 *
 * Precisa ficar ligado o tempo todo (o número só fica conectado com ele no
 * ar) e só sai para a internet: não recebe conexões, então roda atrás de
 * qualquer rede. Uma cópia só: duas com o mesmo número se derrubam.
 *
 *   npm run whatsapp            (na raiz; lê SUPABASE_SERVICE_ROLE_KEY do .env.local)
 *   docker build -t whatsapp services/whatsapp && docker run -e SUPABASE_URL=… -e SUPABASE_SERVICE_ROLE_KEY=… whatsapp
 */

// Rodando do repositório: as chaves do .env.local (e o endereço do .env)
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(new URL(`../../../${file}`, import.meta.url))
  } catch {
    // Sem o arquivo: as variáveis vêm do ambiente (Docker, servidor)
  }
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Supabase › Project Settings › API Keys).')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
// Os avisos da biblioteca; LOG_LEVEL=debug mostra tudo
const log = pino({ level: process.env.LOG_LEVEL ?? 'warn' })

const LOOP = 2000
const BEAT = 15_000
const TABLE = 'crm_whatsapp_numbers'

const sessions = new Map<string, Session>()
const starting = new Set<string>()

const reporter = (teamId: string) => async (patch: NumberPatch) => {
  const at = new Date().toISOString()
  const { error } = await db.from(TABLE).update({ ...patch, seen_at: at, updated_at: at }).eq('team_id', teamId)
  if (error) console.error(`[${teamId.slice(0, 8)}] não gravou o estado: ${error.message}`)
}

async function start(teamId: string, logoutOnly: boolean) {
  starting.add(teamId)
  try {
    const auth = await dbAuthState(db, teamId)
    const report = reporter(teamId)
    const session = openSession({
      teamId,
      auth,
      report,
      log: log.child({ team: teamId }),
      logoutOnly,
      onEnd: () => {
        if (sessions.get(teamId) === session) sessions.delete(teamId)
      },
    })
    sessions.set(teamId, session)
    // A tela sabe que o serviço viu o pedido
    await report({})
  } finally {
    starting.delete(teamId)
  }
}

let missingTable = false

async function reconcile() {
  const { data, error } = await db.from(TABLE).select('team_id, wanted, status')
  if (error) {
    if (!missingTable) console.error(error.code === '42P01' || error.code === 'PGRST205' ? 'Falta a migração 20261026150000_crm_whatsapp.sql no Supabase.' : `Não deu para ler os números: ${error.message}`)
    missingTable = true
    return
  }
  missingTable = false
  for (const row of data ?? []) {
    const teamId = row.team_id as string
    const session = sessions.get(teamId)
    if (starting.has(teamId) || session?.leaving) continue
    if (row.wanted && !session) await start(teamId, false)
    else if (!row.wanted && session) await session.logout()
    // Desconectaram com o serviço desligado: falta tirar o aparelho do celular
    else if (!row.wanted && !session && row.status !== 'disconnected') await start(teamId, true)
  }
}

let busy = false
setInterval(() => {
  if (busy) return
  busy = true
  reconcile()
    .catch((error) => console.error('Falha ao ler os pedidos:', error))
    .finally(() => {
      busy = false
    })
}, LOOP)

// Sinal de vida na linha de cada número ligado: a tela avisa quando o serviço some
setInterval(async () => {
  const ids = [...sessions.keys()]
  if (!ids.length) return
  const at = new Date().toISOString()
  const { error } = await db.from(TABLE).update({ seen_at: at }).in('team_id', ids)
  if (error) console.error('Não gravou o sinal de vida:', error.message)
}, BEAT)

const stop = () => {
  for (const session of sessions.values()) session.close()
  setTimeout(() => process.exit(0), 300)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
process.on('unhandledRejection', (error) => console.error('Erro sem tratamento:', error))

console.log(`Serviço do WhatsApp ligado (${new URL(url).host}). Esperando pedidos de conexão em CRM › WhatsApp.`)
