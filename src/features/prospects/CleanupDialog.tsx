import React, { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { removeOpportunity } from './api'
import { STAGE_LABEL, type Opportunity, type Stage } from './funnel'
import { displayName } from './offer'

/** Dias que o cartão está na etapa de hoje (desde a última mudança de etapa). */
export const daysStopped = (o: Opportunity) => Math.max(0, Math.floor((Date.now() - Date.parse(o.history.at(-1)?.at ?? o.updatedAt)) / 86_400_000))

const SKIP: Stage[] = ['fechado']

/**
 * Limpar o funil: lista os cartões parados (há N dias na mesma etapa) e apaga
 * os escolhidos de vez. O cliente e a linha do tempo continuam; só a
 * oportunidade some, e isso não tem volta. Nada é marcado de antemão para quem
 * tem projeto no Space ou próximo passo marcado para o futuro.
 */
export const CleanupDialog: React.FC<{ open: boolean; onClose: () => void; items: Opportunity[]; onRemoved: (ids: string[]) => void }> = ({ open, onClose, items, onRemoved }) => {
  const [days, setDays] = useState(30)
  const [stages, setStages] = useState<Stage[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const stuck = useMemo(
    () =>
      items
        .filter((o) => !SKIP.includes(o.stage) && daysStopped(o) >= days && (!stages.length || stages.includes(o.stage)))
        .sort((a, b) => daysStopped(b) - daysStopped(a)),
    [items, days, stages]
  )
  const protectedCard = (o: Opportunity) => !!o.projectId || !!(o.nextDate && o.nextDate >= today)

  // Ao abrir ou mudar o filtro: marca os parados que não têm projeto nem compromisso futuro
  useEffect(() => {
    if (open) setPicked(new Set(stuck.filter((o) => !protectedCard(o)).map((o) => o.id)))
  }, [open, stuck]) // eslint-disable-line react-hooks/exhaustive-deps

  const present = [...new Set(items.filter((o) => !SKIP.includes(o.stage)).map((o) => o.stage))]
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const run = async () => {
    const ids = stuck.filter((o) => picked.has(o.id)).map((o) => o.id)
    if (!ids.length || busy) return
    if (!window.confirm(`Apagar ${ids.length} ${ids.length === 1 ? 'cartão' : 'cartões'} do funil de vez? Não tem como desfazer. Os clientes e as anotações continuam no CRM.`)) return
    setBusy(true)
    const gone: string[] = []
    let failed = ''
    for (const id of ids) {
      try {
        await removeOpportunity(id)
        gone.push(id)
      } catch (e) {
        failed = e instanceof Error ? e.message : 'erro'
        break
      }
    }
    setBusy(false)
    if (gone.length) onRemoved(gone)
    if (failed) toast.error(`Apaguei ${gone.length} de ${ids.length}`, { description: failed })
    else {
      toast.success(`${gone.length} ${gone.length === 1 ? 'cartão apagado' : 'cartões apagados'}`)
      onClose()
    }
  }

  const chosen = stuck.filter((o) => picked.has(o.id)).length
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b border-gray-100 p-4">
          <DialogTitle className="text-base">Limpar cartões parados</DialogTitle>
          <p className="mt-1 text-xs text-gray-500">Cartões há muito tempo na mesma etapa. Os que têm projeto no Space ou próximo passo marcado para o futuro vêm desmarcados.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-700">
            <label className="flex items-center gap-1.5">
              Parados há pelo menos
              <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-16 rounded-md border border-gray-200 px-2 text-sm" /> dias
            </label>
            <div className="flex flex-wrap gap-1">
              {present.map((s) => (
                <button key={s} type="button" aria-pressed={stages.includes(s)} onClick={() => setStages((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]))} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', stages.includes(s) ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50')}>
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ul className="max-h-[48vh] divide-y divide-gray-100 overflow-y-auto">
          {stuck.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Nenhum cartão parado há {days} dias ou mais.</li>}
          {stuck.map((o) => (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                <input type="checkbox" className="mt-1" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{displayName(o.lead.name)}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {STAGE_LABEL[o.stage]} · parado há {daysStopped(o)} dias{o.nextStep ? ` · próximo passo: ${o.nextStep}` : ' · sem próximo passo'}
                    {o.projectId ? ' · tem projeto no Space' : ''}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-3">
          <span className="text-xs text-gray-500">{stuck.length} parados · {chosen} marcados</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={!chosen || busy} onClick={() => void run()}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Apagar {chosen || ''} de vez
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
