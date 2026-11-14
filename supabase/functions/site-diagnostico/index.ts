import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { diagnoseSite, dnsGuard } from '../_shared/siteScan.ts'

/**
 * Diagnóstico de um site (`/crm/diagnostico` no app publicado): abre a
 * primeira página e a API pública do WordPress e devolve o que achou
 * (`SiteDiagnosis`). Do navegador não dá, porque o site de outra empresa
 * não libera a leitura (CORS); no servidor de dev a tela usa
 * `/__prospeccao/diagnostico`, com o mesmo código (`_shared/siteScan.ts`).
 *
 * Só quem é de uma equipe com o módulo Diagnóstico (ou Prospecção) ligado. Revisão de 2026-11-13: antes
 * bastava estar logado em qualquer conta, e a função servia de leitor de URLs para qualquer um. Nunca
 * devolve o HTML do site, só o resumo, e só abre endereços públicos: além da checagem do endereço, confere
 * para onde o DNS aponta antes de cada abertura (inclusive nos redirecionamentos e nos IPs escritos direto).
 */

const MODULES = ['diagnostico', 'prospeccao']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** O nome aponta só para endereços públicos? Sem resposta do DNS, não abre (falha fechada). */
const publicDns = dnsGuard((host, type) => Deno.resolveDns(host, type))

type Db = SupabaseClient

/**
 * Quem chama é de uma equipe com o módulo ligado? Com `teamId` no corpo, vale aquela equipe; sem ele (a tela
 * de hoje não manda), qualquer equipe da pessoa. A leitura das equipes passa pelas regras do banco.
 */
async function allowed(db: Db, userId: string, teamId: unknown): Promise<boolean> {
  let teams: string[]
  if (typeof teamId === 'string' && /^[0-9a-f-]{36}$/i.test(teamId)) teams = [teamId]
  else {
    const { data, error } = await db.from('crm_team_members').select('team_id').eq('user_id', userId)
    if (error) throw error
    teams = (data ?? []).map((row) => String((row as { team_id: string }).team_id))
  }
  for (const team of teams) {
    const { data: member } = await db.rpc('is_crm_member', { p_team: team })
    if (member !== true) continue
    for (const module of MODULES) {
      const { data: on } = await db.rpc('crm_module_on', { p_team: team, p_module: module })
      if (on === true) return true
    }
  }
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return json({ error: 'Entre na conta para diagnosticar um site.' }, 401)

    const { url, teamId } = (await req.json().catch(() => ({}))) as { url?: unknown; teamId?: unknown }
    if (!(await allowed(supabase, auth.user.id, teamId))) return json({ error: 'O Diagnóstico de site não está ligado para a sua equipe.', code: 'module_off' }, 403)
    if (typeof url !== 'string' || !url.trim() || url.length > 500) return json({ error: 'Diga o endereço do site.' }, 400)

    return json(await diagnoseSite(url.trim(), { signal: req.signal, guard: publicDns }))
  } catch (error) {
    // Revisão de 2026-11-13: o detalhe vai para o log, não para a resposta
    console.error('[site-diagnostico]', error)
    return json({ error: 'Não consegui diagnosticar agora. Tente de novo em instantes.' }, 500)
  }
})
