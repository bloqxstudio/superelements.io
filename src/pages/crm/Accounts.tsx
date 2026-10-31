import React, { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ExternalLink, Loader2, LogIn, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from '@/features/crm/crmStore'
import { ModuleToggles } from '@/features/crm/ModuleToggles'
import { MODULES, type ModuleId } from '@/features/crm/modules'
import { deleteAccount, listAccounts, setAccountModules, setAccountStatus, supportAccess } from '@/features/crm/teams'
import type { AccountOverview } from '@/features/crm/types'
import { Page, PageHeader, Surface, dayLabel, plural } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

/**
 * Painel das contas da plataforma (só o admin da Avence): todas as empresas-cliente,
 * quem tem o quê ligado, pausar e reativar, e entrar numa conta para dar suporte.
 */

const AccountCard: React.FC<{ account: AccountOverview; current: boolean; onChanged: () => void; onEnter: (account: AccountOverview) => void }> = ({ account, current, onChanged, onEnter }) => {
  const [busy, setBusy] = useState<ModuleId | 'status' | null>(null)
  const [modules, setModules] = useState(account.modules)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const paused = account.status === 'pausada'

  useEffect(() => setModules(account.modules), [account.modules])

  const toggle = async (id: ModuleId, on: boolean) => {
    setBusy(id)
    const before = modules
    setModules({ ...modules, [id]: on })
    try {
      setModules(await setAccountModules(account.id, { [id]: on }))
      onChanged()
    } catch (error) {
      setModules(before)
      toast.error('Não foi possível mudar o módulo', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const togglePause = async () => {
    setBusy('status')
    try {
      await setAccountStatus(account.id, paused ? 'ativa' : 'pausada')
      toast.success(paused ? `${account.name} reativada` : `${account.name} pausada`, { description: paused ? undefined : 'Os módulos ficam desligados até reativar.' })
      onChanged()
    } catch (error) {
      toast.error('Não foi possível mudar a conta', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('status')
    try {
      await deleteAccount(account.id)
      toast.success(`${account.name} excluída`)
      setConfirming(false)
      onChanged()
    } catch (error) {
      toast.error('Não foi possível excluir a conta', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const on = MODULES.filter((m) => modules[m.id] !== false).length

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{account.name}</h2>
            {account.isHome && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-white">Conta da casa</span>}
            {paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Pausada</span>}
            {current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Aberta agora</span>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {[account.segment, plural(account.members, 'pessoa', 'pessoas'), `criada em ${dayLabel(account.createdAt)}`].filter(Boolean).join(' · ')}
          </p>
          {(account.contactName || account.contactEmail || account.contactPhone || account.website) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-gray-600">
              {account.contactName && <span>{account.contactName}</span>}
              {account.contactEmail && <span>{account.contactEmail}</span>}
              {account.contactPhone && <span>{account.contactPhone}</span>}
              {account.website && (
                <a href={/^https?:/.test(account.website) ? account.website : `https://${account.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  {account.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onEnter(account)} disabled={current}>
            <LogIn className="h-3.5 w-3.5" aria-hidden /> {account.iAmMember ? 'Abrir' : 'Entrar para suporte'}
          </Button>
          {!account.isHome && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void togglePause()} disabled={busy === 'status'}>
              {busy === 'status' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
              {paused ? 'Reativar' : 'Pausar'}
            </Button>
          )}
          {!account.isHome && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-red-600 hover:text-red-700" onClick={() => { setTyped(''); setConfirming(true) }} disabled={busy === 'status'}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
            </Button>
          )}
        </div>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {account.name}?</DialogTitle>
            <DialogDescription>
              Apaga a conta, os projetos dela e todos os dados do CRM, Instagram, WhatsApp e site. Não dá para desfazer. Digite o nome da conta para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={account.name} aria-label="Nome da conta para confirmar" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={typed.trim() !== account.name.trim() || busy === 'status'} onClick={() => void remove()}>
              {busy === 'status' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />} Excluir conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className={cn('mt-4', paused && 'opacity-60')}>
        <p className="mb-2 text-xs font-medium text-gray-700">
          Módulos: {on} de {MODULES.length} ligados {paused && '(a conta pausada fica sem nenhum)'}
        </p>
        <ModuleToggles value={modules} onChange={(id, next) => void toggle(id, next)} busyId={busy === 'status' ? null : busy} />
      </div>
    </Surface>
  )
}

const Accounts: React.FC = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { team, load, select } = useCrm()
  const [accounts, setAccounts] = useState<AccountOverview[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setAccounts(await listAccounts())
      setError(null)
      // O menu e as guardas leem as contas do store: mantém igual
      if (user) void load(user.id, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao ler as contas')
    }
  }, [user, load])

  useEffect(() => {
    if (profile?.role === 'admin') void reload()
  }, [profile?.role, reload])

  const enter = async (account: AccountOverview) => {
    try {
      if (!account.iAmMember) {
        await supportAccess(account.id)
        if (user) await load(user.id, true)
      }
      await select(account.id)
      toast.success(`Conta ${account.name} aberta`)
      navigate('/')
    } catch (e) {
      toast.error('Não foi possível abrir a conta', { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />

  return (
    <Page>
      <PageHeader title="Contas" text="As empresas-cliente do produto. Cada conta tem o ambiente separado; aqui você liga e desliga os módulos de cada uma.">
        <Button onClick={() => navigate('/contas/nova')} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden /> Nova conta
        </Button>
      </PageHeader>

      <div className="mt-6 grid gap-4">
        {accounts === null && !error && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo as contas
          </p>
        )}
        {error && (
          <Surface>
            <p className="text-sm text-gray-700">
              {error.includes('crm_accounts_overview') || error.includes('PGRST202')
                ? 'Falta aplicar a migração 20261027160000_crm_accounts_modules.sql no Supabase (SQL Editor).'
                : error}
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void reload()}>
              Tentar de novo
            </Button>
          </Surface>
        )}
        {accounts?.map((account) => (
          <AccountCard key={account.id} account={account} current={team?.id === account.id} onChanged={() => void reload()} onEnter={(a) => void enter(a)} />
        ))}
        {accounts?.length === 0 && <p className="text-sm text-gray-500">Nenhuma conta ainda. Crie a primeira.</p>}
      </div>
    </Page>
  )
}

export default Accounts
