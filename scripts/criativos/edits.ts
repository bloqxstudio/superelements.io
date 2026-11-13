import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * O pacote de um vídeo para o Edits (Instagram) gravado numa pasta deste computador (2026-11-13, o usuário:
 * "precisamos de uma forma de exportar os assets de um criativo e levar pra plataforma [Edits]"). A aba gera
 * as camadas (vídeo, voz, efeitos, legenda, capa, manifesto) e manda cada arquivo em pedaços; aqui só grava em
 * `~/SuperElements/Edits/<pasta>/`, onde o MCP do Edits lê. Nada sai deste computador.
 */

export const EDITS_ROOT = path.join(os.homedir(), 'SuperElements', 'Edits')

export interface SaveFileRequest {
  /** O nome da pasta do vídeo (só letras, números, hífen). */
  pasta: string
  /** O arquivo dentro dela (pode ter uma subpasta: `cenas/01.mp4`). */
  nome: string
  /** O pedaço do arquivo, em base64. */
  data: string
  /** 0 no primeiro pedaço (cria ou zera o arquivo); os seguintes vão no fim. */
  parte: number
}

const SAFE_DIR = /^[a-z0-9][a-z0-9-]{0,80}$/
const SAFE_FILE = /^(?:[a-z0-9][a-z0-9-]{0,40}\/)?[a-z0-9][a-z0-9._-]{0,80}$/i

export function saveEditsFile(req: SaveFileRequest): { path: string; pasta: string } {
  const pasta = String(req?.pasta ?? '')
  const nome = String(req?.nome ?? '')
  if (!SAFE_DIR.test(pasta)) throw new Error('Nome de pasta inválido.')
  if (!SAFE_FILE.test(nome) || nome.includes('..')) throw new Error('Nome de arquivo inválido.')
  const dir = path.join(EDITS_ROOT, pasta)
  const full = path.join(dir, nome)
  // Nunca fora da pasta do vídeo
  if (!full.startsWith(dir + path.sep)) throw new Error('Caminho fora da pasta do Edits.')
  mkdirSync(path.dirname(full), { recursive: true })
  const bytes = Buffer.from(String(req?.data ?? ''), 'base64')
  if (Number(req?.parte) > 0) appendFileSync(full, bytes)
  else writeFileSync(full, bytes)
  return { path: full, pasta: dir }
}
