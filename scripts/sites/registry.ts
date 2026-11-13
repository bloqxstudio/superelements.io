import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CodeSite } from '../../src/features/sites/protocol.ts'
import { CONFIG_DIR, USER_DIR } from '../home.ts'

/**
 * Os sites em código ligados a esta máquina. Ficam fora do repositório do produto
 * (`~/.sinfy/sites.json`), iguais para o `npm run dev` e o conector, e os
 * clones vão para `~/Sinfy/sites/<nome>`: fora desta pasta, para o agente
 * que trabalha no site não carregar as regras da Sinfy.
 */

export const HOME = CONFIG_DIR
export const CLONES = process.env.SINFY_SITES_DIR || process.env.SUPERELEMENTS_SITES_DIR || path.join(USER_DIR, 'sites')
const FILE = path.join(HOME, 'sites.json')

export function readSites(): CodeSite[] {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'))
    return Array.isArray(data?.sites) ? data.sites : []
  } catch {
    return []
  }
}

function writeSites(sites: CodeSite[]) {
  mkdirSync(HOME, { recursive: true })
  writeFileSync(FILE, `${JSON.stringify({ sites }, null, 2)}\n`)
}

export function getSite(id: unknown): CodeSite {
  const site = readSites().find((s) => s.id === id)
  if (!site) throw new Error('Site não encontrado nesta máquina.')
  if (!existsSync(site.dir)) throw new Error(`A pasta do site sumiu: ${site.dir}`)
  return site
}

/** É um projeto Astro? (`astro` nas dependências) */
export function isAstro(dir: string) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return Boolean(pkg.dependencies?.astro || pkg.devDependencies?.astro)
  } catch {
    return false
  }
}

export function addSite(input: { dir: string; name?: string; repo?: string; accountId?: string; url?: string }): CodeSite {
  const dir = path.resolve(input.dir.replace(/^~(?=$|\/)/, os.homedir()))
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Pasta não encontrada: ${dir}`)
  if (!isAstro(dir)) throw new Error('Essa pasta não é um projeto Astro (não achei "astro" no package.json).')
  const sites = readSites()
  const same = sites.find((s) => s.dir === dir && s.accountId === input.accountId)
  if (same) return same
  const site: CodeSite = {
    id: randomUUID().slice(0, 8),
    name: (input.name || input.repo?.split('/')[1] || path.basename(dir)).slice(0, 80),
    accountId: input.accountId,
    dir,
    repo: input.repo,
    url: input.url,
    framework: 'astro',
    addedAt: new Date().toISOString(),
  }
  writeSites([...sites, site])
  return site
}

export function updateSite(id: string, patch: Partial<Pick<CodeSite, 'name' | 'url'>>): CodeSite {
  const sites = readSites()
  const site = sites.find((s) => s.id === id)
  if (!site) throw new Error('Site não encontrado nesta máquina.')
  if (typeof patch.name === 'string' && patch.name.trim()) site.name = patch.name.trim().slice(0, 80)
  if (typeof patch.url === 'string') site.url = patch.url.trim().slice(0, 300) || undefined
  writeSites(sites)
  return site
}

/** Tira o site da lista. A pasta fica onde está. */
export function removeSite(id: string) {
  writeSites(readSites().filter((s) => s.id !== id))
}

/** Um caminho dentro do site, nunca fora (o pedido vem da aba). */
export function inside(site: CodeSite, file: string) {
  const full = path.resolve(site.dir, file)
  const rel = path.relative(site.dir, full)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Arquivo fora do site.')
  if (rel.split(path.sep).some((part) => part === 'node_modules' || part === '.git')) throw new Error('Arquivo fora do código do site.')
  return { full, rel }
}
