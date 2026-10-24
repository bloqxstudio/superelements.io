import React, { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCreativeLink } from '@/features/criativos/link'
import { ConnectorPrompt } from '@/features/space/chat/ConnectorPrompt'
import { CONNECTOR_FILE, useConnector } from '@/features/space/connector/connectorStore'
import { cn } from '@/lib/utils'

/** "202610241500" → "24/10/2026 15:00". */
const when = (v?: string) => (v && /^\d{12}$/.test(v) ? `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)} ${v.slice(8, 10)}:${v.slice(10, 12)}` : v ?? '–')

/**
 * O conector: se está ligado, qual versão roda neste computador e qual o app
 * serve hoje, as IAs que ele achou (Claude Code, Codex), e o caminho para
 * baixar e ligar. Sem ele, os agentes não rodam.
 */
export const ConnectorPanel: React.FC = () => {
  const { status, version, latest, recheck, error } = useConnector()
  const link = useCreativeLink()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => void recheck(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const viaConnector = status === 'connected'
  const viaDev = !viaConnector && link.connected
  const on = viaConnector || viaDev
  const outdated = viaConnector && !!version && !!latest && version < latest
  const label = viaConnector ? 'Conectado' : viaDev ? 'Conectado (servidor de desenvolvimento)' : status === 'checking' ? 'Procurando o conector…' : 'Desconectado'

  const check = async () => {
    setBusy(true)
    try {
      await recheck()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Conector" className="mt-6 rounded-xl bg-white p-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {on && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', on ? 'bg-emerald-500' : status === 'checking' ? 'bg-amber-400' : 'bg-gray-300')} />
          </span>
          <p className="text-sm font-semibold text-gray-900">Conector · {label}</p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
          <div className="flex gap-1.5"><dt className="text-gray-500">No seu computador</dt><dd className="font-medium tabular-nums text-gray-900">{viaConnector ? when(version) : viaDev ? 'servidor local' : '–'}</dd></div>
          <div className="flex gap-1.5"><dt className="text-gray-500">Mais novo</dt><dd className="font-medium tabular-nums text-gray-900">{when(latest)}</dd></div>
          {outdated && <div className="font-semibold text-amber-700">Desatualizado: baixe de novo</div>}
          {viaConnector && !!version && !!latest && !outdated && <div className="font-medium text-emerald-700">Atualizado</div>}
        </dl>
        <div className="ml-auto flex gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-white" onClick={() => void check()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Verificar conexão
          </Button>
          <Button asChild size="sm" variant={outdated || !on ? 'default' : 'outline'} className={cn('h-8 gap-1.5', !(outdated || !on) && 'bg-white')}>
            <a href={CONNECTOR_FILE} download="conector.mjs"><Download className="h-3.5 w-3.5" /> Baixar conector</a>
          </Button>
          {!viaConnector && !viaDev && <Button type="button" size="sm" variant="outline" className="h-8 bg-white" onClick={() => setOpen((o) => !o)}>{open ? 'Fechar' : 'Como ligar'}</Button>}
        </div>
      </div>

      {on && (
        <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="IAs encontradas neste computador">
          {link.agents.length === 0 && <li className="text-xs text-gray-500">{link.ia === null ? 'Procurando as IAs…' : 'Nenhuma IA encontrada: instale o Claude Code ou o Codex.'}</li>}
          {link.agents.map((a) => (
            <li key={a.id} className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1', a.available ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-gray-50 text-gray-500 ring-gray-200')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', a.available ? 'bg-emerald-500' : 'bg-gray-300')} />
              {a.name}{a.available ? (a.version ? ` ${a.version}` : '') : ' · não encontrado'}
            </li>
          ))}
          {link.legacy && <li className="text-xs text-amber-700">Conector antigo: baixe de novo para escolher a IA.</li>}
          {link.stale && <li className="text-xs text-amber-700">O conector não respondeu à IA: baixe de novo e abra.</li>}
        </ul>
      )}
      {!on && error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {open && !on && <div className="mt-2"><ConnectorPrompt /></div>}
    </section>
  )
}
