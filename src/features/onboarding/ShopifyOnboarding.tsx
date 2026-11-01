import React, { useEffect, useState } from 'react'
import { BarChart3, Check, ExternalLink, Loader2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CodeBox } from '@/features/crm/SiteSetup'
import { SHOP_EVENTS, recentHits, shopifyPixelOf, snippetOf, type SiteTracker } from '@/features/crm/site'
import { cn } from '@/lib/utils'
import { shopifyAdmin, type ShopifyStore } from './shopify'

/**
 * Onboarding da loja Shopify (assistente de conta nova, depois de criar a conta e cadastrar a loja
 * no Analytics do site): os dois códigos que vão no admin da loja, com atalhos para onde colar, e a
 * conferência ao vivo do que chega. O código do tema conta quando chega uma página da loja; o pixel,
 * quando chega um evento de loja (produto, carrinho, checkout, compra) ou uma página do checkout.
 * Nada é instalado por nós: a Shopify não deixa colar código sem o login de quem administra a loja.
 */

const CHECKOUT = /^\/(checkouts?|orders)\//
const POLL_MS = 5000

type Check = 'wait' | 'done'

const StepMark: React.FC<{ state: Check | 'fixed'; n: number }> = ({ state, n }) => (
  <span
    className={cn(
      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
      state === 'wait' ? 'bg-zinc-900 text-white' : 'bg-emerald-500 text-white'
    )}
  >
    {state === 'wait' ? n : <Check className="h-3.5 w-3.5" aria-hidden />}
  </span>
)

const Waiting: React.FC<{ done: boolean; waiting: string; ok: string }> = ({ done, waiting, ok }) => (
  <p className={cn('mt-2 flex items-center gap-1.5 text-xs', done ? 'font-medium text-emerald-700' : 'text-gray-500')}>
    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
    {done ? ok : waiting}
  </p>
)

export const ShopifyOnboarding: React.FC<{ store: ShopifyStore; tracker: SiteTracker; accountName: string; onOpenSite: () => void; onLater: () => void }> = ({
  store,
  tracker,
  accountName,
  onOpenSite,
  onLater,
}) => {
  const [theme, setTheme] = useState<Check>('wait')
  const [pixel, setPixel] = useState<Check>('wait')
  const [counts, setCounts] = useState({ pages: 0, shop: 0 })

  // Confere a cada 5 s o que a loja mandou, até os dois códigos responderem
  useEffect(() => {
    if (theme === 'done' && pixel === 'done') return
    let active = true
    const run = async () => {
      const hits = await recentHits(tracker.id).catch(() => null)
      if (!active || !hits) return
      const pages = hits.filter((h) => h.type === 'pageview' && !CHECKOUT.test(h.path ?? '')).length
      const shop = hits.filter((h) => (h.type === 'event' && SHOP_EVENTS.includes(h.name ?? '')) || (h.type === 'pageview' && CHECKOUT.test(h.path ?? ''))).length
      setCounts({ pages, shop })
      if (pages) setTheme('done')
      if (shop) setPixel('done')
    }
    void run()
    const timer = setInterval(() => document.visibilityState === 'visible' && void run(), POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [tracker.id, theme, pixel])

  const storeUrl = `https://${store.domain}`
  const card = 'rounded-2xl border bg-white p-6 shadow-sm'
  const strong = 'font-medium text-gray-800'

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <ShoppingBag className="h-4 w-4" aria-hidden /> Loja Shopify
      </div>
      <h1 className="mt-1 text-xl font-semibold text-gray-900">Conectar {store.name}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Dois códigos no admin da loja, colados uma vez, por quem administra a Shopify (o cliente ou alguém da equipe com acesso de colaborador). Nada de plugin. Esta tela confere sozinha quando cada um
        começar a mandar dados.
      </p>

      <ol className={cn(card, 'mt-6 grid gap-6')}>
        <li className="flex gap-3">
          <StepMark state="fixed" n={1} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Conta {accountName} criada, com a loja no Analytics</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {store.domain}
              {store.myshopify && store.myshopify !== store.domain ? ` · ${store.myshopify}` : ''}
              {store.currency ? ` · ${store.currency}` : ''}
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <StepMark state={theme} n={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Código do tema: visitas, origem e cliques</p>
            <ol className="mt-1.5 grid list-decimal gap-1 pl-5 text-sm text-gray-600 marker:text-gray-400">
              <li>
                Em <strong className={strong}>Loja virtual › Temas</strong>, no tema publicado: <strong className={strong}>… › Editar código</strong>.
              </li>
              <li>
                Abra <strong className={strong}>layout/theme.liquid</strong>, cole antes de <span className="font-mono">&lt;/body&gt;</span> e salve.
              </li>
            </ol>
            {store.headless && <p className="mt-1.5 text-xs text-amber-800">Loja sem tema da Shopify (headless): cole este código no layout do site, antes de &lt;/body&gt;.</p>}
            <CodeBox code={snippetOf(tracker)} what="Código do tema copiado" />
            <Button size="sm" variant="outline" asChild className="mt-2 gap-1.5">
              <a href={shopifyAdmin(store, 'themes')} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir os temas da loja
              </a>
            </Button>
            <Waiting done={theme === 'done'} waiting="Esperando a primeira página da loja…" ok={`Recebendo as páginas da loja (${counts.pages}).`} />
          </div>
        </li>

        <li className="flex gap-3">
          <StepMark state={pixel} n={3} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Pixel do checkout: carrinho, checkout e vendas com valor</p>
            <ol className="mt-1.5 grid list-decimal gap-1 pl-5 text-sm text-gray-600 marker:text-gray-400">
              <li>
                Em <strong className={strong}>Configurações › Eventos do cliente</strong>: <strong className={strong}>Adicionar pixel personalizado</strong>, nome Visitas.
              </li>
              <li>
                Permissão <strong className={strong}>Não é necessária</strong> (se a loja pede consentimento de cookies, use Análise: aí só conta quem aceitar).
              </li>
              <li>
                Apague o exemplo, cole o código, <strong className={strong}>Salvar</strong> e <strong className={strong}>Conectar</strong>.
              </li>
            </ol>
            <CodeBox code={shopifyPixelOf(tracker)} what="Pixel copiado" tall />
            <Button size="sm" variant="outline" asChild className="mt-2 gap-1.5">
              <a href={shopifyAdmin(store, 'settings/customer_events')} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir Eventos do cliente
              </a>
            </Button>
            <Waiting done={pixel === 'done'} waiting="Esperando o primeiro produto visto ou checkout…" ok={`Recebendo os eventos da loja (${counts.shop}).`} />
          </div>
        </li>

        <li className="flex gap-3">
          <StepMark state={theme === 'done' && pixel === 'done' ? 'done' : 'wait'} n={4} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Testar</p>
            <p className="mt-1 text-sm text-gray-600">
              Abra a loja numa janela anônima (o editor de tema não conta) e veja um produto: os passos 2 e 3 ficam verdes. Uma compra de teste (gateway de teste da Shopify) mostra o valor no painel.
            </p>
            <Button size="sm" variant="outline" asChild className="mt-2 gap-1.5">
              <a href={storeUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir {store.domain}
              </a>
            </Button>
          </div>
        </li>
      </ol>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={onLater}>
          Terminar depois
        </Button>
        <Button onClick={onOpenSite} className="gap-2">
          <BarChart3 className="h-4 w-4" aria-hidden /> Abrir o Analytics da loja
        </Button>
      </div>
      <p className="mt-2 text-right text-xs text-gray-500">Os códigos ficam também em CRM › Site › Instalação.</p>
    </div>
  )
}
