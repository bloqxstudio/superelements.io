import React, { useEffect, useState } from 'react'
import { Copy, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { hookUrl, loadHook, setHookEnabled } from '@/features/crm/leadOrigin'
import { cn } from '@/lib/utils'

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado'),
    () => toast.error('Não consegui copiar')
  )

const EXAMPLE = `{
  "nome": "Maria Souza",
  "email": "maria@exemplo.com",
  "telefone": "(51) 99999-1234",
  "mensagem": "Quero um site novo",
  "utm_source": "facebook",
  "utm_medium": "paid",
  "utm_campaign": "Nome da campanha",
  "utm_content": "Nome do anúncio",
  "page_url": "https://seusite.com.br/contato"
}`

/** Receber leads: o endereço do webhook da conta, como ligar no Elementor e o que a função entende. */
export const LeadHookDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; teamId: string }> = ({ open, onOpenChange, teamId }) => {
  const [hook, setHook] = useState<{ token: string; enabled: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    loadHook(teamId)
      .then(setHook)
      .catch((e) => setError(e instanceof Error && e.message === 'no_tables' ? 'Falta aplicar a migração 20261029140000_crm_lead_webhook.sql no Supabase.' : e instanceof Error ? e.message : String(e)))
  }, [open, teamId])

  const rotate = async () => {
    if (!window.confirm('Gerar outra chave? O endereço atual para de funcionar e o site precisa receber o novo.')) return
    setBusy(true)
    try {
      setHook(await loadHook(teamId, true))
      toast.success('Chave nova gerada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (enabled: boolean) => {
    if (!hook) return
    setHook({ ...hook, enabled })
    try {
      await setHookEnabled(teamId, enabled)
    } catch (e) {
      setHook({ ...hook, enabled: !enabled })
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const url = hook ? hookUrl(hook.token) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber leads do site</DialogTitle>
          <DialogDescription>Cada envio vira um cartão em "Novo lead", com contato, origem e campanha. Só gestores veem o endereço.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-rose-700" role="alert">{error}</p>
        ) : !hook ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</p>
        ) : (
          <div className="grid gap-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-gray-800">Endereço do webhook (POST)</p>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  {hook.enabled ? 'Recebendo' : 'Desligado'}
                  <Switch checked={hook.enabled} onCheckedChange={(v) => void toggle(v)} aria-label="Webhook ligado" />
                </label>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <code className={cn('min-w-0 flex-1 truncate rounded-md bg-zinc-50 px-2.5 py-2 text-xs ring-1 ring-inset ring-gray-200', !hook.enabled && 'opacity-50')}>{url}</code>
                <Button type="button" variant="outline" size="icon" onClick={() => void copy(url)} aria-label="Copiar o endereço">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <button type="button" disabled={busy} onClick={() => void rotate()} className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900">
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> Gerar outra chave
              </button>
            </div>

            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900">No Elementor</p>
              <ol className="mt-1.5 grid list-decimal gap-1 pl-5 text-xs text-gray-600 marker:text-gray-400">
                <li>Edite o formulário › Ações após o envio › adicione <strong>Webhook</strong>.</li>
                <li>Cole o endereço acima em URL do webhook (ligue "Dados avançados" para mandar os títulos dos campos).</li>
                <li>Para saber de qual anúncio veio, ponha campos ocultos no formulário com os nomes <code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code>, <code>utm_content</code>, <code>utm_term</code>, <code>gclid</code> e <code>fbclid</code> (valor: parâmetro da URL).</li>
              </ol>
              <p className="mt-3 font-medium text-gray-900">Outras ferramentas (Zapier, Make, RD, código próprio)</p>
              <p className="mt-1 text-xs text-gray-600">Qualquer POST com JSON ou formulário. Precisa de e-mail ou telefone. Nomes de campo em português ou inglês são reconhecidos.</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 text-[11px] leading-relaxed ring-1 ring-inset ring-gray-200">{EXAMPLE}</pre>
              <p className="mt-3 text-xs text-gray-600">
                A campanha é procurada pelo nome em <code>utm_campaign</code> (ou pelo id em <code>campaign_id</code>) nos relatórios de Anúncios; achando, o cartão mostra o gasto e os resultados do período. O aviso no WhatsApp vai para quem está marcado com "Receber leads" em CRM › WhatsApp › Clientes.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
