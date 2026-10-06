import { CONNECTOR_FILE } from './connectorStore'

/**
 * O que o botão "Baixar" entrega: um arquivo pronto que baixa o conector do
 * próprio app (sempre a versão do app) e abre com o código de pareamento que
 * esta aba criou. No Windows é um `.cmd` de dois cliques; no Mac e no Linux,
 * um comando para colar no Terminal (arquivo baixado ali não abre sem
 * permissão de execução).
 */

export const LAUNCHER_NAME = 'conectar-superelements.cmd'

export type Platform = 'windows' | 'unix'

export const detectPlatform = (): Platform => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const name = nav.userAgentData?.platform || navigator.platform || navigator.userAgent
  return /win/i.test(name) ? 'windows' : 'unix'
}

const connectorUrl = () => `${location.origin}${CONNECTOR_FILE}`

/** Sem acento nem parênteses nas mensagens: o cmd do Windows tropeça neles. */
export function windowsLauncher(code: string) {
  return [
    '@echo off',
    'setlocal',
    'title Superelements - conector dos agentes',
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo.',
    '  echo  O conector precisa do Node.js. Vou abrir a pagina para baixar.',
    '  echo  Depois de instalar, abra este arquivo de novo.',
    '  start "" https://nodejs.org/pt/download',
    '  pause',
    '  exit /b 1',
    ')',
    'set "PASTA=%USERPROFILE%\\.superelements"',
    'if not exist "%PASTA%" mkdir "%PASTA%"',
    'echo  Baixando o conector...',
    `curl -fsSL "${connectorUrl()}" -o "%PASTA%\\conector-novo.mjs"`,
    'if not errorlevel 1 move /y "%PASTA%\\conector-novo.mjs" "%PASTA%\\conector.mjs" >nul',
    'if not exist "%PASTA%\\conector.mjs" (',
    '  echo  Nao consegui baixar o conector. Confira a internet e abra de novo.',
    '  pause',
    '  exit /b 1',
    ')',
    `node "%PASTA%\\conector.mjs" --codigo ${code}`,
    'pause',
    '',
  ].join('\r\n')
}

export const unixCommand = (code: string) =>
  `mkdir -p ~/.superelements && curl -fsSL '${connectorUrl()}' -o ~/.superelements/conector.mjs && node ~/.superelements/conector.mjs --codigo ${code}`

/** Baixa o `.cmd` gerado aqui mesmo, sem passar pelo servidor. */
export function downloadLauncher(code: string) {
  const url = URL.createObjectURL(new Blob([windowsLauncher(code)], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = LAUNCHER_NAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
