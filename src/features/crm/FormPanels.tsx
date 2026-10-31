import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, CircleAlert, Copy, Download, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { FORMS_ENDPOINT, deleteSubmission, embedOf, listSubmissions, submissionsCsv, type CrmForm, type FormSubmission } from '@/features/crm/forms'
import { Surface, whenLabel } from '@/features/crm/ui'
import { cn } from '@/lib/utils'

const copy = (text: string, what = 'Copiado') =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(what),
    () => toast.error('Não consegui copiar')
  )

const phoneLabel = (phone?: string) => phone?.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') ?? ''

// ---------- respostas ----------

export const Submissions: React.FC<{ form: CrmForm; manager: boolean }> = ({ form, manager }) => {
  const [rows, setRows] = useState<FormSubmission[] | null>(null)
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState<string>()
  const quiz = form.kind === 'quiz'

  const load = useCallback(async () => {
    try {
      setRows(await listSubmissions(form.id))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    }
  }, [form.id])

  useEffect(() => {
    setRows(null)
    void load()
    // Resposta nova aparece na hora, sem recarregar
    const channel = supabase
      .channel(`form-subs-${form.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_form_submissions', filter: `form_id=eq.${form.id}` }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [form.id, load])

  if (rows === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Abrindo as respostas…
      </p>
    )
  }

  const qualified = rows.filter((r) => r.qualified).length
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([submissionsCsv(form, rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.name.replace(/[^\w-]+/g, '-').toLowerCase()}-respostas.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Surface
      title={`${rows.length} ${rows.length === 1 ? 'resposta' : 'respostas'}${quiz && rows.length ? ` · ${qualified} qualificadas` : ''}`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-gray-500">Nenhuma resposta ainda. Publique o formulário e coloque o código no site.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => {
            const expanded = open === r.id
            return (
              <li key={r.id}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? undefined : r.id)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{r.name || r.email || phoneLabel(r.phone) || 'Sem nome'}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[phoneLabel(r.phone), r.email, r.origin?.channel].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {quiz && r.score !== undefined && (
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', r.qualified ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-gray-600')} title={r.result}>
                      {r.score} pts{r.qualified ? ' · qualificado' : ''}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-gray-400">{whenLabel(r.createdAt)}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                </button>
                {expanded && (
                  <div className="mb-3 rounded-lg bg-zinc-50 p-3">
                    <dl className="grid gap-2 text-sm">
                      {r.summary.map((row, i) => (
                        <div key={i}>
                          <dt className="text-xs text-gray-500">{row.label}</dt>
                          <dd className="text-gray-900">{row.value}</dd>
                        </div>
                      ))}
                      {quiz && r.result && (
                        <div>
                          <dt className="text-xs text-gray-500">Resultado</dt>
                          <dd className="text-gray-900">{r.result}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 text-xs text-gray-500">
                      {r.origin?.campaign?.name && <span>Campanha: {r.origin.campaign.name}</span>}
                      {r.origin?.page && <span className="truncate">Página: {r.origin.page}</span>}
                      {r.opportunityId && (
                        <Link to={`/crm?oportunidade=${r.opportunityId}`} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                          Abrir no funil <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {manager && (
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:text-rose-600"
                          onClick={() => {
                            if (!window.confirm('Apagar esta resposta? O lead no funil continua.')) return
                            deleteSubmission(r.id).then(
                              () => setRows((list) => (list ?? []).filter((x) => x.id !== r.id)),
                              (e) => toast.error(e instanceof Error ? e.message : String(e))
                            )
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Apagar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Surface>
  )
}

// ---------- como usar no Elementor ----------

type Endpoint = 'checking' | 'ok' | 'missing' | 'error'

export const EmbedPanel: React.FC<{ form: CrmForm }> = ({ form }) => {
  const [endpoint, setEndpoint] = useState<Endpoint>('checking')
  const snippet = embedOf(form)

  const check = useCallback(() => {
    setEndpoint('checking')
    fetch(FORMS_ENDPOINT, { cache: 'no-store' }).then(
      (r) => setEndpoint(r.ok ? 'ok' : r.status === 404 ? 'missing' : 'error'),
      () => setEndpoint('error')
    )
  }, [])
  useEffect(check, [check])

  return (
    <div className="grid gap-4">
      {form.status !== 'published' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Este formulário está em rascunho: no site ele não aparece. Ligue “Publicado” no topo antes de testar.</span>
        </div>
      )}
      <Surface title="Código para o Elementor">
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">{snippet}</pre>
        <Button size="sm" className="mt-3" onClick={() => void copy(snippet, 'Código copiado')}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar código
        </Button>
        <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm text-gray-700 marker:text-gray-400">
          <li>No Elementor, abra a página e apague o widget do formulário do WordPress.</li>
          <li>
            No lugar dele, arraste um widget <strong>HTML</strong> e cole o código acima.
          </li>
          <li>Publique a página. O formulário aparece com a fonte do site e cada resposta chega como um lead novo em Oportunidades.</li>
          <li>
            Para anúncios, mantenha os parâmetros na URL da campanha (<code className="rounded bg-zinc-100 px-1 text-xs">utm_*</code>, <code className="rounded bg-zinc-100 px-1 text-xs">gclid</code>, <code className="rounded bg-zinc-100 px-1 text-xs">fbclid</code>): a origem e a campanha vão junto com o lead.
          </li>
        </ol>
      </Surface>
      <Surface title="Medição" >
        <p className="text-sm text-gray-600">
          O formulário envia estes eventos ao <code className="rounded bg-zinc-100 px-1 text-xs">dataLayer</code> (Tag Manager): <code className="rounded bg-zinc-100 px-1 text-xs">form_view</code>, <code className="rounded bg-zinc-100 px-1 text-xs">form_start</code>, <code className="rounded bg-zinc-100 px-1 text-xs">form_submit</code> e, no quiz, <code className="rounded bg-zinc-100 px-1 text-xs">lead_qualificado</code> ou <code className="rounded bg-zinc-100 px-1 text-xs">lead_nao_qualificado</code>. Aponte as conversões do Google Ads e da Meta para eles, em vez de contar todo envio.
        </p>
      </Surface>
      <Surface title="Servidor" action={<Button variant="outline" size="sm" onClick={check}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Verificar</Button>}>
        <p className={cn('mb-3 flex items-center gap-2 text-sm', endpoint === 'ok' ? 'text-emerald-700' : endpoint === 'checking' ? 'text-gray-500' : 'text-amber-800')}>
          {endpoint === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : endpoint === 'ok' ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
          {endpoint === 'ok' ? 'A função form-submit está no ar.' : endpoint === 'checking' ? 'Verificando…' : endpoint === 'missing' ? 'A função form-submit ainda não foi publicada no Supabase.' : 'Não consegui falar com a função form-submit.'}
        </p>
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-gray-700 marker:text-gray-400">
          <li>
            Aplicar a migração <code className="rounded bg-zinc-100 px-1 text-xs">supabase/migrations/20261030100000_crm_forms.sql</code>.
          </li>
          <li>
            Publicar a função:{' '}
            <button type="button" onClick={() => void copy('supabase functions deploy form-submit --no-verify-jwt', 'Comando copiado')} className="rounded bg-zinc-100 px-1 font-mono text-xs text-gray-800 hover:bg-zinc-200">
              supabase functions deploy form-submit --no-verify-jwt
            </button>
          </li>
          <li>Publicar o app, que serve o <code className="rounded bg-zinc-100 px-1 text-xs">forms.js</code> usado no site.</li>
        </ol>
      </Surface>
    </div>
  )
}
