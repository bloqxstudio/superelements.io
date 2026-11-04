import React, { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { FORMS_ENDPOINT, FORMS_SCRIPT_VERSION, configUrl, formBySlug, type FormTheme } from '@/features/crm/forms'

/**
 * Link direto para um formulário (`/f/<id>` ou `/f/<slug>`, o endereço bonito): abre só o formulário, sem WordPress e sem login, para
 * campanhas, WhatsApp e e-mail. Usa o mesmo `forms.js` do site (validação, quiz, envio ao CRM), então
 * a origem da campanha (UTM, gclid, fbclid) chega ao lead como em qualquer outro lugar.
 *
 * Rastreamento opcional, pelo próprio link (a página não tem onde guardar essas configurações):
 *   ?gtm=GTM-XXXXXXX   Tag Manager (recebe form_view, form_submit, lead_qualificado…)
 *   ?px=1234567890     pixel da Meta (legado: o certo é o pixel nas configurações do formulário,
 *                      que o próprio forms.js liga aqui e no site, com todos os eventos)
 */

const GTM = /^GTM-[A-Z0-9]{4,12}$/
const PIXEL = /^\d{8,20}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

declare global {
  interface Window {
    AvenceForms?: { scan: () => void }
    dataLayer?: unknown[]
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown }
    _fbq?: unknown
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) return existing.dataset.loaded ? resolve() : existing.addEventListener('load', () => resolve())
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = '1'
      resolve()
    }
    script.onerror = () => reject(new Error(src))
    document.head.appendChild(script)
  })

function startTagManager(id: string) {
  const w = window
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  void loadScript(`https://www.googletagmanager.com/gtm.js?id=${id}`).catch(() => undefined)
}

/** O fundo da página acompanha o formulário: claro e neutro, ou escuro se o tema do formulário for escuro. */
function pageBackground(theme: FormTheme | undefined) {
  if (!theme) return '#f4f4f5'
  const hex = theme.background.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const dark = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45
  if (theme.frame === 'plain') return theme.background
  return dark ? '#09090b' : '#f4f4f5'
}

const PublicForm: React.FC = () => {
  const { id: param = '' } = useParams()
  const [params] = useSearchParams()
  const host = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<FormTheme>()
  const [unavailable, setUnavailable] = useState(false)
  // `/f/<id>` abre direto; `/f/<slug>` pergunta ao banco qual é o formulário publicado
  const [target, setTarget] = useState<{ id: string; config?: string } | null>(UUID.test(param) ? { id: param } : null)
  const id = target?.id ?? ''

  useEffect(() => {
    if (UUID.test(param)) return setTarget({ id: param })
    setTarget(null)
    let live = true
    void formBySlug(param).then((hit) => {
      if (!live) return
      if (hit) setTarget({ id: hit.id, config: configUrl(hit.teamId, hit.id) })
      else setUnavailable(true)
    })
    return () => {
      live = false
    }
  }, [param])
  const gtm = params.get('gtm')?.toUpperCase()
  const pixel = params.get('px') ?? undefined

  // Página de campanha, não de busca
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  useEffect(() => {
    if (gtm && GTM.test(gtm)) startTagManager(gtm)
  }, [gtm])

  useEffect(() => {
    const node = host.current
    if (!node || !id) return
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail as { event?: string; config?: { name?: string; theme?: FormTheme }; qualified?: boolean | null }
      if (d.event === 'form_config' && d.config) {
        if (d.config.name) document.title = d.config.name
        setTheme(d.config.theme)
        setUnavailable(false)
      } else if (d.event === 'form_unavailable') setUnavailable(true)
    }
    node.addEventListener('avence-form', onEvent)
    let live = true
    loadScript(`/forms.js?v=${FORMS_SCRIPT_VERSION}`).then(() => live && window.AvenceForms?.scan(), () => live && setUnavailable(true))
    return () => {
      live = false
      node.removeEventListener('avence-form', onEvent)
    }
  }, [id])

  const dark = pageBackground(theme) === '#09090b'
  return (
    <main className="flex min-h-[100dvh] items-start justify-center px-4 py-8 sm:items-center sm:py-12" style={{ background: pageBackground(theme) }}>
      <div className="w-full max-w-[560px]">
        {unavailable ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
            <h1 className="text-lg font-semibold text-gray-900">Formulário indisponível</h1>
            <p className="mt-2 text-sm text-gray-600">Este link não está mais ativo. Confira o endereço com quem enviou.</p>
          </div>
        ) : (
          // A capa ocupa a altura da tela (menos o respiro da página), para o alinhamento vertical valer
          <div key={id} ref={host} className="[--avence-form-min-h:calc(100dvh-4rem)] sm:[--avence-form-min-h:min(calc(100dvh-6rem),820px)]" data-avence-form={id || undefined} data-config={target?.config} data-endpoint={FORMS_ENDPOINT} data-pixel={pixel && PIXEL.test(pixel) ? pixel : undefined} style={{ color: dark ? '#fafafa' : undefined }} />
        )}
      </div>
    </main>
  )
}

export default PublicForm
