import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { openingText } from '@/features/crm/call'
import { personLabel } from '@/features/crm/people'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { WhatsAppInbox } from '@/features/crm/WhatsAppInbox'
import { canManage } from '@/features/crm/types'
import { Page, PageHeader, Surface, dayLabel } from '@/features/crm/ui'
import { cn } from '@/lib/utils'
import {
  SERVICE_SILENT_MS,
  WhatsAppError,
  connectWhatsApp,
  disconnectWhatsApp,
  formatPhone,
  loadNumber,
  serviceMissed,
  useNumberFeed,
  type WaNumber,
} from '@/features/crm/whatsapp'

/**
 * WhatsApp (CRM › WhatsApp), por enquanto só a conexão: o gestor clica em
 * Conectar, o QR code aparece aqui (ao vivo, ele troca sozinho), o celular da
 * empresa lê em Aparelhos conectados e a tela passa a mostrar o número
 * conectado. Quem conecta é o nosso serviço `services/whatsapp`, que precisa
 * estar rodando; a tela avisa quando ele não responde.
 */

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const timeLabel = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function CrmWhatsApp() {
  const team = useCrm((s) => s.team)
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // "Chamar" em outra tela: o número, o nome e o cliente chegam pelo endereço
  const call = useMemo(() => {
    const phone = params.get('numero')
    if (!phone) return undefined
    return {
      phone,
      name: params.get('nome') ?? undefined,
      clientId: params.get('cliente') ?? undefined,
      opportunityId: params.get('oportunidade') ?? undefined,
      text: params.get('texto') ?? openingText(personLabel(user?.email)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const manager = canManage(team?.role)
  // undefined: lendo; null: nunca conectado
  const [number, setNumber] = useState<WaNumber | null>()
  const [failure, setFailure] = useState<WhatsAppError>()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    if (!team) return
    try {
      setNumber((await loadNumber(team.id)) ?? null)
      setFailure(undefined)
    } catch (error) {
      setFailure(error instanceof WhatsAppError ? error : new WhatsAppError(errorText(error)))
    }
  }, [team])

  useEffect(() => {
    setNumber(undefined)
    void load()
  }, [load])

  useNumberFeed(team?.id, setNumber)

  // Relê sozinha (sem a Realtime também funciona): rápido enquanto espera o QR code ou o celular
  const waiting = !!number?.wanted && number.status !== 'connected'
  useEffect(() => {
    const timer = setInterval(
      () => {
        setNow(Date.now())
        if (document.visibilityState === 'visible') void load()
      },
      waiting ? 2500 : 30_000
    )
    return () => clearInterval(timer)
  }, [waiting, load])

  const act = async (fn: typeof connectWhatsApp) => {
    if (!team) return
    setBusy(true)
    setAsking(false)
    try {
      await fn(team.id)
      await load()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  if (!team) return null

  return (
    <Page wide>
      <PageHeader title="WhatsApp" text="O número da empresa conectado ao CRM como mais um aparelho, pelo QR code. Ele continua funcionando no celular." />
      <div className="mt-6 max-w-2xl">
        {failure ? (
          <Surface title={failure.code === 'no_tables' ? 'Falta preparar o WhatsApp' : 'Não deu para ler o WhatsApp'}>
            <p className="text-sm text-gray-600">{failure.message}</p>
            {failure.code === 'no_tables' && <SetupSteps migration />}
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar de novo
            </Button>
          </Surface>
        ) : number === undefined ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Lendo a conexão…
          </p>
        ) : number?.status === 'connected' ? (
          <Connected number={number} now={now} manager={manager} busy={busy} asking={asking} onAsk={setAsking} onDisconnect={() => void act(disconnectWhatsApp)} />
        ) : number?.wanted ? (
          <Pairing number={number} now={now} manager={manager} busy={busy} onCancel={() => void act(disconnectWhatsApp)} />
        ) : (
          <Surface title="Conectar o número">
            {number?.error && (
              <p className="mb-3 flex items-start gap-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                {number.error}
              </p>
            )}
            {manager ? (
              <>
                <p className="text-sm text-gray-600">Tenha à mão o celular com o WhatsApp da empresa: o QR code aparece aqui para ele ler.</p>
                <p className="mt-2 text-xs text-gray-500">A conexão é por Aparelhos conectados, sem a API oficial da Meta. Mensagens em massa ou para quem não espera podem fazer o WhatsApp restringir o número.</p>
                <Button className="mt-4" onClick={() => void act(connectWhatsApp)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
                  Conectar o WhatsApp
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-600">O WhatsApp da equipe não está conectado. Peça a um gestor da equipe para conectar o número.</p>
            )}
          </Surface>
        )}
      </div>
      {call && number && number.status !== 'connected' && (
        <p className="mt-4 max-w-2xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Para chamar {call.name ?? 'esse número'}, o WhatsApp da equipe precisa estar conectado.
        </p>
      )}
      {number && !failure && (number.status === 'connected' || !!number.phone) && (
        <div className="mt-6">
          {number.status !== 'connected' && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              WhatsApp desconectado. Abaixo está o histórico já recebido e enviado; reconecte acima para voltar a enviar.
            </p>
          )}
          <WhatsAppInbox teamId={team.id} offline={number.status !== 'connected'} call={call} onCallDone={() => setParams({}, { replace: true })} />
        </div>
      )}
    </Page>
  )
}

const SetupSteps: React.FC<{ migration?: boolean }> = ({ migration }) => (
  <ol className={cn('mt-3 space-y-2 text-sm text-gray-600', migration && 'list-decimal pl-5')}>
    {migration && (
      <li>
        Aplique a migração <code className="text-xs">20261026150000_crm_whatsapp.sql</code> no Supabase.
      </li>
    )}
    <li>
      Deixe o serviço <code className="text-xs">services/whatsapp</code> rodando num servidor ligado o tempo todo (a imagem Docker da pasta, com <code className="text-xs">SUPABASE_URL</code> e{' '}
      <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>). Para testar, <code className="text-xs">npm run whatsapp</code> neste computador.
    </li>
  </ol>
)

const Pairing: React.FC<{ number: WaNumber; now: number; manager: boolean; busy: boolean; onCancel: () => void }> = ({ number, now, manager, busy, onCancel }) => {
  const cancel = manager && (
    <Button variant="outline" size="sm" className="mt-4" onClick={onCancel} disabled={busy}>
      Cancelar
    </Button>
  )

  if (number.qr)
    return (
      <Surface title="Leia o QR code com o celular">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <img src={number.qr} alt="QR code para conectar o WhatsApp" width={240} height={240} className="h-60 w-60 shrink-0 rounded-lg bg-white p-2 ring-1 ring-gray-200" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900">No celular com o WhatsApp da empresa:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Abra o WhatsApp e toque em Configurações (ou nos três pontos).</li>
              <li>Toque em Aparelhos conectados › Conectar um aparelho.</li>
              <li>Aponte a câmera para este código.</li>
            </ol>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Esperando o celular ler. O código se renova sozinho por cerca de 2 minutos.
            </p>
            {cancel}
          </div>
        </div>
      </Surface>
    )

  if (serviceMissed(number, now))
    return (
      <Surface title="O serviço do WhatsApp não respondeu">
        <p className="text-sm text-gray-600">Quem gera o QR code e mantém o número conectado é o nosso serviço, que roda fora do app. Ele não está ligado.</p>
        <SetupSteps />
        {cancel}
      </Surface>
    )

  return (
    <Surface title={number.phone ? 'Reconectando o número' : 'Gerando o QR code'}>
      <p className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {number.phone ? `A conexão de ${formatPhone(number.phone)} caiu. O serviço está conectando de novo.` : 'Só um instante…'}
      </p>
      {cancel}
    </Surface>
  )
}

const Connected: React.FC<{
  number: WaNumber
  now: number
  manager: boolean
  busy: boolean
  asking: boolean
  onAsk: (asking: boolean) => void
  onDisconnect: () => void
}> = ({ number, now, manager, busy, asking, onAsk, onDisconnect }) => {
  const leaving = !number.wanted
  const silent = !leaving && number.seenAt !== undefined && now - number.seenAt > SERVICE_SILENT_MS
  return (
    <Surface title="Conectado">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden>
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{formatPhone(number.phone) ?? 'Número conectado'}</p>
          <p className="truncate text-xs text-gray-500">
            {[number.profileName, number.connectedAt && `desde ${dayLabel(number.connectedAt)}, ${timeLabel(number.connectedAt)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {silent && number.seenAt && (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />O serviço do WhatsApp não responde desde as {timeLabel(number.seenAt)}. O número volta sozinho quando o serviço voltar.
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">No celular ele aparece em Aparelhos conectados como “Avence CRM”.</p>
      {manager &&
        (leaving ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Desconectando…
          </p>
        ) : asking ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="destructive" size="sm" onClick={onDisconnect} disabled={busy}>
              Desconectar o número
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAsk(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => onAsk(true)}>
            Desconectar
          </Button>
        ))}
    </Surface>
  )
}
