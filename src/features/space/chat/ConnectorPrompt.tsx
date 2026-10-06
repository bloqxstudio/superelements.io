import React, { useEffect, useState } from 'react'
import { Check, ChevronDown, Copy, Download, Loader2 } from 'lucide-react'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { useConnector } from '@/features/space/connector/connectorStore'
import { detectPlatform, downloadLauncher, LAUNCHER_NAME, unixCommand, type Platform } from '@/features/space/connector/launcher'

/**
 * No app publicado, no lugar da caixa do chat enquanto não há conector. Um
 * botão baixa o arquivo que abre o conector já com o código desta aba (no Mac
 * e no Linux, um comando para colar); a aba fica procurando e liga sozinha
 * quando ele abre. Colar um código do terminal continua valendo.
 */

const POLL_EVERY = 2500
/** Procurando por mais tempo que isso, para e oferece tentar de novo. */
const POLL_FOR = 15 * 60_000

/** Sem `place`, fica dentro da aba Agente (aberto); com ele, flutua no canvas. */
export const ConnectorPrompt: React.FC<{ place?: { left: number; width: number; bottom: number } }> = ({ place }) => {
  const { status, error, pairing, ensureCode, probe, connect, disconnect } = useConnector()
  const [open, setOpen] = useState(!!pairing || !place)
  const [platform, setPlatform] = useState<Platform>(detectPlatform)
  const [copied, setCopied] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [pollUntil, setPollUntil] = useState(() => (pairing ? Date.now() + POLL_FOR : 0))
  const [, tick] = useState(0)
  const waiting = !!pairing && status !== 'connected'
  const polling = waiting && Date.now() < pollUntil

  // Procura o conector enquanto esta tela está aberta: ele liga assim que abrir
  useEffect(() => {
    if (!polling) return
    void probe()
    const timer = setInterval(() => {
      void probe()
      tick((n) => n + 1)
    }, POLL_EVERY)
    return () => clearInterval(timer)
  }, [polling, probe])

  const start = () => {
    const code = ensureCode()
    setPollUntil(Date.now() + POLL_FOR)
    return code
  }

  const download = () => downloadLauncher(start())

  const copy = () => {
    void navigator.clipboard?.writeText(unixCommand(start())).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const stopEvents = (e: React.SyntheticEvent) => e.stopPropagation()

  const getIt =
    platform === 'windows' ? (
      <div className="flex items-center gap-2.5">
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-gray-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-gray-700 active:scale-[0.97]"
          onClick={download}
        >
          <Download className="h-4 w-4" />
          Baixar o conector
        </button>
        <p className="text-[11px] leading-snug text-gray-500">
          Abra o <span className="font-medium text-gray-700">{LAUNCHER_NAME}</span> com dois cliques. Se o Windows avisar, clique em Mais informações › Executar assim mesmo.
        </p>
      </div>
    ) : (
      <div className="space-y-1.5">
        <p className="text-[12px] text-gray-600">Cole no Terminal:</p>
        <button
          className="flex w-full items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-left font-mono text-[11px] leading-snug text-white transition-colors hover:bg-gray-800"
          onClick={copy}
          title="Copiar"
        >
          <span className="min-w-0 flex-1 truncate">{pairing ? unixCommand(pairing.code) : 'curl … conector.mjs && node conector.mjs'}</span>
          {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0 opacity-60" />}
        </button>
      </div>
    )

  return (
    <div className={place ? 'pointer-events-auto absolute z-40' : 'p-3'} style={place ? { left: place.left, width: place.width, bottom: place.bottom } : undefined} onMouseDown={stopEvents} onWheel={stopEvents}>
      <div className={place ? `overflow-hidden rounded-2xl ${ISLAND_SURFACE}` : 'overflow-hidden rounded-xl border border-gray-200'}>
        <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-gray-900">{waiting ? 'Conectando seus agentes' : 'Conectar meus agentes'}</span>
            <span className="block truncate text-[11px] text-gray-500">
              {waiting ? (polling ? 'Esperando o conector abrir neste computador…' : 'O conector não abriu.') : 'Use o Claude Code ou o Codex do seu computador direto no canvas'}
            </span>
          </span>
          {polling && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>

        {open && (
          <div className="space-y-3 border-t border-gray-100 px-3.5 py-3">
            {getIt}

            {waiting && (
              <p className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] text-gray-600">
                {polling ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" /> : null}
                <span className="min-w-0 flex-1">
                  {polling
                    ? 'Assim que o conector abrir, esta aba liga sozinha. Se o navegador perguntar se o site pode acessar apps e serviços neste dispositivo, clique em Permitir.'
                    : 'Parei de procurar.'}
                </span>
                {!polling && (
                  <button className="shrink-0 font-medium text-violet-700 hover:text-violet-900" onClick={() => setPollUntil(Date.now() + POLL_FOR)}>
                    Procurar de novo
                  </button>
                )}
              </p>
            )}

            {error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</p>}

            {typing && (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void connect(typed).then((ok) => ok && setTyping(false))
                }}
              >
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.toUpperCase())}
                  placeholder="ABC-123"
                  aria-label="Código que o conector mostrou"
                  maxLength={12}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-8 w-28 rounded-lg border border-gray-200 px-2 text-center font-mono text-[12px] tracking-widest text-gray-900 placeholder:text-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
                <button
                  type="submit"
                  disabled={status === 'checking' || typed.replace(/[^A-Za-z0-9]/g, '').length < 6}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-[12px] font-medium text-white transition-colors hover:bg-violet-700 active:scale-[0.97] disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
                  Conectar
                </button>
              </form>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
              <span>Precisa do Node.js e do Claude Code ou do Codex instalados.</span>
              <span className="flex-1" />
              <button className="hover:text-gray-700" onClick={() => setPlatform(platform === 'windows' ? 'unix' : 'windows')}>
                {platform === 'windows' ? 'Mac ou Linux?' : 'Windows?'}
              </button>
              {!typing && (
                <button className="hover:text-gray-700" onClick={() => setTyping(true)}>
                  Tenho um código
                </button>
              )}
              {pairing && (
                <button className="hover:text-gray-700" onClick={disconnect}>
                  Esquecer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
