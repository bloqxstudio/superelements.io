import React, { useEffect, useState } from 'react'
import { CircleAlert, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCrm } from './crmStore'
import { importLegacy, legacyCounts } from './importLegacy'
import { createTeam } from './teams'

/**
 * As telas do CRM e da Prospecção abrem para quem é de uma equipe. O admin da
 * plataforma sem equipe cria a primeira (e traz o que já existia); quem não é
 * de nenhuma vê como pedir acesso.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const Box: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
    <div className="mx-auto max-w-lg px-4 py-16 md:px-6">{children}</div>
  </div>
)

const Card: React.FC<{ icon?: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon = Users, title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-gray-600" aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
    <h1 className="mt-4 text-lg font-semibold tracking-tight text-gray-900">{title}</h1>
    {children}
  </div>
)

const TeamSetup: React.FC = () => {
  const { user } = useAuth()
  const load = useCrm((s) => s.load)
  const [name, setName] = useState('Avence Studio')
  const [bring, setBring] = useState(true)
  const [counts, setCounts] = useState<{ funnel: number; leads: number; searches: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    legacyCounts().then(setCounts).catch(() => setCounts({ funnel: 0, leads: 0, searches: 0 }))
  }, [])

  const anything = !!counts && counts.funnel + counts.leads + counts.searches > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return
    setBusy('Criando a equipe')
    try {
      const teamId = await createTeam(name)
      if (bring && anything) {
        setBusy('Trazendo o funil, as buscas e o Comercial antigo')
        try {
          const result = await importLegacy(teamId)
          toast.success(`Equipe ${name.trim()} criada`, {
            description: `${plural(result.clients, 'cliente', 'clientes')}, ${plural(result.opportunities, 'oportunidade', 'oportunidades')} e ${plural(result.searches, 'busca', 'buscas')} trazidos.`,
          })
        } catch (error) {
          console.error('[crm] falha ao trazer os dados antigos', error)
          toast.error('A equipe foi criada, mas os dados antigos não vieram todos', {
            description: 'Tente de novo em Equipe › Trazer dados de antes do CRM. O que já entrou não se repete.',
          })
        }
      } else {
        toast.success(`Equipe ${name.trim()} criada`)
      }
      await load(user.id, true)
    } catch (error) {
      toast.error('Não foi possível criar a equipe', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Box>
      <Card title="Crie a equipe do CRM">
        <p className="mt-2 text-sm text-gray-600">
          A equipe é a empresa que vende. Os clientes, as oportunidades e as buscas da Prospecção ficam com ela, e você dá acesso aos vendedores por convite.
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-gray-700">Nome da empresa</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </label>
          {counts === null ? (
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Vendo o que já existe
            </p>
          ) : (
            anything && (
              <label className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-zinc-50 p-3 text-sm text-gray-700">
                <input type="checkbox" checked={bring} onChange={(e) => setBring(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                <span>
                  Trazer o que já existe:{' '}
                  {[
                    counts.funnel && plural(counts.funnel, 'cartão do funil da Prospecção', 'cartões do funil da Prospecção'),
                    counts.searches && plural(counts.searches, 'busca salva', 'buscas salvas'),
                    counts.leads && plural(counts.leads, 'lead do Comercial antigo', 'leads do Comercial antigo'),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  .
                </span>
              </label>
            )
          )}
          <Button type="submit" disabled={!!busy || !name.trim()} className="h-10 gap-2">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {busy}…
              </>
            ) : (
              'Criar a equipe'
            )}
          </Button>
        </form>
      </Card>
    </Box>
  )
}

export const CrmGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth()
  const { status, error, team, load } = useCrm()

  useEffect(() => {
    if (user) void load(user.id)
  }, [user, load])

  if (status === 'idle' || status === 'loading') {
    return (
      <Box>
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o CRM
        </p>
      </Box>
    )
  }

  if (status === 'error') {
    return (
      <Box>
        <Card icon={CircleAlert} title={error === 'sem-banco' ? 'O CRM ainda não está no banco' : 'Não foi possível abrir o CRM'}>
          <p className="mt-2 text-sm text-gray-600">
            {error === 'sem-banco'
              ? 'Falta aplicar a migração 20261013150000_crm.sql no Supabase (SQL Editor). Os dados da Prospecção continuam guardados e entram no CRM quando a equipe for criada.'
              : 'Confira a internet e tente de novo.'}
          </p>
          <Button className="mt-5" onClick={() => user && void load(user.id, true)}>
            Tentar de novo
          </Button>
        </Card>
      </Box>
    )
  }

  if (!team) {
    if (profile?.role === 'admin') return <TeamSetup />
    return (
      <Box>
        <Card title="Você ainda não está numa equipe">
          <p className="mt-2 text-sm text-gray-600">
            O CRM e a Prospecção são da equipe de vendas. Peça um convite a quem cuida da equipe: é um link que você abre com esta conta.
          </p>
        </Card>
      </Box>
    )
  }

  return <>{children}</>
}
