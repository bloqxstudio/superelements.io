import React, { useState } from 'react'
import { Check, ChevronDown, Copy, Download, Loader2, RotateCw } from 'lucide-react'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { CONNECTOR_FILE, useConnector } from '@/features/space/connector/connectorStore'
import { AgentMark } from './AgentMark'
import { CHAT_AGENTS } from './protocol'

/**
 * No app publicado, no lugar da caixa do chat enquanto não há conector: três
 * passos para usar o Claude Code ou o Codex do próprio computador (baixar,
 * rodar, colar o código). Com um código já guardado e o conector fechado,
 * só lembra de abrir de novo.
 */

const COMMAND = 'node conector.mjs'

export const ConnectorPrompt: React.FC<{ place: { left: number; width: number; bottom: number } }> = ({ place }) => {
  const { status, error, pairing, connect, disconnect } = useConnector()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const busy = status === 'checking'
  const known = !!pairing

  const copy = () => {
    void navigator.clipboard?.writeText(COMMAND).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const stopEvents = (e: React.SyntheticEvent) => e.stopPropagation()
  const marks = (
    <span className="flex shrink-0 gap-1">
      {(['claude', 'codex'] as const).map((id) => (
        <span key={id} className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ background: CHAT_AGENTS[id].color }}>
          <AgentMark agent={id} size={15} />
        </span>
      ))}
    </span>
  )

  // Já pareado: o conector só está fechado (ou reconectando)
  if (known && !open) {
    return (
      <div className="pointer-events-auto absolute z-40" style={{ left: place.left, width: place.width, bottom: place.bottom }} onMouseDown={stopEvents} onWheel={stopEvents}>
        <div className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${ISLAND_SURFACE}`}>
          {marks}
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-gray-600">
            {error ? (
              <span className="text-red-700">{error}</span>
            ) : status === 'checking' || status === 'reconnecting' ? (
              <>Procurando o conector neste computador…</>
            ) : (
              <>
                <span className="font-medium text-gray-900">Conector fechado.</span> Abra de novo no terminal: <code className="rounded bg-gray-100 px-1 font-mono text-[11px] text-gray-800">{COMMAND}</code>
              </>
            )}
          </p>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-100 active:scale-[0.97]"
            disabled={busy}
            onClick={() => void connect(`${pairing.code}:${pairing.port}`)}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Tentar de novo
          </button>
          <button className="h-8 rounded-lg px-2 text-[11px] text-gray-400 transition-colors hover:text-gray-700" onClick={() => {
              disconnect()
              setOpen(true)
            }}>
            Outro código
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute z-40" style={{ left: place.left, width: place.width, bottom: place.bottom }} onMouseDown={stopEvents} onWheel={stopEvents}>
      <div className={`overflow-hidden rounded-2xl ${ISLAND_SURFACE}`}>
        <button className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          {marks}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-gray-900">Conectar meus agentes</span>
            <span className="block truncate text-[11px] text-gray-500">Use o Claude Code ou o Codex do seu computador direto no canvas</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
        {open && (
          <ol className="space-y-3 border-t border-gray-100 px-3.5 py-3 text-[12px] text-gray-700">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">1</span>
              <span className="flex-1">Baixe o conector</span>
              <a
                href={CONNECTOR_FILE}
                download="conector.mjs"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 font-medium text-gray-800 transition-colors hover:bg-gray-50 active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" />
                conector.mjs
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">2</span>
              <span className="flex-1">No terminal, na pasta do download</span>
              <button
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 font-mono text-[11px] text-white transition-colors hover:bg-gray-700 active:scale-[0.97]"
                onClick={copy}
                title="Copiar"
              >
                {COMMAND}
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-60" />}
              </button>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">3</span>
              <span className="flex-1">Cole o código que aparecer</span>
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void connect(code).then((ok) => ok && setOpen(false))
                }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC-123"
                  aria-label="Código do conector"
                  maxLength={12}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-7 w-24 rounded-lg border border-gray-200 px-2 text-center font-mono text-[12px] tracking-widest text-gray-900 placeholder:text-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
                <button
                  type="submit"
                  disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 6}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-violet-600 px-2.5 font-medium text-white transition-colors hover:bg-violet-700 active:scale-[0.97] disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  Conectar
                </button>
              </form>
            </li>
            {error && <li className="rounded-lg bg-red-50 px-2.5 py-1.5 text-red-700">{error}</li>}
            <li className="text-[11px] leading-snug text-gray-400">
              Precisa do Node 18 ou mais novo e do Claude Code ou do Codex instalados. O agente trabalha com a sua assinatura, no seu computador; o navegador pode pedir licença para
              falar com ele.
            </li>
          </ol>
        )}
      </div>
    </div>
  )
}
