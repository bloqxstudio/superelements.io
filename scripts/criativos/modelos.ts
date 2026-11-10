import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CLAUDE_ALIASES, isChatModel, type ChatAgentModel } from '../../src/features/space/chat/protocol.ts'

/**
 * Modelo de cada agente por pedido (2026-11-10, o usuário: "seletor de qual modelo e agente vai executar qual
 * ação, permitir selecionar no chat qual modelo quer usar"). A tela manda `model` junto com `engine`; o servidor
 * guarda a escolha durante o pedido (`withModel`) e o `askClaude`/`askCodex` a usam, sem mudar cada função que
 * monta o pedido. Sem escolha, vale o padrão de sempre (Sonnet no Claude Code; o do `config.toml` no Codex).
 */

const scope = new AsyncLocalStorage<{ model?: string }>()

/** Slug de modelo aceitável: `sonnet`, `claude-opus-5-5`, `gpt-6.1-sol`. Nada de aspas ou espaço (vai num `-c` do Codex). */
export const cleanModel = (v: unknown): string | undefined => (typeof v === 'string' && /^[\w.-]{2,60}$/.test(v.trim()) ? v.trim() : undefined)

export const withModel = <T>(model: unknown, fn: () => Promise<T>): Promise<T> => scope.run({ model: cleanModel(model) }, fn)

/** O modelo escolhido para o pedido em andamento, se houver. */
export const scopedModel = () => scope.getStore()?.model

/** Modelo do Claude Code: o pedido explícito, o do pedido em andamento, ou o padrão. Só aceita os do Claude. */
export const claudeModel = (explicit?: string, fallback = 'sonnet') => {
  const m = cleanModel(explicit) ?? scopedModel()
  return m && (isChatModel(m) || m in CLAUDE_ALIASES || m.startsWith('claude-')) ? m : fallback
}

const codexHome = () => process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex')

/** Os modelos que o Codex desta máquina lista para a conta (`models_cache.json`), na ordem dele. */
export function codexModels(): ChatAgentModel[] {
  try {
    const cache = path.join(codexHome(), 'models_cache.json')
    if (!existsSync(cache)) return []
    const models = (JSON.parse(readFileSync(cache, 'utf8')) as { models?: { slug?: string; visibility?: string; display_name?: string; description?: string }[] }).models ?? []
    return models
      .filter((m) => m.visibility === 'list' && cleanModel(m.slug))
      .slice(0, 12)
      .map((m) => ({ id: m.slug as string, name: (m.display_name || m.slug) as string, ...(m.description ? { hint: m.description.slice(0, 140) } : {}) }))
  } catch {
    return []
  }
}

/** O modelo do `config.toml` do Codex (o padrão da máquina). */
export function codexConfigModel(): string | undefined {
  try {
    const config = path.join(codexHome(), 'config.toml')
    return existsSync(config) ? /^\s*model\s*=\s*"([^"]+)"/m.exec(readFileSync(config, 'utf8'))?.[1] : undefined
  } catch {
    return undefined
  }
}

/**
 * Argumentos de modelo do `codex exec`. Ordem: `CODEX_MODEL` (manda sobre tudo), o escolhido (explícito ou o do
 * pedido em andamento), e então o do `config.toml`, que pode ter saído da lista da conta (erro "model is not
 * supported when using Codex with a ChatGPT account"): aí pede o primeiro da lista.
 */
export function codexModelArgs(explicit?: string): string[] {
  const forced = process.env.CODEX_MODEL?.trim()
  if (forced) return ['-c', `model="${forced}"`]
  const listed = codexModels().map((m) => m.id)
  const chosen = cleanModel(explicit) ?? scopedModel()
  // Um modelo do Claude que chegou aqui (a tarefa trocou de agente) não serve ao Codex
  if (chosen && !isChatModel(chosen) && !(chosen in CLAUDE_ALIASES) && !chosen.startsWith('claude-') && (!listed.length || listed.includes(chosen))) return ['-c', `model="${chosen}"`]
  const current = codexConfigModel()
  if (!listed.length || (current && listed.includes(current))) return []
  return ['-c', `model="${listed[0]}"`]
}
