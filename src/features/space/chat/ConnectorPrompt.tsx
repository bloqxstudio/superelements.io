import React, { useState } from 'react'
import { Check, Copy, Download, Loader2 } from 'lucide-react'
import { ISLAND_SURFACE } from '@/features/space/ToolbarIsland'
import { CONNECTOR_FILE, useConnector } from '@/features/space/connector/connectorStore'

/**
 * No app publicado, no lugar do chat enquanto não há conector. O caminho que
 * funciona em qualquer máquina: baixar o `conector.mjs`, rodar com o Node no
 * terminal e colar aqui o código que ele mostra. O código fica guardado neste
 * navegador e no conector: da próxima vez, basta abrir o conector de novo.
 * (Um `.cmd` que abria sozinho foi tentado e o Windows bloqueava.)
 */

type Platform = 'windows' | 'unix'

const detectPlatform = (): Platform => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  return /win/i.test(nav.userAgentData?.platform || navigator.platform || navigator.userAgent) ? 'windows' : 'unix'
}

/** O comando para a pasta Downloads: PowerShell (o Terminal padrão do Windows) ou o Terminal do Mac e do Linux. */
const COMMANDS: Record<Platform, string> = {
  windows: 'node "$HOME\\Downloads\\conector.mjs"',
  unix: 'node ~/Downloads/conector.mjs',
}

const Step: React.FC<{ n: number; title: string; children?: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex gap-2.5">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold tabular-nums text-gray-600">{n}</span>
    <div className="min-w-0 flex-1 space-y-1.5">
      <p className="text-[12px] font-medium leading-5 text-gray-900">{title}</p>
      {children}
    </div>
  </li>
)

/** Sem `place`, fica dentro da aba Agente; com ele, flutua no canvas. */
export const ConnectorPrompt: React.FC<{ place?: { left: number; width: number; bottom: number } }> = ({ place }) => {
  const { status, error, pairing, connect, disconnect } = useConnector()
  const [platform, setPlatform] = useState<Platform>(detectPlatform)
  const [copied, setCopied] = useState(false)
  const [typed, setTyped] = useState('')
  const checking = status === 'checking'
  const command = COMMANDS[platform]

  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const stopEvents = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div className={place ? 'pointer-events-auto absolute z-40' : 'p-3'} style={place ? { left: place.left, width: place.width, bottom: place.bottom } : undefined} onMouseDown={stopEvents} onWheel={stopEvents}>
      <div className={place ? `overflow-hidden rounded-2xl ${ISLAND_SURFACE}` : 'overflow-hidden rounded-xl border border-gray-200'}>
        <div className="border-b border-gray-100 px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-gray-900">Conectar meus agentes</p>
          <p className="text-[11px] text-gray-500">Use o Claude Code ou o Codex do seu computador direto no canvas.</p>
        </div>

        <ol className="space-y-3.5 px-3.5 py-3">
          <Step n={1} title="Baixe o conector">
            <a
              href={CONNECTOR_FILE}
              download="conector.mjs"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-gray-900 px-3 text-[12px] font-medium text-white transition-[background-color,transform] hover:bg-gray-700 active:scale-[0.97]"
            >
              <Download className="h-3.5 w-3.5" />
              conector.mjs
            </a>
          </Step>

          <Step n={2} title={platform === 'windows' ? 'Abra o Terminal e rode:' : 'No Terminal, rode:'}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg bg-gray-900 px-2.5 py-2 text-left font-mono text-[11px] leading-snug text-white transition-colors hover:bg-gray-800"
              onClick={copy}
              title="Copiar"
            >
              <span className="min-w-0 flex-1 break-all">{command}</span>
              {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            </button>
            <p className="text-[11px] leading-snug text-gray-500">
              {platform === 'windows' ? 'Clique com o direito no botão Iniciar › Terminal. ' : ''}Se o arquivo não foi para Downloads, troque o caminho. Deixe a janela aberta enquanto usa o chat.
            </p>
          </Step>

          <Step n={3} title="Cole o código que apareceu no terminal">
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void connect(typed)
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                aria-label="Código que o conector mostrou"
                maxLength={16}
                spellCheck={false}
                autoComplete="off"
                className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-center font-mono text-[12px] tracking-widest text-gray-900 placeholder:text-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={checking || typed.replace(/[^A-Za-z0-9]/g, '').length < 6}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-[12px] font-medium text-white transition-colors hover:bg-violet-700 active:scale-[0.97] disabled:bg-gray-200 disabled:text-gray-400"
              >
                {checking && <Loader2 className="h-3 w-3 animate-spin" />}
                Conectar
              </button>
            </form>
            {error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</p>}
            <p className="text-[11px] leading-snug text-gray-500">Se o navegador perguntar se o site pode acessar apps e serviços neste dispositivo, clique em Permitir.</p>
          </Step>
        </ol>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 px-3.5 py-2 text-[11px] text-gray-400">
          <span>Precisa do Node.js e do Claude Code ou do Codex.</span>
          <span className="flex-1" />
          <button className="hover:text-gray-700" onClick={() => setPlatform(platform === 'windows' ? 'unix' : 'windows')}>
            {platform === 'windows' ? 'Mac ou Linux?' : 'Windows?'}
          </button>
          {pairing && (
            <button className="hover:text-gray-700" onClick={disconnect} title="Esquece o código guardado neste navegador">
              Esquecer o código
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
