import React, { useMemo, useState } from 'react'
import { AreaTabs } from '@/features/navigation/AreaTabs'
import { Link } from 'react-router-dom'
import { Code2, FolderOpen, Github, Loader2, Lock, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCrm } from '@/features/crm/crmStore'
import { callSites, useSitesLink } from '@/features/sites/link'
import type { CodeSite, GithubRepo } from '@/features/sites/protocol'
import { PREVIEW_TEXT } from '@/features/sites/ui'

/**
 * Sites em código (2026-11-06, o usuário: "suporte pra importar um site em astro… conectar o repo com o
 * github… usar como um wysiwyg pra editar o astro e publicar"). Liga um repositório do GitHub (clonado
 * pelo `gh` desta máquina) ou uma pasta que já está aqui, e abre o editor visual.
 */

const STEPS = [
  ['Ligue o repositório', 'Do GitHub (clonado nesta máquina) ou uma pasta que já está aqui.'],
  ['Edite na prévia', 'Clique num elemento; duplo clique edita o texto ali mesmo. O código muda junto.'],
  ['Publique', 'Direto na branch principal (a hospedagem publica) ou como PR para revisar.'],
] as const

const CodeSites: React.FC = () => {
  const team = useCrm((s) => s.team)
  const { connected, ready, stale, state } = useSitesLink()
  const [tab, setTab] = useState<'github' | 'pasta'>('github')
  const [repos, setRepos] = useState<GithubRepo[] | null>(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [query, setQuery] = useState('')
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const sites = useMemo(() => (state?.sites ?? []).filter((s) => !team || !s.accountId || s.accountId === team.id), [state, team])
  const previewOf = (id: string) => state?.previews.find((p) => p.siteId === id)

  const loadRepos = async () => {
    setLoadingRepos(true)
    try {
      setRepos(await callSites<GithubRepo[]>('repos'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingRepos(false)
    }
  }

  const connect = async (input: { repo?: string; dir?: string }) => {
    setBusy(input.repo ?? input.dir ?? '')
    try {
      const site = await callSites<CodeSite>('connect', { ...input, accountId: team?.id })
      toast.success(`${site.name} ligado`)
      setDir('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (site: CodeSite) => {
    if (!window.confirm(`Tirar "${site.name}" da lista? A pasta continua em ${site.dir}.`)) return
    await callSites('remove', { siteId: site.id }).catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
  }

  const shown = (repos ?? []).filter((r) => !query || r.nameWithOwner.toLowerCase().includes(query.toLowerCase()) || r.description.toLowerCase().includes(query.toLowerCase()))
  const linked = new Set(sites.map((s) => s.repo).filter(Boolean))

  return (
    <div className="se-page min-h-[calc(100vh-57px)]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <AreaTabs area="sites" />
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
          <Code2 className="h-6 w-6" aria-hidden /> Sites em código
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Edite sites feitos em Astro como no Space: clique no que quer mudar na prévia, e o código do site muda junto. Publicar é um push no GitHub.</p>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-xl border border-gray-200 bg-white p-4">
              <span className="text-xs font-semibold text-violet-600">{i + 1}</span>
              <p className="mt-1 text-sm font-medium text-gray-900">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{text}</p>
            </li>
          ))}
        </ol>

        {!ready ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {connected && stale
              ? 'Esta máquina não respondeu. Atualize o conector (baixe o conector.mjs de novo) ou reinicie o npm run dev.'
              : 'Os sites em código rodam nesta máquina: abra o conector dos agentes (ou o npm run dev) para ligar e editar.'}
          </div>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-gray-900">Sites desta conta</h2>
              {sites.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Nenhum site ligado ainda. Ligue um abaixo.</p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {sites.map((site) => {
                    const preview = previewOf(site.id)
                    return (
                      <li key={site.id} className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                            <Code2 className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900">{site.name}</p>
                            <p className="truncate text-xs text-gray-500">{site.repo ?? site.dir}</p>
                          </div>
                          <button type="button" onClick={() => void remove(site)} aria-label={`Tirar ${site.name} da lista`} className="rounded-md p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 group-hover:opacity-100">
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">Astro · prévia {PREVIEW_TEXT[preview?.state ?? 'parada']}</span>
                          <Button asChild size="sm">
                            <Link to={`/sites/${site.id}`}>Abrir editor</Link>
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="mt-10 rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-1 border-b border-gray-200 px-2 pt-2" role="tablist">
                {([['github', 'Do GitHub', Github], ['pasta', 'Pasta desta máquina', FolderOpen]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === id ? 'border-gray-900 font-medium text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden /> {label}
                  </button>
                ))}
              </div>

              {tab === 'github' ? (
                <div className="p-4">
                  {!state?.github.ok ? (
                    <p className="text-sm text-gray-600">
                      O GitHub desta máquina não está logado. No terminal, rode <code className="rounded bg-gray-100 px-1">gh auth login</code> e volte aqui.
                    </p>
                  ) : repos === null ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-600">Conectado como <strong>{state.github.user}</strong>. Os repositórios clonam em <code className="rounded bg-gray-100 px-1">~/Sinfy/sites</code>.</p>
                      <Button size="sm" variant="outline" onClick={() => void loadRepos()} disabled={loadingRepos}>
                        {loadingRepos && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />} Ver repositórios
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar repositório" className="pl-9" aria-label="Procurar repositório" />
                      </div>
                      <ul className="mt-3 max-h-[360px] divide-y divide-gray-100 overflow-y-auto">
                        {shown.map((repo) => (
                          <li key={repo.nameWithOwner} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
                                {repo.nameWithOwner} {repo.isPrivate && <Lock className="h-3 w-3 text-gray-400" aria-label="Privado" />}
                              </p>
                              {repo.description && <p className="truncate text-xs text-gray-500">{repo.description}</p>}
                            </div>
                            {linked.has(repo.nameWithOwner) ? (
                              <span className="text-xs text-gray-400">Ligado</span>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void connect({ repo: repo.nameWithOwner })}>
                                {busy === repo.nameWithOwner && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                                {busy === repo.nameWithOwner ? 'Clonando…' : 'Ligar'}
                              </Button>
                            )}
                          </li>
                        ))}
                        {!shown.length && <li className="py-6 text-center text-sm text-gray-500">Nenhum repositório com esse nome.</li>}
                      </ul>
                      <p className="mt-2 text-xs text-gray-400">Só projetos Astro podem ser ligados: o editor confere o package.json depois de clonar.</p>
                    </>
                  )}
                </div>
              ) : (
                <form
                  className="flex flex-col gap-2 p-4 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (dir.trim()) void connect({ dir: dir.trim() })
                  }}
                >
                  <Input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="~/ShipStudio/meu-site" aria-label="Pasta do site nesta máquina" className="flex-1 font-mono text-sm" />
                  <Button type="submit" disabled={!dir.trim() || busy !== null}>
                    {busy && busy === dir.trim() && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />} Ligar pasta
                  </Button>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default CodeSites
