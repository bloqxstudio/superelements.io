import React, { useEffect, useState } from 'react'
import { Check, CircleAlert, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FIELD, Surface, whenLabel } from '@/features/crm/ui'
import { VISITAS_ENDPOINT, checkEndpoint, createTracker, normalizeDomain, removeTracker, shopifyPixelOf, snippetOf, visitasScriptUrl, type SiteTracker } from '@/features/crm/site'
import { cn } from '@/lib/utils'

/**
 * Instalação do painel Site: cadastrar o site (gestor), o código que vai uma
 * vez no site (WordPress, Shopify ou qualquer HTML), onde colar, o pixel da
 * Shopify para as compras do checkout, como testar, como a equipe deixa de contar e
 * o que precisa estar no Supabase (migração e função `site-visitas`).
 */

const copy = (text: string, what = 'Copiado') =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(what),
    () => toast.error('Não consegui copiar')
  )

const MIGRATIONS = ['20261025180000_site_visitas.sql', '20261025230000_site_visitas_mapa.sql', '20261101120000_site_visitas_loja.sql']
const DEPLOY = 'supabase functions deploy site-visitas --no-verify-jwt'
const GEO_SECRETS = 'supabase secrets set MAXMIND_ACCOUNT_ID=… MAXMIND_LICENSE_KEY=…'

/** O que só quem cuida do Supabase faz, uma vez. */
export const ServerSteps: React.FC<{ className?: string }> = ({ className }) => (
  <ol className={cn('grid list-decimal gap-2 pl-5 text-sm text-gray-700 marker:text-gray-400', className)}>
    <li>
      Aplicar as migrações{' '}
      {MIGRATIONS.map((m, i) => (
        <span key={m}>
          {i > 0 && ' e '}
          <code className="rounded bg-zinc-100 px-1 text-xs">supabase/migrations/{m}</code>
        </span>
      ))}
      .
    </li>
    <li>
      Para o mapa (cidade e estado de cada visita): uma conta grátis no GeoLite da MaxMind (até 1.000 consultas por dia, uma por visita), uma chave de licença e os segredos{' '}
      <button type="button" onClick={() => void copy(GEO_SECRETS, 'Comando copiado')} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1 font-mono text-xs text-gray-800 hover:bg-zinc-200">
        {GEO_SECRETS} <Copy className="h-3 w-3" aria-hidden />
      </button>
      . O IP de quem visita vai à MaxMind para achar a cidade e não é guardado.
    </li>
    <li>
      Publicar a função sem verificação de login (quem visita o site não tem conta):{' '}
      <button type="button" onClick={() => void copy(DEPLOY, 'Comando copiado')} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1 font-mono text-xs text-gray-800 hover:bg-zinc-200">
        {DEPLOY} <Copy className="h-3 w-3" aria-hidden />
      </button>
    </li>
    <li>
      Publicar o app (o <code className="rounded bg-zinc-100 px-1 text-xs">main</code>): o script <code className="rounded bg-zinc-100 px-1 text-xs">visitas.js</code> sai de{' '}
      <span className="break-all">{visitasScriptUrl()}</span>.
    </li>
  </ol>
)

const NewSite: React.FC<{ teamId: string; onDone: () => void }> = ({ teamId, onDone }) => {
  const [domain, setDomain] = useState('avencestudio.com')
  const [name, setName] = useState('Site da Avence')
  const [saving, setSaving] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createTracker(teamId, domain, name)
      toast.success('Site cadastrado', { description: 'Agora é só colar o código no WordPress.' })
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Domínio</span>
        <input className={cn(FIELD, 'mt-1 h-9')} value={domain} onChange={(e) => setDomain(e.target.value)} onBlur={() => setDomain((d) => normalizeDomain(d))} placeholder="avencestudio.com" required />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-700">Nome no painel</span>
        <input className={cn(FIELD, 'mt-1 h-9')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Site da Avence" />
      </label>
      <Button type="submit" disabled={saving || !domain.trim()} className="gap-1.5">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
      </Button>
    </form>
  )
}

/** Sem site cadastrado: o gestor cadastra; quem vende pede ao gestor. */
export const SiteStart: React.FC<{ teamId: string; manager: boolean; onDone: () => void }> = ({ teamId, manager, onDone }) => (
  <Surface className="mx-auto max-w-2xl">
    <h2 className="text-lg font-semibold text-gray-900">Acompanhar o site</h2>
    <p className="mt-1 text-sm text-gray-600">
      Quem entrou, de onde veio (Google, anúncio, Instagram, outro site), o que viu, quanto tempo ficou e quem chamou no WhatsApp, ligou ou mandou o formulário. Um código colado uma vez no
      WordPress manda tudo para cá.
    </p>
    {manager ? <NewSite teamId={teamId} onDone={onDone} /> : <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-gray-700">Peça a quem gerencia a equipe para cadastrar o site.</p>}
  </Surface>
)

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{n}</span>
    <div className="min-w-0 pt-0.5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-1.5 text-sm text-gray-600">{children}</div>
    </div>
  </li>
)

type Platform = 'wordpress' | 'shopify' | 'outro'
const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'outro', label: 'Outro site' },
]

const CodeBox: React.FC<{ code: string; what: string; tall?: boolean }> = ({ code, what, tall }) => (
  <div className="relative mt-3">
    <pre className={cn('overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-900 p-3 pr-24 font-mono text-[12px] leading-relaxed text-zinc-100', tall && 'max-h-64')}>{code}</pre>
    <Button size="sm" variant="secondary" onClick={() => void copy(code, what)} className="absolute right-2 top-2 h-7 gap-1.5 px-2.5 text-xs">
      <Copy className="h-3.5 w-3.5" /> Copiar
    </Button>
  </div>
)

const ENDPOINT_TEXT: Record<string, { tone: string; text: string }> = {
  ok: { tone: 'text-emerald-700', text: 'Função site-visitas publicada e aberta para o site.' },
  missing: { tone: 'text-amber-800', text: 'A função site-visitas ainda não está publicada no Supabase.' },
  jwt: { tone: 'text-amber-800', text: 'A função está publicada pedindo login: publique de novo com --no-verify-jwt (quem visita não tem conta).' },
  error: { tone: 'text-amber-800', text: 'Não consegui falar com a função site-visitas.' },
}

export const SiteSetup: React.FC<{ tracker: SiteTracker; manager: boolean; onReload: () => Promise<void> }> = ({ tracker, manager, onReload }) => {
  const [endpoint, setEndpoint] = useState<'ok' | 'missing' | 'jwt' | 'error' | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const snippet = snippetOf(tracker)
  const [platform, setPlatform] = useState<Platform>('wordpress')
  const shopify = platform === 'shopify'
  const n = (step: number) => (shopify && step > 2 ? step + 1 : step)
  const site = `https://${tracker.domain}`

  const check = async () => {
    setChecking(true)
    const [state] = await Promise.all([checkEndpoint(), onReload().catch(() => undefined)])
    setEndpoint(state)
    setChecking(false)
  }

  useEffect(() => {
    void checkEndpoint().then(setEndpoint)
  }, [])

  const remove = async () => {
    try {
      await removeTracker(tracker.id)
      toast.success('Site removido do painel')
      await onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const status = endpoint ? ENDPOINT_TEXT[endpoint] : null

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Surface>
        <ol className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">O site é feito em</span>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Plataforma do site">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={platform === p.id}
                  onClick={() => setPlatform(p.id)}
                  className={cn('h-7 rounded-md px-2.5 text-xs font-medium transition-colors', platform === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Step n={1} title="Copie o código do site">
            <p>É o mesmo para todas as páginas. A chave dele é pública (como a de qualquer ferramenta de métricas): só eventos vindos de {tracker.domain} são aceitos.</p>
            <CodeBox code={snippet} what="Código copiado" />
          </Step>
          {platform === 'shopify' ? (
            <>
              <Step n={2} title="Cole no tema da Shopify, uma vez">
                <ol className="grid list-decimal gap-1 pl-5 marker:text-gray-400">
                  <li>
                    No admin da Shopify: <strong className="font-medium text-gray-800">Loja virtual › Temas › … › Editar código</strong>.
                  </li>
                  <li>
                    Abra <strong className="font-medium text-gray-800">layout/theme.liquid</strong> e cole o código logo antes de <span className="font-mono">&lt;/body&gt;</span>. Salve.
                  </li>
                </ol>
                <p className="mt-2 text-xs text-gray-500">
                  Ele conta as páginas da loja, o tempo, a rolagem e os cliques (WhatsApp, telefone…). O domínio cadastrado aqui deve ser o da loja ({tracker.domain}); uma loja sem domínio próprio
                  usa o <span className="font-mono">loja.myshopify.com</span>.
                </p>
              </Step>
              <Step n={3} title="Adicione o pixel (compras e checkout)">
                <p>
                  O checkout da Shopify não roda o código do tema. Este pixel manda produto visto, carrinho, checkout, pagamento e a compra (valor, moeda, itens e o pedido) na mesma visita, com a
                  origem de onde a pessoa veio.
                </p>
                <ol className="mt-2 grid list-decimal gap-1 pl-5 marker:text-gray-400">
                  <li>
                    <strong className="font-medium text-gray-800">Configurações › Eventos do cliente › Adicionar pixel personalizado</strong>. Nome: Visitas.
                  </li>
                  <li>
                    Em Permissão, <strong className="font-medium text-gray-800">Não é necessária</strong> (ou Marketing/Análise, se a loja pede consentimento de cookies: aí só conta quem aceitar).
                  </li>
                  <li>
                    Apague o exemplo, cole o código, <strong className="font-medium text-gray-800">Salvar</strong> e <strong className="font-medium text-gray-800">Conectar</strong>.
                  </li>
                </ol>
                <CodeBox code={shopifyPixelOf(tracker)} what="Pixel copiado" tall />
                <p className="mt-2 text-xs text-gray-500">Cada pedido conta uma vez, mesmo que a página de obrigado seja recarregada. Para testar, faça um pedido de teste (gateway de teste da Shopify).</p>
              </Step>
            </>
          ) : platform === 'outro' ? (
            <Step n={2} title="Cole no site, uma vez">
              <p>
                No HTML de todas as páginas, antes de <span className="font-mono">&lt;/body&gt;</span> (no layout comum do site: Astro, Next, GitHub Pages, Webflow em Código personalizado, Wix em
                Configurações › Código personalizado).
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Loja com outro checkout (WooCommerce, Nuvemshop…): os eventos de comércio do GA4 no dataLayer (<span className="font-mono">purchase</span>,{' '}
                <span className="font-mono">add_to_cart</span>, <span className="font-mono">begin_checkout</span>) chegam como compra, carrinho e checkout, com valor. Ou chame{' '}
                <span className="font-mono">visitas('compra', {'{'} valor: 199.9, moeda: 'BRL', pedido: '1234' {'}'})</span> na página de obrigado.
              </p>
            </Step>
          ) : (
          <Step n={2} title="Cole no WordPress, uma vez">
            <ol className="grid list-decimal gap-1 pl-5 marker:text-gray-400">
              <li>
                No painel do WordPress: <strong className="font-medium text-gray-800">Elementor › Código personalizado › Adicionar novo</strong>.
              </li>
              <li>Nome: Visitas. Cole o código. Local: <strong className="font-medium text-gray-800">&lt;/body&gt; – Fim</strong>.</li>
              <li>
                Publicar com a condição <strong className="font-medium text-gray-800">Todo o site</strong>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-gray-500">Sem o Elementor Pro, o plugin WPCode (Header &amp; Footer) faz o mesmo: cole no rodapé (Footer). Se houver plugin de cache, limpe o cache depois.</p>
            <p className="mt-1 text-xs text-gray-500">Vale para qualquer tema (Astra, Hello, Kadence…). WooCommerce: as compras chegam pelos eventos do GA4 no dataLayer (plugins como o GTM4WP os mandam).</p>
          </Step>
          )}
          <Step n={n(3)} title="Teste numa janela anônima">
            <p>{shopify ? 'O editor de tema não conta.' : platform === 'wordpress' ? 'Logado no WordPress não conta (nem no editor do Elementor).' : ''} Abra o site numa janela anônima ou no celular, navegue um pouco e clique em algo: a visita aparece em Visitas › No site agora.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`${site}/?visitas=debug`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir {tracker.domain}
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void check()} disabled={checking} className="gap-1.5">
                <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} /> Verificar
              </Button>
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm">
              <li className={cn('flex items-start gap-2', tracker.lastSeenAt ? 'text-emerald-700' : 'text-gray-600')}>
                {tracker.lastSeenAt ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
                {tracker.lastSeenAt ? `Último sinal do site: ${whenLabel(tracker.lastSeenAt)}.` : 'Nenhum sinal do site ainda.'}
              </li>
              {status && (
                <li className={cn('flex items-start gap-2', status.tone)}>
                  {endpoint === 'ok' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                  {status.text}
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-gray-500">Com ?visitas=debug no endereço, o console do navegador mostra cada coisa que é mandada.</p>
          </Step>
          <Step n={n(4)} title="Tire a equipe da contagem">
            <p>Abra este endereço uma vez em cada navegador e celular da equipe: daí em diante ele não conta mais.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <a href={`${site}/?visitas=off`} target="_blank" rel="noreferrer" className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-gray-800 hover:bg-zinc-200">
                {tracker.domain}/?visitas=off
              </a>
              <button type="button" onClick={() => void copy(`${site}/?visitas=off`, 'Endereço copiado')} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                <Copy className="h-3 w-3" /> copiar
              </button>
              <span className="text-xs text-gray-500">
                Para voltar a contar: <span className="font-mono">?visitas=on</span>
              </span>
            </div>
          </Step>
        </ol>
      </Surface>

      <div className="grid content-start gap-4">
        <Surface title="O que é contado">
          <ul className="grid gap-1.5 text-sm text-gray-700">
            <li>Cada página vista, com o tempo em uso (aba esquecida não conta) e até onde a pessoa rolou.</li>
            <li>De onde veio: Google (busca ou anúncio), Instagram, Facebook, campanhas com UTM, outros sites, IAs como o ChatGPT, direto.</li>
            <li>Cliques no WhatsApp, no telefone, no e-mail, em botões e links, e dúvidas abertas.</li>
            <li>Formulário: quem começou a preencher e quem enviou.</li>
            <li>Eventos do dataLayer (como lead_qualificado da página de proposta).</li>
            <li>Loja: produto visto, carrinho, checkout e compras com valor (pixel da Shopify ou eventos do GA4), por origem e campanha.</li>
            <li>Aparelho, navegador (inclusive o do Instagram), sistema, país e idioma.</li>
          </ul>
          <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs text-gray-600">
            Cada pessoa é um número aleatório guardado no navegador dela. Não guarda IP, nome, e-mail nem o que se digita nos formulários. Vale citar a medição na política de privacidade do site.
          </p>
        </Surface>
        <Surface title="No Supabase (uma vez)">
          <ServerSteps />
          <p className="mt-3 break-all text-[11px] text-gray-400">Função: {VISITAS_ENDPOINT}</p>
        </Surface>
        {manager && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-gray-500">
            {confirmRemove ? (
              <>
                <span>Tirar {tracker.domain} do painel? As visitas guardadas saem junto e o código no site para de contar.</span>
                <button type="button" onClick={() => void remove()} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700">
                  Remover
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">
                  Não
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-rose-50 hover:text-rose-700">
                Remover o site do painel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
