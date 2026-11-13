import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * As pastas da Sinfy na casa da pessoa (2026-11-13, a marca SuperElements virou Sinfy). Quem já usava o conector
 * tem `~/SuperElements` e `~/.superelements`: enquanto só a antiga existir, ela continua valendo.
 */
const pick = (now: string, before: string) => {
  const fresh = path.join(os.homedir(), now)
  const old = path.join(os.homedir(), before)
  return !fs.existsSync(fresh) && fs.existsSync(old) ? old : fresh
}

/** Arquivos da pessoa: clones dos sites em código (`sites/`) e pacotes do Edits (`Edits/`). */
export const USER_DIR = pick('Sinfy', 'SuperElements')
/** Configuração local: chaves de serviço (`chaves.json`) e a lista de sites (`sites.json`). */
export const CONFIG_DIR = pick('.sinfy', '.superelements')
/** Pasta padrão do conector para o trabalho dos agentes. */
export const AGENTS_DIR = pick('sinfy-agentes', 'superelements-agentes')
