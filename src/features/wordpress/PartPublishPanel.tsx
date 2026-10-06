import React, { useEffect, useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Component, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PART_NOUN, partShownIn, plural } from '@/features/space/pages/pages'
import { PART_COLOR } from '@/features/space/pages/parts'
import { cn } from '@/lib/utils'
import { useSpaceStore } from '@/store/spaceStore'
import { imagesToUpload, PageConflictError, pageBackups, partElements, publishPart, restoreLastBackup, type PartPublishResult } from './publish'
import { inlineReason, listSiteParts, partConditions, partsSupport, type PartsSupport, type SitePart } from './siteParts'
import { useWordPressUi, wpDate } from './uiStore'
import { useActiveWordPress, useWordPressSession } from './useWordPressConnection'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Phase =
  | { kind: 'loading' }
  | { kind: 'form' }
  | { kind: 'working'; step: string }
  | { kind: 'conflict'; modifiedGmt: string }
  | { kind: 'done'; result: PartPublishResult }
  | { kind: 'error'; message: string }

/** Modelos do mesmo lugar que estão valendo no site (com alguma condição). */
const activeOn = (parts: SitePart[], except?: number) => parts.filter((p) => p.id !== except && p.status === 'publish' && p.conditions.length)

/** Onde o modelo aparece hoje, em palavras. */
const conditionsText = (conditions: string[]) =>
  conditions.includes('include/general') ? `no site inteiro${conditions.some((c) => c.startsWith('exclude/')) ? ', com exceções' : ''}` : 'em parte do site'

/**
 * Publica o cabeçalho (ou o rodapé) do site como modelo do Theme Builder do
 * Elementor Pro. É o conteúdo do diálogo de publicar quando a folha aberta é
 * de um componente. Se o site já tem um cabeçalho valendo, pergunta se o
 * nosso entra no lugar dele (o dele fica salvo, sem condição) ou se o dele é
 * atualizado com o nosso.
 */
export const PartPublishPanel: React.FC = () => {
  const partId = useWordPressUi((s) => s.publishPageId)
  const returnId = useWordPressUi((s) => s.publishReturnId)
  const back = useWordPressUi((s) => s.back)
  const connection = useActiveWordPress()
  const projectId = useWordPressSession((s) => s.projectId)
  const part = useSpaceStore((s) => s.pages.find((p) => p.id === partId))
  const pages = useSpaceStore((s) => s.pages)
  const nodes = useSpaceStore((s) => s.nodes)
  const returnName = useSpaceStore((s) => s.pages.find((p) => p.id === returnId)?.name)
  const link = part?.wordpress && connection && part.wordpress.siteUrl === connection.site.siteUrl ? part.wordpress : undefined
  const kind = part?.part?.kind ?? 'header'
  const noun = PART_NOUN[kind]
  // Componente livre: modelo salvo na Biblioteca, usado pelas páginas pelo widget Modelo (sem condição)
  const free = kind === 'section'

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [support, setSupport] = useState<PartsSupport | null>(null)
  const [existing, setExisting] = useState<SitePart[]>([])
  // Site que já tem um cabeçalho valendo: o nosso entra no lugar dele, ou ele recebe o nosso
  const [choice, setChoice] = useState<'replace' | 'update'>('replace')
  const [backups, setBackups] = useState(0)

  useEffect(() => {
    if (!partId || !connection) return
    let alive = true
    setPhase({ kind: 'loading' })
    partsSupport(connection, true)
      .then(async (found) => {
        if (!alive) return
        setSupport(found)
        if (found.mode === 'theme' && !link && kind !== 'section') setExisting(await listSiteParts(connection, kind))
        if (alive) setPhase({ kind: 'form' })
      })
      .catch((error) => alive && setPhase({ kind: 'error', message: errorText(error) }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId, connection?.site.siteUrl])

  useEffect(() => {
    useWordPressUi.getState().setBusy(phase.kind === 'working')
    return () => useWordPressUi.getState().setBusy(false)
  }, [phase.kind])

  useEffect(() => {
    if (!link || !projectId) return setBackups(0)
    pageBackups(projectId, link.postId)
      .then((list) => setBackups(list.length))
      .catch(() => setBackups(0))
  }, [link, projectId, phase.kind])

  const summary = useMemo(() => {
    if (!partId || !connection || !part) return null
    try {
      const { elements, sectionCount } = partElements(partId)
      return { sectionCount, images: imagesToUpload(elements, connection).length, ...partConditions(part, pages, connection.site.siteUrl) }
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId, connection, part, pages, nodes])

  if (!part?.part) return null
  const shownIn = partShownIn(part, pages, nodes)
  const active = activeOn(existing)

  const run = async (overwrite = false) => {
    if (!connection || !projectId) return
    setPhase({ kind: 'working', step: 'Preparando o modelo…' })
    try {
      const target = !link && active.length === 1 && choice === 'update' ? active[0].id : undefined
      const release = !link && choice === 'replace' ? active.map((p) => p.id) : undefined
      const result = await publishPart({ connection, projectId, partId: part.id, overwrite, target, release, onProgress: (step) => setPhase({ kind: 'working', step }) })
      setPhase({ kind: 'done', result })
    } catch (error) {
      if (error instanceof PageConflictError) setPhase({ kind: 'conflict', modifiedGmt: error.modifiedGmt })
      else setPhase({ kind: 'error', message: errorText(error) })
    }
  }

  const undo = async () => {
    if (!connection || !projectId) return
    setPhase({ kind: 'working', step: 'Voltando a versão anterior no site…' })
    try {
      const restored = await restoreLastBackup(connection, projectId, part.id)
      toast.success(`O ${noun} do site voltou para a versão anterior`, {
        description: `A de ${new Date(restored.restoredFrom).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. O canvas continua com as suas mudanças.`,
      })
      setPhase({ kind: 'form' })
    } catch (error) {
      setPhase({ kind: 'error', message: errorText(error) })
    }
  }

  const unlink = () => {
    useSpaceStore.getState().setPageWordPress(part.id, undefined)
    toast.success(`O ${noun} não está mais ligado ao WordPress`, { description: 'A próxima publicação cria outro modelo no Theme Builder.' })
  }

  const closeLabel = returnName ? `Voltar para ${returnName}` : 'Fechar'
  let body: React.ReactNode
  let footer: React.ReactNode

  if (!connection) {
    body = <p className="text-sm text-muted-foreground">Conecte o WordPress do cliente pelo botão WordPress, no alto da tela.</p>
    footer = <Button onClick={back}>{closeLabel}</Button>
  } else if (phase.kind === 'loading' || phase.kind === 'working') {
    body = (
      <p className="flex items-center gap-2 py-6 text-sm text-gray-700" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {phase.kind === 'loading' ? 'Conferindo o Theme Builder do site…' : phase.step}
      </p>
    )
    footer = null
  } else if (support && support.mode !== 'theme') {
    body = (
      <div className="grid gap-3 text-sm text-gray-700">
        <p className="flex gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            O {noun} não pode virar modelo do Elementor neste site: {inlineReason(support)}. Ele vai dentro de cada página publicada, e mudar o{' '}
            {noun} pede publicar as páginas de novo.
          </span>
        </p>
      </div>
    )
    footer = (
      <>
        <Button onClick={back}>{closeLabel}</Button>
      </>
    )
  } else if (phase.kind === 'conflict') {
    body = (
      <div className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">O {noun} mudou no site</p>
        <p>
          Alguém editou o modelo {link?.title} no Elementor em {wpDate(phase.modifiedGmt)}, depois da última publicação daqui. Atualizar agora apaga essas
          mudanças (a versão de lá fica guardada para desfazer).
        </p>
      </div>
    )
    footer = (
      <>
        <Button variant="ghost" onClick={() => setPhase({ kind: 'form' })}>
          Voltar
        </Button>
        <Button variant="destructive" onClick={() => run(true)}>
          Atualizar mesmo assim
        </Button>
      </>
    )
  } else if (phase.kind === 'done') {
    const { result } = phase
    body = (
      <div className="grid gap-3 text-sm text-gray-900">
        <p className="flex gap-2">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          {free ? (
            <span>
              {result.created ? 'O componente foi salvo' : 'O componente foi atualizado'} na Biblioteca do Elementor como "{result.title}". As páginas do site que o usam já mostram
              esta versão.
              {result.uploaded > 0 && ` ${plural(result.uploaded, 'imagem foi', 'imagens foram')} para a biblioteca de mídia.`}
            </span>
          ) : (
            <span>
              {result.created ? `O ${noun} entrou no Theme Builder` : `O ${noun} foi atualizado no Theme Builder`} como "{result.title}", no site inteiro
              {result.excluded.length ? `, menos ${result.excluded.join(', ')}` : ''}. Todas as páginas do site já mostram este {noun}.
              {result.uploaded > 0 && ` ${plural(result.uploaded, 'imagem foi', 'imagens foram')} para a biblioteca de mídia.`}
            </span>
          )}
        </p>
        {result.released > 0 && (
          <p className="text-xs text-muted-foreground">
            {result.released === 1 ? `O ${noun} que o site usava saiu do site: continua salvo` : `Os ${result.released} modelos que o site usava saíram do site: continuam salvos`} em Modelos › Theme Builder, sem condição.
          </p>
        )}
        {!free && result.pending.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {result.pending.join(', ')} {result.pending.length === 1 ? 'fica' : 'ficam'} sem o {noun}: a exceção entra quando {result.pending.length === 1 ? 'ela for publicada' : 'elas forem publicadas'}.
          </p>
        )}
        {result.failedImages.length > 0 && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {plural(result.failedImages.length, 'imagem não subiu e continua', 'imagens não subiram e continuam')} apontando para o endereço de origem.
          </p>
        )}
        {!result.cacheCleared && (
          <p className="flex gap-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />O WordPress não deixou limpar o cache de CSS do Elementor com este usuário: o
            site pode aparecer com o estilo antigo até alguém usar Elementor, Ferramentas, Regenerar arquivos.
          </p>
        )}
      </div>
    )
    footer = (
      <>
        <Button variant="ghost" onClick={back}>
          {closeLabel}
        </Button>
        <Button variant="outline" asChild>
          <a href={result.editUrl} target="_blank" rel="noopener noreferrer">
            Editar no Elementor
            <ExternalLink aria-hidden />
          </a>
        </Button>
        <Button asChild>
          <a href={connection.site.siteUrl} target="_blank" rel="noopener noreferrer">
            Ver o site
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </>
    )
  } else {
    body = (
      <div className="grid gap-4">
        {link ? (
          <div className="rounded-lg border px-4 py-3">
            <a href={link.link} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-900 hover:underline">
              {link.title}
            </a>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Modelo do Theme Builder · publicado daqui em {new Date(link.syncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
        ) : active.length ? (
          <div className="grid gap-2">
            <Label>O site já tem {active.length === 1 ? `um ${noun}` : `${active.length} modelos de ${noun}`} valendo</Label>
            <div className="grid gap-2" role="radiogroup" aria-label={`O ${noun} que o site já tem`}>
              {(
                [
                  {
                    value: 'replace' as const,
                    label: `Entrar no lugar ${active.length === 1 ? `de "${active[0].title}"` : 'deles'}`,
                    hint: `Cria o nosso no Theme Builder. ${active.length === 1 ? 'O atual sai do site, mas continua salvo' : 'Os atuais saem do site, mas continuam salvos'} no WordPress, sem condição.`,
                  },
                  ...(active.length === 1
                    ? [
                        {
                          value: 'update' as const,
                          label: `Atualizar "${active[0].title}"`,
                          hint: `O conteúdo dele vira o nosso, no mesmo modelo (hoje ${conditionsText(active[0].conditions)}). A versão de lá fica guardada para desfazer.`,
                        },
                      ]
                    : []),
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn('flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 transition-colors', choice === option.value ? 'border-gray-900 bg-gray-50' : 'hover:bg-gray-50')}
                >
                  <input type="radio" name="existing" className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900" checked={choice === option.value} onChange={() => setChoice(option.value)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            {free ? 'Salva o componente como modelo na Biblioteca do Elementor do site.' : `Cria o modelo de ${noun} no Theme Builder do site, publicado.`}
          </p>
        )}

        {summary && (
          <div className="grid gap-1 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
            {free ? (
              <p>
                <span className="font-medium text-gray-900">Onde aparece:</span> nas páginas do site que usam o componente (pelo widget Modelo).
              </p>
            ) : (
              <p>
                <span className="font-medium text-gray-900">Onde aparece:</span> no site inteiro
                {summary.excluded.length ? `, menos ${summary.excluded.join(', ')}` : ''}.
                {summary.pending.length > 0 && ` ${summary.pending.join(', ')} ${summary.pending.length === 1 ? 'fica' : 'ficam'} de fora quando ${summary.pending.length === 1 ? 'for publicada' : 'forem publicadas'}.`}
              </p>
            )}
            <p>
              {plural(summary.sectionCount, 'seção', 'seções')}
              {summary.images > 0 && ` · ${plural(summary.images, 'imagem nova vai', 'imagens novas vão')} para a mídia do site`}
              {` · no canvas, em ${plural(shownIn.length, 'página', 'páginas')}`}
            </p>
          </div>
        )}

        <p className="flex gap-2 text-xs text-amber-800">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {free
            ? 'Muda na hora todas as páginas do site que já usam este componente.'
            : `Muda o ${noun} de todas as páginas do site na hora, inclusive as que não foram feitas aqui.`}
        </p>

        {link && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {backups > 0 && (
              <button type="button" onClick={undo} className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Desfazer a última atualização
              </button>
            )}
            <button type="button" onClick={unlink} className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Desligar do WordPress
            </button>
          </p>
        )}

        {phase.kind === 'error' && (
          <p className="flex gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {phase.message}
          </p>
        )}
      </div>
    )
    footer = (
      <>
        <Button variant="ghost" onClick={back}>
          {returnName ? closeLabel : 'Cancelar'}
        </Button>
        <Button onClick={() => run()} disabled={!summary?.sectionCount}>
          {link || (active.length === 1 && choice === 'update') ? `Atualizar o ${noun} no site` : `Publicar o ${noun}`}
        </Button>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: PART_COLOR }}>
            <Component className="h-3.5 w-3.5" />
          </span>
          {phase.kind === 'done' ? `${part.name} publicado` : `${link ? 'Atualizar' : 'Publicar'} o ${noun} no site`}
        </DialogTitle>
        <DialogDescription>
          {connection
            ? free
              ? `O componente vira um modelo salvo do Elementor em ${connection.site.name}; as páginas o mostram pelo widget Modelo do Elementor Pro, então mudar aqui e publicar muda todas.`
              : `O ${noun} vira um modelo do Theme Builder do Elementor Pro em ${connection.site.name}: um só, em todas as páginas do site, como no canvas.`
            : 'Componente do site'}
        </DialogDescription>
      </DialogHeader>
      {body}
      {footer && <DialogFooter className="gap-2 sm:space-x-0">{footer}</DialogFooter>}
    </>
  )
}
