import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * O Codex do produto trabalha só com o que o produto entrega (2026-11-05). Pelo `codex exec` ele
 * carregava tudo o que a pessoa tem no Codex desta máquina: os apps do ChatGPT (um conector da
 * Sinfy, que pedia aprovação e travava a edição: "o acesso à Sinfy exige uma aprovação que esta
 * execução não permite solicitar"), os servidores MCP do `config.toml`, o navegador e os
 * subagentes. Aqui ficam desligados; `keep` mantém um servidor nosso (o `iara` do chat).
 */
export function codexIsolationArgs(keep: string[] = []): string[] {
  const args = ['--disable', 'apps', '--disable', 'plugins', '--disable', 'multi_agent', '--disable', 'browser_use', '--disable', 'computer_use', '--disable', 'in_app_browser']
  try {
    const home = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex')
    const config = path.join(home, 'config.toml')
    if (!existsSync(config)) return args
    const names = new Set<string>()
    for (const m of readFileSync(config, 'utf8').matchAll(/^\s*\[mcp_servers\.("?)([^\]."]+)\1\]/gm)) names.add(m[2])
    // O `-c` do Codex separa o caminho pelos pontos e não aceita o nome entre aspas: só nomes simples
    for (const name of names) if (!keep.includes(name) && /^[\w-]+$/.test(name)) args.push('-c', `mcp_servers.${name}.enabled=false`)
  } catch {
    // sem ler o config: ficam só os desligados acima
  }
  return args
}
