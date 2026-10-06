import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminUrl,
  authorizationUrl,
  canReturnHere,
  completeConnection,
  disconnectWordPress,
  listenConnections,
  profileUrl,
  refreshConnection,
} from './connect'
import { discoverSite, siteCandidates, unsupportedReason, type WordPressSite } from './rest'
import { SiteIconPanel } from './SiteIconPanel'
import type { WordPressConnection } from './types'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const ROLES: Record<string, string> = {
  administrator: 'Administrador',
  editor: 'Editor',
  author: 'Autor',
  contributor: 'Colaborador',
  subscriber: 'Assinante',
}

// "a, b e c"
const joinList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}` : items[0] ?? '')
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * A tela de aprovação abre numa janela à parte, sem sair do projeto. Precisa
 * abrir já no clique (depois de um `await` o navegador bloqueia) e só então
 * receber o endereço do WordPress.
 */
function openApprovalWindow(): Window | null {
  const width = 560
  const height = 720
  const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - width) / 2))
  const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - height) / 3))
  const popup = window.open('', 'superelements-wordpress', `popup=yes,width=${width},height=${height},left=${left},top=${top}`)
  try {
    if (popup && popup.location.href === 'about:blank') {
      popup.document.title = 'WordPress'
      popup.document.body.innerHTML = '<p style="font:14px system-ui,sans-serif;color:#6b7280;padding:24px">Abrindo o WordPress…</p>'
    }
  } catch {
    // Janela de uma tentativa anterior, já no WordPress: só recebe o endereço novo
  }
  return popup
}

const SiteIcon: React.FC<{ site: WordPressSite }> = ({ site }) => {
  const [failed, setFailed] = useState(false)
  if (site.iconUrl && !failed) {
    return <img src={site.iconUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" onError={() => setFailed(true)} />
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500" aria-hidden>
      <Globe className="h-4 w-4" />
    </span>
  )
}

const elementorLabel = (site: WordPressSite) => (site.elementorPro ? 'Ativo, com Pro' : site.elementor ? 'Ativo' : 'Não encontrado')

type Check =
  | { status: 'idle' }
  | { status: 'checking'; address: string }
  | { status: 'found'; address: string; site: WordPressSite }
  | { status: 'error'; address: string; message: string }

const SiteCheck: React.FC<{ check: Check }> = ({ check }) => {
  let content: React.ReactNode
  if (check.status === 'idle') {
    content = <span className="text-muted-foreground">Pode colar o endereço do painel também, como cliente.com.br/wp-admin.</span>
  } else if (check.status === 'checking') {
    content = (
      <span className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Procurando o WordPress…
      </span>
    )
  } else if (check.status === 'error') {
    content = (
      <span className="flex gap-2 text-destructive">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {check.message}
      </span>
    )
  } else {
    const reason = unsupportedReason(check.site)
    content = reason ? (
      <span className="flex gap-2 text-amber-700">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {reason}
      </span>
    ) : (
      <span className="flex items-center gap-2.5">
        <SiteIcon key={check.site.iconUrl} site={check.site} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-900">{check.site.name}</span>
          <span className="block truncate text-muted-foreground">
            {hostOf(check.site.siteUrl)}
            {check.site.restricted ? ' · API fechada para visitantes' : ` · Elementor: ${elementorLabel(check.site).toLowerCase()}`}
          </span>
        </span>
      </span>
    )
  }
  return (
    <div className="min-h-8 text-xs leading-5" aria-live="polite">
      {content}
    </div>
  )
}

const ConnectedView: React.FC<{
  projectId: string
  connection: WordPressConnection
  reload: () => Promise<void>
  onClose: () => void
  onEditIcon: () => void
}> = ({ projectId, connection, reload, onClose, onEditIcon }) => {
  const { site, user, can } = connection
  const host = hostOf(site.siteUrl)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const recheck = async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await refreshConnection(projectId, connection)
      await reload()
    } catch (error) {
      setRefreshError(errorText(error))
    } finally {
      setRefreshing(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    const revoked = await disconnectWordPress(projectId).catch(() => false)
    await reload()
    if (revoked) {
      toast.success('WordPress desconectado', { description: `A senha foi revogada em ${host}.` })
    } else {
      toast.warning('Conexão apagada daqui, mas o site não confirmou a revogação', {
        description: 'Apague a senha "Superelements" no perfil do usuário no WordPress.',
        action: { label: 'Abrir perfil', onClick: () => window.open(profileUrl(site), '_blank', 'noopener') },
      })
    }
  }

  const missing = [!can.editPages && 'editar páginas', !can.publishPages && 'publicar páginas', !can.uploadFiles && 'enviar mídia'].filter(
    (item): item is string => !!item
  )
  const role = user.roles.map((r) => ROLES[r] ?? r)[0]

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>WordPress conectado</DialogTitle>
        <DialogDescription>Este projeto está ligado ao site do cliente.</DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <SiteIcon key={site.iconUrl} site={site} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{site.name}</p>
            <a href={site.siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-gray-900 hover:underline">
              {host}
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 px-4 py-3 text-sm">
          <dt className="text-muted-foreground">Ícone</dt>
          <dd className="flex items-center gap-2">
            {site.iconUrl ? <img src={site.iconUrl} alt="Ícone do site" className="h-5 w-5 rounded-sm" /> : <span className="text-muted-foreground">Nenhum</span>}
            <button
              type="button"
              onClick={onEditIcon}
              className="rounded text-xs text-gray-500 underline-offset-2 transition-colors hover:text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Trocar ícone
            </button>
          </dd>
          <dt className="text-muted-foreground">Usuário</dt>
          <dd className="min-w-0 truncate">{role ? `${user.name} · ${role}` : user.name}</dd>
          <dt className="text-muted-foreground">Elementor</dt>
          <dd>{elementorLabel(site)}</dd>
          <dt className="text-muted-foreground">Permissões</dt>
          <dd className={missing.length ? 'text-amber-700' : undefined}>
            {missing.length ? `Sem permissão para ${joinList(missing)}` : 'Edita e publica páginas, envia mídia'}
          </dd>
          {can.unfilteredHtml === false && (
            <>
              <dt className="text-muted-foreground">HTML</dt>
              <dd className="text-amber-700">Filtrado ao gravar: scripts de widgets HTML saem da página</dd>
            </>
          )}
          <dt className="text-muted-foreground">Conferido</dt>
          <dd className="flex flex-wrap items-center gap-x-2">
            {dateFormat.format(connection.checkedAt)}
            <button
              type="button"
              onClick={recheck}
              disabled={refreshing}
              className="rounded text-xs text-gray-500 underline-offset-2 transition-colors hover:text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {refreshing ? 'Conferindo…' : 'Conferir de novo'}
            </button>
          </dd>
        </dl>
      </div>

      {refreshError && <p className="text-sm text-destructive">{refreshError}</p>}

      <p className="text-xs text-muted-foreground">
        A senha de aplicação fica guardada no projeto, na sua conta. Desconectar apaga a senha daqui e do WordPress.
      </p>

      {confirming ? (
        <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>Desconectar {host}? Para voltar, será preciso aprovar o acesso de novo no WordPress.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={disconnecting}>
              Cancelar
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={disconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="animate-spin" aria-hidden />}
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
            Desconectar
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <a href={adminUrl(site)} target="_blank" rel="noopener noreferrer">
                Painel do WordPress
                <ExternalLink aria-hidden />
              </a>
            </Button>
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      )}
    </div>
  )
}

type Step = 'address' | 'waiting' | 'paste'

interface Approval {
  site: WordPressSite
  /** Tela de aprovação com retorno para a plataforma (janela à parte). */
  href: string
  /** A mesma tela sem retorno: o WordPress mostra a senha para copiar. */
  manualHref: string
}

interface WordPressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  connection: WordPressConnection | null
  reload: () => Promise<void>
}

/** Liga o projeto ao WordPress do cliente, mostra a conexão e desconecta. */
export const WordPressDialog: React.FC<WordPressDialogProps> = ({ open, onOpenChange, projectId, projectName, connection, reload }) => {
  const [step, setStep] = useState<Step>('address')
  const [address, setAddress] = useState('')
  const [check, setCheck] = useState<Check>({ status: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const [approval, setApproval] = useState<Approval | null>(null)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const checkSeq = useRef(0)
  // Conectado: o resumo da conexão, ou a troca do ícone do site no lugar dele
  const [editingIcon, setEditingIcon] = useState(false)

  useEffect(() => {
    if (!open) return
    setEditingIcon(false)
    setStep('address')
    setNotice(null)
    setPasteError(null)
    setPassword('')
  }, [open])

  const runCheck = useCallback(async (text: string) => {
    const id = ++checkSeq.current
    setCheck({ status: 'checking', address: text })
    try {
      const site = await discoverSite(text)
      if (id === checkSeq.current) setCheck({ status: 'found', address: text, site })
      return site
    } catch (error) {
      if (id === checkSeq.current) setCheck({ status: 'error', address: text, message: errorText(error) })
      throw error
    }
  }, [])

  // Procura o site enquanto a pessoa digita, para o clique em Conectar já abrir a aprovação
  useEffect(() => {
    if (!open || connection || step !== 'address') return
    const text = address.trim()
    if (!siteCandidates(text).length) {
      checkSeq.current++
      setCheck({ status: 'idle' })
      return
    }
    const timer = setTimeout(() => runCheck(text).catch(() => {}), 600)
    return () => clearTimeout(timer)
  }, [address, open, connection, step, runCheck])

  // A janela de aprovação avisa pelo canal; a conexão em si chega pelo hook
  useEffect(() => {
    if (!open) return
    return listenConnections((message) => {
      if (message.projectId !== projectId) return
      if (message.type === 'connected' && step === 'waiting') {
        setStep('address')
        toast.success('WordPress conectado')
      } else if (message.type === 'rejected') {
        setStep('address')
        setNotice('O acesso foi recusado na tela do WordPress.')
      } else if (message.type === 'failed') {
        setStep('address')
        setNotice(message.error)
      }
    })
  }, [open, projectId, step])

  const connect = async () => {
    const text = address.trim()
    if (!text) return
    setNotice(null)
    const popup = openApprovalWindow()

    let site = check.status === 'found' && check.address === text ? check.site : null
    if (!site) {
      try {
        site = await runCheck(text)
      } catch {
        popup?.close()
        return
      }
    }
    if (unsupportedReason(site)) {
      popup?.close()
      return
    }

    const returnHere = canReturnHere(site)
    const request = { projectId, projectName, site, mode: popup ? 'popup' : 'redirect' } as const
    const next: Approval = {
      site,
      href: authorizationUrl({ ...request, returnHere }),
      manualHref: authorizationUrl({ ...request, returnHere: false }),
    }
    setApproval(next)

    if (popup) {
      popup.location.href = next.href
      popup.focus()
      setStep(returnHere ? 'waiting' : 'paste')
    } else if (returnHere) {
      // Janela bloqueada: a aprovação acontece nesta aba e o retorno traz de volta ao projeto
      window.location.assign(next.href)
    } else {
      setStep('paste')
    }
  }

  const reopen = () => {
    if (!approval) return
    const popup = openApprovalWindow()
    if (popup) {
      popup.location.href = approval.href
      popup.focus()
    }
  }

  const savePasted = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!approval) return
    setSaving(true)
    setPasteError(null)
    try {
      const saved = await completeConnection(projectId, approval.site, login, password)
      await reload()
      setStep('address')
      setPassword('')
      toast.success('WordPress conectado', { description: saved.site.name })
    } catch (error) {
      setPasteError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)
  const siteName = approval?.site.name ?? 'site'

  let body: React.ReactNode
  if (connection && editingIcon) {
    body = <SiteIconPanel projectId={projectId} connection={connection} reload={reload} onBack={() => setEditingIcon(false)} />
  } else if (connection) {
    body = <ConnectedView projectId={projectId} connection={connection} reload={reload} onClose={close} onEditIcon={() => setEditingIcon(true)} />
  } else if (step === 'waiting' && approval) {
    body = (
      <div className="grid gap-5">
        <DialogHeader>
          <DialogTitle>Aprove no WordPress</DialogTitle>
          <DialogDescription>
            A tela de aprovação de {siteName} abriu em outra janela. Entre com o seu usuário, se ela pedir, e aprove a conexão. Esta tela
            atualiza sozinha.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Aguardando a aprovação…
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          A janela não apareceu?{' '}
          <button type="button" onClick={reopen} className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Abrir de novo
          </button>
          . Aprovou e ela não voltou?{' '}
          <button
            type="button"
            onClick={() => setStep('paste')}
            className="rounded underline underline-offset-2 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Colar a senha à mão
          </button>
          .
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setStep('address')}>
            Voltar
          </Button>
        </DialogFooter>
      </div>
    )
  } else if (step === 'paste' && approval) {
    body = (
      <form onSubmit={savePasted} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>Cole a senha do WordPress</DialogTitle>
          <DialogDescription>
            Aprove a conexão na tela do WordPress. Ele mostra uma senha de aplicação: copie e cole aqui, com o seu usuário.
          </DialogDescription>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          A tela não abriu?{' '}
          <a href={approval.manualHref} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 hover:text-gray-900">
            Abrir a tela de aprovação
          </a>
        </p>
        <div className="grid gap-2">
          <Label htmlFor="wp-login">Usuário ou e-mail do WordPress</Label>
          <Input id="wp-login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wp-password">Senha de aplicação</Label>
          <Input
            id="wp-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>
        {!canReturnHere(approval.site) && (
          <p className="text-xs text-muted-foreground">
            Com a plataforma em http, o WordPress não devolve a senha sozinho. No endereço com HTTPS, a conexão volta automática.
          </p>
        )}
        {pasteError && <p className="text-sm text-destructive">{pasteError}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setStep('address')} disabled={saving}>
            Voltar
          </Button>
          <Button type="submit" disabled={saving || !login.trim() || !password.trim()}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {saving ? 'Conferindo…' : 'Salvar conexão'}
          </Button>
        </DialogFooter>
      </form>
    )
  } else {
    const blocked = check.status === 'found' && check.address === address.trim() && !!unsupportedReason(check.site)
    body = (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          connect()
        }}
        className="grid gap-5"
      >
        <DialogHeader>
          <DialogTitle>Conectar WordPress</DialogTitle>
          <DialogDescription>
            Liga este projeto ao site do cliente. Você entra no próprio WordPress e aprova o acesso; a senha de login não passa pela
            plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="wp-address">Endereço do site</Label>
          <Input
            id="wp-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="cliente.com.br"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <SiteCheck check={check} />
        </div>
        {notice && <p className="text-sm text-destructive">{notice}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!address.trim() || blocked}>
            Conectar
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={connection && editingIcon ? 'max-h-[92vh] max-w-2xl overflow-y-auto' : 'max-w-md'}>{body}</DialogContent>
    </Dialog>
  )
}
