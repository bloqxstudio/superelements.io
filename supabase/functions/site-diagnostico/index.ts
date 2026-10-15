import { createClient } from 'jsr:@supabase/supabase-js@2'
import { diagnoseSite, isPublicHost } from '../_shared/siteScan.ts'

/**
 * Diagnóstico de um site (`/crm/diagnostico` no app publicado): abre a
 * primeira página e a API pública do WordPress e devolve o que achou
 * (`SiteDiagnosis`). Do navegador não dá, porque o site de outra empresa
 * não libera a leitura (CORS); no servidor de dev a tela usa
 * `/__prospeccao/diagnostico`, com o mesmo código (`_shared/siteScan.ts`).
 *
 * Só conta logada. Nunca devolve o HTML do site, só o resumo, e só abre
 * endereços públicos: além da checagem do endereço, confere para onde o DNS
 * aponta antes de cada abertura (inclusive nos redirecionamentos).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** O nome aponta para um endereço público? Sem resposta do DNS, deixa o fetch dizer que o domínio não existe. */
const publicDns = async (host: string) => {
  if (/^[\d.]+$/.test(host) || host.includes(':')) return true
  const answers = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')])
  const ips = answers.flatMap((answer) => (answer.status === 'fulfilled' ? answer.value : []))
  return ips.every((ip) => isPublicHost(ip))
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

    const { url } = (await req.json().catch(() => ({}))) as { url?: unknown }
    if (typeof url !== 'string' || !url.trim() || url.length > 500) return json({ error: 'Diga o endereço do site.' }, 400)

    return json(await diagnoseSite(url.trim(), { signal: req.signal, guard: publicDns }))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
