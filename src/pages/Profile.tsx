import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, ShieldCheck, Trash2, UserRound, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useCrm } from '@/features/crm/crmStore'
import { ROLE_HINT, ROLE_LABEL } from '@/features/crm/types'
import { FIELD, Page, PageHeader, Surface, dayLabel } from '@/features/crm/ui'
import { PersonAvatar } from '@/features/profile/PersonAvatar'
import { AVATAR_MIN_SIDE, NAME_MAX, PASSWORD_MIN, authErrorText, openAvatarImage, passwordProblem, removeAvatar, updateProfile, uploadAvatar, type AvatarCrop } from '@/features/profile/profile'
import { AvatarCropDialog } from '@/features/profile/AvatarCropDialog'
import { cn } from '@/lib/utils'

/**
 * Meu perfil (2026-10-31): quem a pessoa é para a equipe (nome, foto, telefone)
 * e como ela entra (e-mail, senha, Google), mais as contas em que está e as sessões.
 */

const PLATFORM_ROLE: Record<string, string> = { admin: 'Admin da plataforma', pro: 'Pro', free: 'Conta pessoal' }

const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="grid gap-1.5">
    <span className="text-xs font-medium text-gray-700">{label}</span>
    {children}
    {hint && <span className="text-xs text-gray-500">{hint}</span>}
  </label>
)

const SectionIntro: React.FC<{ icon: React.ElementType; title: string; text: React.ReactNode }> = ({ icon: Icon, title, text }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700" aria-hidden>
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{text}</p>
    </div>
  </div>
)

/** Cada bloco: o título à esquerda no computador, o formulário à direita. */
const Block: React.FC<{ intro: React.ReactNode; children: React.ReactNode; id?: string }> = ({ intro, children, id }) => (
  <Surface className="grid gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
    <div id={id}>{intro}</div>
    <div className="min-w-0">{children}</div>
  </Surface>
)

const PasswordInput: React.FC<{ value: string; onChange: (v: string) => void; autoComplete: string; id?: string }> = ({ value, onChange, autoComplete, id }) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={cn(FIELD, 'h-10 pr-10')} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-900">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

/* ── Foto e nome ─────────────────────────────────────────────── */

const IdentityCard: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove'>()
  const [framing, setFraming] = useState<ImageBitmap | null>(null)
  if (!user || !profile) return null

  // Escolheu um arquivo: abre o enquadramento (ou explica por que não serve)
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!file) return
    try {
      setFraming(await openAvatarImage(file))
    } catch (error) {
      toast.error('Essa foto não serve', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const closeFraming = () => {
    framing?.close()
    setFraming(null)
  }

  const save = async (crop: AvatarCrop) => {
    if (!framing) return
    setBusy('upload')
    try {
      await uploadAvatar(user.id, framing, crop, profile.avatarPath)
      await refreshProfile()
      closeFraming()
      toast.success('Foto atualizada')
    } catch (error) {
      toast.error('Não deu para trocar a foto', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async () => {
    setBusy('remove')
    try {
      await removeAvatar(user.id, profile.avatarPath)
      await refreshProfile()
      toast.success('Foto removida')
    } catch (error) {
      toast.error('Não deu para remover a foto', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <Surface className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative w-fit">
        <PersonAvatar name={profile.name} url={profile.avatarUrl} size={88} className="text-2xl ring-4 ring-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={!!busy}
          aria-label="Trocar foto"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-800 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_2px_6px_rgb(0_0_0/0.12)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
        >
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-gray-900">{profile.name}</p>
        <p className="truncate text-sm text-gray-500">{user.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
          <span className="rounded-full bg-gray-100 px-2 py-0.5">{PLATFORM_ROLE[profile.role] ?? 'Conta pessoal'}</span>
          {profile.createdAt && <span className="rounded-full bg-gray-100 px-2 py-0.5">Desde {dayLabel(profile.createdAt)}</span>}
        </div>
        <p className="mt-2 text-xs text-gray-500">Use uma foto nítida do rosto, de pelo menos {AVATAR_MIN_SIDE} px.</p>
      </div>
      <AvatarCropDialog image={framing} saving={busy === 'upload'} onCancel={closeFraming} onSave={(crop) => void save(crop)} />
      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!!busy} onClick={() => input.current?.click()}>
          <Camera className="h-3.5 w-3.5" />
          {profile.avatarUrl ? 'Trocar foto' : 'Pôr uma foto'}
        </Button>
        {profile.avatarUrl && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-gray-600" disabled={!!busy} onClick={() => void remove()}>
            {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remover
          </Button>
        )}
      </div>
    </Surface>
  )
}

/* ── Dados pessoais ──────────────────────────────────────────── */

const PersonalForm: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.fullName ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setName(profile?.fullName ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile?.fullName, profile?.phone])
  if (!user || !profile) return null

  const dirty = name.trim() !== (profile.fullName ?? '') || phone.trim() !== (profile.phone ?? '')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (phone.trim() && (digits.length < 10 || digits.length > 13)) {
      toast.error('Confira o telefone', { description: 'Com DDD, como (51) 99999-0000.' })
      return
    }
    setSaving(true)
    try {
      await updateProfile(user.id, { full_name: name.trim() || null, phone: phone.trim() || null })
      await refreshProfile()
      toast.success('Dados salvos')
    } catch (error) {
      toast.error('Não deu para salvar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Block intro={<SectionIntro icon={UserRound} title="Dados pessoais" text="Como a equipe vê você: no menu, nos cartões do funil, nos comentários e na assinatura das mensagens." />}>
      <form onSubmit={(e) => void submit(e)} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" hint={name.trim() ? undefined : `Sem nome, mostramos “${profile.name}”, tirado do e-mail.`}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" placeholder="Seu nome e sobrenome" className={cn(FIELD, 'h-10')} />
          </Field>
          <Field label="Telefone (WhatsApp)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="(51) 99999-0000" className={cn(FIELD, 'h-10')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!dirty || saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar dados
          </Button>
        </div>
      </form>
    </Block>
  )
}

/* ── E-mail de acesso ────────────────────────────────────────── */

const EmailForm: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const synced = useRef<string>()

  // Confirmou um e-mail novo: o perfil passa a mostrar o do login (uma vez por e-mail)
  useEffect(() => {
    if (!user?.email || !profile || profile.email === user.email || synced.current === user.email) return
    synced.current = user.email
    void supabase.rpc('profile_sync_email').then(({ error }) => !error && refreshProfile())
  }, [user?.email, profile, refreshProfile])

  if (!user) return null
  const pending = user.new_email

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = email.trim().toLowerCase()
    if (!next || next === user.email) return
    setSending(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/perfil` })
      if (error) throw error
      await supabase.auth.refreshSession()
      setEmail('')
      toast.success('Confirme pelo e-mail', { description: `Mandamos um link para ${next}. O e-mail só muda depois de confirmar.` })
    } catch (error) {
      toast.error('Não deu para trocar o e-mail', { description: authErrorText((error as Error)?.message) })
    } finally {
      setSending(false)
    }
  }

  return (
    <Block intro={<SectionIntro icon={Mail} title="E-mail de acesso" text="É com ele que você entra e recebe convites. A troca só vale depois de confirmar pelo link." />}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-gray-500">Atual</span>
          <span className="min-w-0 truncate font-medium text-gray-900">{user.email}</span>
          {user.email_confirmed_at && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Confirmado
            </span>
          )}
        </div>
        {pending && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-600/20">
            Esperando a confirmação de <strong>{pending}</strong>. Abra o link que chegou nesse endereço
            {user.email ? ' (e, se pedido, também no atual)' : ''}.
          </p>
        )}
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Novo e-mail">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@empresa.com.br" className={cn(FIELD, 'h-10')} />
          </Field>
          <Button type="submit" size="sm" variant="outline" className="h-10 gap-1.5" disabled={sending || !email.trim() || email.trim().toLowerCase() === user.email}>
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Mandar confirmação
          </Button>
        </form>
      </div>
    </Block>
  )
}

/* ── Senha e formas de entrar ────────────────────────────────── */

const PasswordForm: React.FC = () => {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const providers = useMemo(() => new Set((user?.identities ?? []).map((i) => i.provider)), [user?.identities])
  if (!user) return null

  // Quem só entrou pelo Google ainda não tem senha: cria uma sem pedir a atual
  const hasPassword = providers.has('email')
  const problem = passwordProblem(next, confirm)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem || (hasPassword && !current)) return
    setSaving(true)
    try {
      if (hasPassword) {
        const check = await supabase.auth.signInWithPassword({ email: user.email ?? '', password: current })
        if (check.error) throw check.error
      }
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
      setCurrent('')
      setNext('')
      setConfirm('')
      setTried(false)
      toast.success(hasPassword ? 'Senha trocada' : 'Senha criada', { description: 'Use a nova senha na próxima vez que entrar.' })
    } catch (error) {
      toast.error('Não deu para salvar a senha', { description: authErrorText((error as Error)?.message) })
    } finally {
      setSaving(false)
    }
  }

  const strength = [next.length >= PASSWORD_MIN, /[a-zA-Z]/.test(next) && /\d/.test(next), next.length >= 12, /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length

  return (
    <Block intro={<SectionIntro icon={KeyRound} title="Senha e acesso" text="Troque a senha de vez em quando e nunca use a mesma de outro site." />}>
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset', hasPassword ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' : 'bg-gray-50 text-gray-600 ring-gray-500/20')}>
            <KeyRound className="h-3 w-3" /> {hasPassword ? 'Entra com e-mail e senha' : 'Ainda sem senha'}
          </span>
          {providers.has('google') && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
              <ShieldCheck className="h-3 w-3" /> Google conectado
            </span>
          )}
        </div>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          {/* Para o gerenciador de senhas saber de que conta é */}
          <input type="email" value={user.email ?? ''} autoComplete="username" readOnly hidden />
          {hasPassword && (
            <Field label="Senha atual">
              <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={hasPassword ? 'Nova senha' : 'Senha'} hint={`Pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`}>
              <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
              {next && (
                <span className="mt-1 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn('h-1 flex-1 rounded-full', i < strength ? (strength >= 3 ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-gray-200')} />
                  ))}
                </span>
              )}
            </Field>
            <Field label="Repita a senha">
              <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </Field>
          </div>
          {tried && (problem || (hasPassword && !current)) && (
            <p className="text-xs text-red-600" role="alert">
              {hasPassword && !current ? 'Digite a senha atual.' : problem}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving || !next} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {hasPassword ? 'Trocar senha' : 'Criar senha'}
            </Button>
          </div>
        </form>
      </div>
    </Block>
  )
}

/* ── Contas em que a pessoa está ─────────────────────────────── */

const AccountsList: React.FC = () => {
  const { teams, team, select } = useCrm()
  const navigate = useNavigate()
  if (!teams.length) return null
  return (
    <Block intro={<SectionIntro icon={Building2} title="Suas contas" text="As empresas em que você está e o seu papel em cada uma. Quem gerencia muda o papel em Equipe." />}>
      <ul className="divide-y divide-gray-100">
        {teams.map((t) => {
          const open = t.id === team?.id
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {t.name}
                  {open && <span className="ml-2 rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">Aberta</span>}
                </p>
                <p className="truncate text-xs text-gray-500" title={ROLE_HINT[t.role]}>
                  {ROLE_LABEL[t.role]} · {ROLE_HINT[t.role]}
                </p>
              </div>
              {!open && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void select(t.id).then(() => navigate('/inicio'))
                  }}
                >
                  Abrir
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Block>
  )
}

/* ── Sessões ─────────────────────────────────────────────────── */

const Sessions: React.FC = () => {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const everywhere = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      toast.success('Você saiu de todos os aparelhos')
    } catch (error) {
      toast.error('Não deu para sair de todos', { description: authErrorText((error as Error)?.message) })
    } finally {
      await signOut()
      setBusy(false)
    }
  }
  return (
    <Block intro={<SectionIntro icon={LogOut} title="Sessões" text="Usou um computador emprestado ou perdeu o celular? Saia de todos os aparelhos de uma vez." />}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void signOut()}>
          <LogOut className="h-3.5 w-3.5" /> Sair deste aparelho
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={busy} onClick={() => void everywhere()}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Sair de todos os aparelhos
        </Button>
      </div>
    </Block>
  )
}

const Profile: React.FC = () => {
  const { profile } = useAuth()
  return (
    <Page>
      <div className="mx-auto grid max-w-4xl gap-5">
        <PageHeader title="Meu perfil" text="Seus dados, como você entra e as contas em que está." />
        {!profile ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
          </p>
        ) : (
          <>
            <IdentityCard />
            <PersonalForm />
            <EmailForm />
            <PasswordForm />
            <AccountsList />
            <Sessions />
          </>
        )}
      </div>
    </Page>
  )
}

export default Profile
