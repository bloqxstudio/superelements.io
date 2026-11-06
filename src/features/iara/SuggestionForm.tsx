import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrm } from '@/features/crm/crmStore'
import { createSuggestion, KIND_LABEL, type SuggestionKind } from '@/features/sugestoes/api'
import { patchMessage, useIara, type IaraMessage } from './store'

/**
 * Sugestão ao time de produto sem IA (2026-11-05, o usuário: "alguns fluxos não precisam de IA…
 * como sugestão, não precisa pensar, precisa seguir um fluxo"): a Iara reconhece o pedido pelas
 * palavras e abre este formulário na hora, já com a tela aberta e o que a pessoa escreveu. Enviar
 * grava direto em `product_suggestions`. "Era outra coisa" manda o texto para a Iara pensar.
 */

/** Pedidos claros ao time de produto. */
const STRONG = /(\bsugerir (uma )?melhoria|\bmelhoria (no|do|na|da|para o|pro) (produto|app|aplicativo|sistema|plataforma|tela)|\bfeedback\b|\breportar\b|\bbug\b|n[ãa]o (est[áa] )?funciona|deu erro|\btravou\b|\btime de produto\b|\bsugest(ão|ao) (para|pro|ao) (o )?(time|produto|app|sistema))/i
/** "Sugestão" sozinha: só quando o texto não fala de conteúdo (post, legenda, ideia de post…). */
const WEAK = /\bsugest(ão|ao|ões|oes)\b/i
const CONTENT = /\b(post|posts|conteúdo|conteudo|conteúdos|legenda|legendas|carrossel|story|stories|reels|criativo|criativos|cta|roteiro|pauta de posts|ideias? de)\b/i

export const wantsSuggestion = (text: string) => STRONG.test(text) || (WEAK.test(text) && !CONTENT.test(text))

/** O texto vira título: a primeira frase, curta. */
const titleOf = (text: string) => {
  const first = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? ''
  return first.length > 110 ? `${first.slice(0, 107).trimEnd()}…` : first
}

/** Tira o pedido em si ("quero sugerir uma melhoria:") e deixa só o que melhorar. */
const cleanIntro = (text: string) =>
  text
    .replace(/^\s*(oi|ol[áa])[,!.\s]*/i, '')
    .replace(/^\s*(eu )?(quero|queria|gostaria de|vou)?\s*(fazer |mandar |enviar |dar )?(uma )?(sugest(ão|ao)|sugerir( uma)?( melhoria)?|feedback)( de melhoria)?( (no|do|para o|pro) (produto|app|sistema|plataforma))?\s*[:\-,.]?\s*/i, '')
    .trim()

export const SuggestionForm: React.FC<{ m: IaraMessage; onAskAi: (text: string) => void }> = ({ m, onAskAi }) => {
  const screen = useIara((s) => s.screen)
  const original = m.form?.text ?? ''
  const [kind, setKind] = useState<SuggestionKind>(/(n[ãa]o funciona|erro|bug|travou)/i.test(original) ? 'problema' : 'melhoria')
  const [area, setArea] = useState(screen?.title ?? '')
  const [what, setWhat] = useState(cleanIntro(original))
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (m.form?.state === 'enviado') {
    return (
      <p className="flex items-start gap-1.5 text-sm">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <span>
          Enviado ao time de produto. Acompanhe o status em{' '}
          <Link to="/sugestoes" className="font-medium underline underline-offset-2">
            Sugestões
          </Link>
          .
        </span>
      </p>
    )
  }
  if (m.form?.state === 'cancelado') return <p className="text-sm text-gray-500">Sugestão cancelada.</p>

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!what.trim()) return setError('Conte o que você quer melhorar.')
    setBusy(true)
    setError(undefined)
    try {
      await createSuggestion({
        title: titleOf(what),
        description: what.trim(),
        area: area.trim(),
        kind,
        impact: why.trim(),
        original,
        teamId: useCrm.getState().team?.id,
        screenPath: `${window.location.pathname}${window.location.search}`.slice(0, 300),
        screenTitle: screen?.title ?? document.title,
        via: 'iara',
      })
      patchMessage(m.id, (x) => ({ ...x, text: '', form: { ...x.form!, state: 'enviado' } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui enviar.')
      setBusy(false)
    }
  }

  const field = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none'

  return (
    <form onSubmit={send} className="grid gap-2.5">
      <p>Vamos mandar ao time de produto. Leva 10 segundos.</p>
      <div role="radiogroup" aria-label="Tipo" className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABEL) as SuggestionKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn('h-7 rounded-full border px-2.5 text-xs font-medium', kind === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700')}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="text-xs text-gray-600">
        Onde (tela ou parte do produto)
        <input value={area} maxLength={120} onChange={(e) => setArea(e.target.value)} className={cn(field, 'mt-1 h-8')} />
      </label>
      <label className="text-xs text-gray-600">
        {kind === 'problema' ? 'O que acontece' : 'O que você quer melhorar'}
        <textarea autoFocus rows={3} value={what} maxLength={4000} onChange={(e) => setWhat(e.target.value)} className={cn(field, 'mt-1 py-1.5')} />
      </label>
      <label className="text-xs text-gray-600">
        Por que importa <span className="text-gray-400">(opcional)</span>
        <input value={why} maxLength={1000} onChange={(e) => setWhy(e.target.value)} placeholder="Ex.: perco tempo toda semana com isso" className={cn(field, 'mt-1 h-8')} />
      </label>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} Enviar ao time
        </button>
        <button type="button" disabled={busy} onClick={() => patchMessage(m.id, (x) => ({ ...x, form: { ...x.form!, state: 'cancelado' } }))} className="h-8 rounded-lg px-2.5 text-xs font-medium text-gray-600 hover:bg-white">
          Cancelar
        </button>
        {original && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              patchMessage(m.id, (x) => ({ ...x, form: { ...x.form!, state: 'cancelado' } }))
              onAskAi(original)
            }}
            className="ml-auto h-8 rounded-lg px-1 text-xs text-gray-500 underline-offset-2 hover:underline"
          >
            Era outra coisa
          </button>
        )}
      </div>
    </form>
  )
}
