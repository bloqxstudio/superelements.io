import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm } from '@/features/crm/crmStore'
import { loadHook } from '@/features/crm/leadOrigin'
import { useSpaceStore } from '@/store/spaceStore'
import { credentialsOf } from './connect'
import { CONNECTOR_ZIP } from './autologin'
import { findLeadForms, linkLeadForm } from './leadForms'
import { wpRequest } from './rest'
import type { WordPressConnection } from './types'

/** Versão do Connector no site (sem o plugin, null) */
const useConnectorVersion = (connection: WordPressConnection) => {
  const [version, setVersion] = useState<string | null | undefined>()
  useEffect(() => {
    let alive = true
    wpRequest<{ version: string }>(credentialsOf(connection), 'superelements/v1/status').then(
      (r) => alive && setVersion(r.version),
      () => alive && setVersion(null)
    )
    return () => {
      alive = false
    }
  }, [connection])
  return version
}

const atLeast04 = (version: string | null | undefined) => {
  if (!version) return false
  const [major = 0, minor = 0] = version.split('.').map((n) => Number.parseInt(n, 10) || 0)
  return major > 0 || minor >= 4
}

/** "Leads no CRM": os formulários do projeto e o botão que liga cada um ao webhook da conta. */
export const LeadFormsPanel: React.FC<{ connection: WordPressConnection }> = ({ connection }) => {
  const nodes = useSpaceStore((s) => s.nodes)
  const pages = useSpaceStore((s) => s.pages)
  const team = useCrm((s) => s.team)
  const manager = team?.role === 'owner' || team?.role === 'admin'
  const [token, setToken] = useState<string | null | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const version = useConnectorVersion(connection)

  useEffect(() => {
    if (!team || !manager) return setToken(null)
    loadHook(team.id)
      .then((hook) => setToken(hook.token))
      .catch((e) => {
        setToken(null)
        setError(e instanceof Error && e.message === 'no_tables' ? 'O CRM ainda não tem o webhook de leads (falta aplicar a migração).' : e instanceof Error ? e.message : String(e))
      })
  }, [team, manager])

  const forms = useMemo(() => findLeadForms(nodes, pages, token ?? undefined), [nodes, pages, token])
  if (!forms.length) return null

  const link = (formKey: string) => {
    const form = forms.find((f) => `${f.sectionId}:${f.elementId}` === formKey)
    if (!form || !token) return
    setBusy(formKey)
    const ok = linkLeadForm(form, nodes, token)
    setBusy(null)
    if (ok) toast.success('Formulário ligado ao CRM', { description: 'Publique a página para valer no site. O passo fica no desfazer do projeto.' })
    else toast.info('Nada a mudar: o formulário já está assim.')
  }

  return (
    <section className="rounded-lg border" aria-label="Leads no CRM">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Plug className="h-4 w-4 text-gray-500" aria-hidden />
        <p className="text-sm font-medium text-gray-900">Leads no CRM</p>
      </div>
      <div className="grid gap-3 px-4 py-3 text-sm">
        {!manager ? (
          <p className="text-xs text-muted-foreground">Só gestores da conta ligam um formulário ao CRM.</p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : token === undefined ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo a chave da conta…</p>
        ) : (
          <ul className="grid gap-2">
            {forms.map((form) => {
              const key = `${form.sectionId}:${form.elementId}`
              return (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-900">{form.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {form.pageName}
                      {form.current && form.missingOrigin.length === 0 ? ' · ligado ao CRM' : form.linked && !form.current ? ' · manda para outra chave' : form.current ? ' · faltam campos de origem' : ''}
                    </span>
                  </span>
                  {form.current && form.missingOrigin.length === 0 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Ligado
                    </span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={busy === key} onClick={() => link(key)}>
                      {form.linked ? 'Atualizar' : 'Ligar ao CRM'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Usa a ação Webhook do Elementor Pro (precisa do Elementor Pro no site) e põe campos ocultos de origem (UTM, gclid, fbclid).
          {version !== undefined && !atLeast04(version) && (
            <>
              {' '}
              Para preencher esses campos com a campanha de cada visita, o site precisa do plugin Connector 0.4:{' '}
              <a href={CONNECTOR_ZIP} className="underline underline-offset-2">baixar</a> e instalar em Plugins › Adicionar novo › Enviar.
            </>
          )}
        </p>
      </div>
    </section>
  )
}
