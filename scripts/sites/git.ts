import { execFile } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ChangedFile, GithubRepo, PublishMode, PublishResult, SiteStatus } from '../../src/features/sites/protocol.ts'
import { CLONES } from './registry.ts'

/**
 * GitHub e git dos sites em código, pelo `gh` e o `git` desta máquina (a conta
 * logada no `gh` é a que clona e publica). Nada de token no navegador.
 */

/** Pasta onde o editor guarda as imagens que a pessoa envia; só o que está aqui o "Descartar" apaga. */
export const UPLOAD_DIR = 'public/sinfy'

const run = (bin: string, args: string[], cwd?: string, timeout = 120_000) =>
  new Promise<string>((resolve, reject) => {
    execFile(bin, args, { cwd, timeout, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' } }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || stdout || error.message).toString().trim().split('\n').slice(-4).join(' ')
        return reject(new Error(detail || error.message))
      }
      resolve(stdout.toString())
    })
  })

export const git = (dir: string, ...args: string[]) => run('git', args, dir)

export async function githubUser(): Promise<{ ok: boolean; user?: string }> {
  try {
    const user = (await run('gh', ['api', 'user', '--jq', '.login'], undefined, 15_000)).trim()
    return { ok: Boolean(user), user: user || undefined }
  } catch {
    return { ok: false }
  }
}

/** Os repositórios que a conta do `gh` vê (dela, de colaboração e das organizações), os mais recentes primeiro. */
export async function listRepos(): Promise<GithubRepo[]> {
  const out = await run('gh', [
    'api',
    'user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    '--jq',
    '[.[] | {nameWithOwner: .full_name, description: (.description // ""), isPrivate: .private, updatedAt: .updated_at, url: .html_url}]',
  ])
  return JSON.parse(out) as GithubRepo[]
}

const REPO = /^[\w.-]+\/[\w.-]+$/

/** Clona (ou reaproveita o clone) e devolve a pasta. */
export async function cloneRepo(repo: string): Promise<string> {
  if (!REPO.test(repo)) throw new Error('Repositório inválido: use dono/nome.')
  const dir = path.join(CLONES, repo.replace('/', '__'))
  if (existsSync(path.join(dir, '.git'))) {
    const origin = (await git(dir, 'remote', 'get-url', 'origin').catch(() => '')).trim()
    if (!origin.toLowerCase().includes(repo.toLowerCase())) throw new Error(`Já existe outra pasta em ${dir}.`)
    return dir
  }
  await run('gh', ['repo', 'clone', repo, dir], undefined, 600_000)
  return dir
}

async function defaultBranch(dir: string) {
  const ref = (await git(dir, 'symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD').catch(() => '')).trim()
  if (ref) return ref.replace('refs/remotes/origin/', '')
  for (const name of ['main', 'master']) {
    if ((await git(dir, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`).catch(() => '')).trim()) return name
  }
  return (await git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).trim()
}

const STATUS_TEXT: Record<string, string> = { M: 'alterado', A: 'novo', D: 'apagado', R: 'renomeado', '?': 'novo', U: 'em conflito' }

export async function siteStatus(dir: string, fetch = false): Promise<SiteStatus> {
  const remote = Boolean((await git(dir, 'remote').catch(() => '')).trim())
  if (fetch && remote) await git(dir, 'fetch', '--quiet', 'origin').catch(() => {})
  const out = await git(dir, 'status', '--porcelain=v1', '-b', '--untracked-files=all')
  const lines = out.split('\n').filter(Boolean)
  const head = lines[0]?.startsWith('## ') ? lines.shift()!.slice(3) : ''
  const branch = head.split('...')[0].replace(/^No commits yet on /, '').trim()
  const ahead = Number(/ahead (\d+)/.exec(head)?.[1] ?? 0)
  const behind = Number(/behind (\d+)/.exec(head)?.[1] ?? 0)
  const changes: ChangedFile[] = lines.map((line) => {
    const code = line.slice(0, 2).trim()[0] ?? 'M'
    const file = line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, '')
    return { file, status: STATUS_TEXT[code] ?? 'alterado' }
  })
  const last = (await git(dir, 'log', '-1', '--format=%h%x1f%s%x1f%cI').catch(() => '')).trim()
  const [hash, message, at] = last.split('\x1f')
  return { branch, defaultBranch: await defaultBranch(dir), changes, ahead, behind, remote, lastCommit: hash ? { hash, message, at } : undefined }
}

/** O que mudou desde o último commit, para a pessoa conferir antes de publicar. */
export async function siteDiff(dir: string): Promise<string> {
  await git(dir, 'add', '--intent-to-add', '--all').catch(() => {})
  const diff = await git(dir, 'diff', '--no-color', '--no-ext-diff', '--', '.', ':(exclude)*.png', ':(exclude)*.jpg', ':(exclude)*.jpeg', ':(exclude)*.webp', ':(exclude)*.gif', ':(exclude)*.avif')
  return diff.length > 200_000 ? `${diff.slice(0, 200_000)}\n… (cortado)` : diff
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')

export async function publish(dir: string, mode: PublishMode, message: string): Promise<PublishResult> {
  const status = await siteStatus(dir)
  if (!status.remote) throw new Error('O site não tem repositório remoto (origin).')
  if (!status.changes.length && !status.ahead) throw new Error('Não há mudança para publicar.')
  const text = message.trim().slice(0, 200) || 'Edição pela Sinfy'
  let branch = status.branch
  if (mode === 'revisao' && branch === status.defaultBranch) {
    branch = `sinfy/${stamp()}`
    await git(dir, 'switch', '-c', branch)
  }
  if (mode === 'direto' && branch !== status.defaultBranch)
    throw new Error(`Você está na revisão "${branch}". Publique por ela (revisão) ou volte para ${status.defaultBranch} antes.`)
  if (status.changes.length) {
    await git(dir, 'add', '--all')
    await git(dir, 'commit', '--quiet', '-m', text)
  }
  if (mode === 'direto') {
    // Alguém publicou antes: põe esta edição por cima, sem perder nada; conflito volta atrás
    await git(dir, 'fetch', '--quiet', 'origin', branch)
    try {
      await git(dir, 'rebase', '--quiet', `origin/${branch}`)
    } catch (error) {
      await git(dir, 'rebase', '--abort').catch(() => {})
      throw new Error(`O site mudou no GitHub no mesmo trecho. A edição ficou salva aqui; peça ao agente para juntar. (${error instanceof Error ? error.message : String(error)})`)
    }
    await git(dir, 'push', 'origin', `HEAD:${branch}`)
  } else {
    await git(dir, 'push', '--quiet', '-u', 'origin', branch)
  }
  const commit = (await git(dir, 'rev-parse', '--short', 'HEAD')).trim()
  if (mode === 'direto') return { mode, branch, commit }
  // O PR desta revisão: cria na primeira vez, depois só recebe os commits novos
  let pr = (await run('gh', ['pr', 'view', branch, '--json', 'url', '--jq', '.url'], dir).catch(() => '')).trim()
  if (!pr) {
    const body = 'Edição feita no editor visual da Sinfy. Ao aprovar e juntar este PR, o site é publicado pela hospedagem a partir da branch principal.'
    try {
      pr = (await run('gh', ['pr', 'create', '--base', status.defaultBranch, '--head', branch, '--title', text, '--body', body], dir)).trim().split('\n').pop() ?? ''
    } catch (error) {
      // A branch já subiu: o PR pode ser aberto à mão no GitHub
      return { mode, branch, commit, warning: `A revisão subiu, mas o PR não abriu (${error instanceof Error ? error.message.slice(0, 160) : String(error)}). Abra o PR da branch ${branch} no GitHub.` }
    }
  }
  return { mode, branch, commit, pr }
}

/** Traz o que mudou no GitHub; com `toDefault`, volta da revisão para a branch principal. */
export async function pull(dir: string, toDefault: boolean) {
  const status = await siteStatus(dir)
  if (toDefault && status.branch !== status.defaultBranch) {
    if (status.changes.length) throw new Error('Há edições não publicadas nesta revisão: publique ou descarte antes de voltar.')
    await git(dir, 'switch', status.defaultBranch)
  }
  if (!status.remote) return siteStatus(dir)
  await git(dir, 'pull', '--ff-only', '--quiet').catch((error: Error) => {
    throw new Error(`Não deu para atualizar sem misturar com as edições daqui (${error.message}). Publique ou descarte antes.`)
  })
  return siteStatus(dir, false)
}

/** Volta os arquivos ao último commit. Arquivos novos só os que o editor criou (imagens enviadas). */
export async function discard(dir: string, files?: string[]) {
  const status = await siteStatus(dir)
  const targets = files?.length ? status.changes.filter((c) => files.includes(c.file)) : status.changes
  const tracked = targets.filter((c) => c.status !== 'novo').map((c) => c.file)
  if (tracked.length) await git(dir, 'checkout', 'HEAD', '--', ...tracked)
  // Arquivos novos: os que o editor criou somem; os do agente também, se a pessoa escolheu cada um
  for (const c of targets.filter((t) => t.status === 'novo')) {
    if (!files?.length && !c.file.startsWith(`${UPLOAD_DIR}/`)) continue
    await git(dir, 'rm', '--cached', '--quiet', '--ignore-unmatch', '--', c.file).catch(() => {})
    const full = path.join(dir, c.file)
    if (full.startsWith(dir + path.sep) && existsSync(full)) rmSync(full, { force: true })
  }
  const uploads = path.join(dir, UPLOAD_DIR)
  if (existsSync(uploads) && statSync(uploads).isDirectory() && !readdirSync(uploads).length) rmSync(uploads, { recursive: true, force: true })
  return siteStatus(dir)
}
