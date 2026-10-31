import React, { useMemo } from 'react'
import { Eye, Percent, Send, Trophy } from 'lucide-react'
import { Area, Bars, Card, Donut, PALETTE } from '@/features/home/HomeCharts'
import type { CrmForm, FormSubmission } from '@/features/crm/forms'

/** Gráficos de um formulário ou quiz: funil de visualização até resposta, respostas por dia, origem e o que cada pergunta mostra. */
const Tile: React.FC<{ icon: React.ElementType; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-[14px] p-3.5" style={{ background: `linear-gradient(150deg, ${color}1f, ${color}0a)`, boxShadow: `inset 0 0 0 1px ${color}26` }}>
    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: color }}><Icon className="h-4 w-4" aria-hidden /></span>
    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
)

const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export const FormAnalytics: React.FC<{ form: CrmForm; rows: FormSubmission[] }> = ({ form, rows }) => {
  const quiz = form.kind === 'quiz'
  const data = useMemo(() => {
    const days: { label: string; n: number }[] = []
    const index = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      index.set(dayKey(d.getTime()), days.length)
      days.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, n: 0 })
    }
    const origin = new Map<string, number>()
    const results = new Map<string, number>()
    let scoreSum = 0, scored = 0
    for (const r of rows) {
      const k = index.get(dayKey(r.createdAt)); if (k !== undefined) days[k].n++
      const o = r.origin?.channel || 'Direto'; origin.set(o, (origin.get(o) ?? 0) + 1)
      if (r.result) results.set(r.result, (results.get(r.result) ?? 0) + 1)
      if (typeof r.score === 'number') { scoreSum += r.score; scored++ }
    }
    // Perguntas de escolha: quantas pessoas marcaram cada opção
    const questions = form.definition.steps.flatMap((s) => s.fields).filter((f) => ['choice', 'multi', 'select', 'yesno'].includes(f.type)).map((f) => {
      const counts = new Map<string, number>()
      for (const r of rows) {
        const v = r.answers?.[f.id]
        for (const item of Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]) {
          const key = String(item)
          const label = f.options?.find((o) => o.id === key)?.label ?? (key === 'yes' ? 'Sim' : key === 'no' ? 'Não' : key)
          counts.set(label, (counts.get(label) ?? 0) + 1)
        }
      }
      return { id: f.id, label: f.label, items: [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6) }
    }).filter((q) => q.items.length)
    return { days, origin: [...origin].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6), results: [...results].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), avg: scored ? scoreSum / scored : undefined, questions }
  }, [rows, form.definition])

  const total = rows.length
  const qualified = rows.filter((r) => r.qualified).length
  const views = form.views || 0
  const rate = views > 0 ? Math.min(100, (total / views) * 100) : undefined
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  if (!total && !views) return null
  return (
    <div className="mb-4 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Eye} label="Visualizações" value={fmt(views)} color={PALETTE[0]} />
        <Tile icon={Send} label="Respostas" value={fmt(total)} color={PALETTE[2]} />
        <Tile icon={Percent} label="Convertem" value={rate === undefined ? '—' : `${rate.toFixed(1).replace('.', ',')}%`} color={PALETTE[3]} />
        <Tile icon={Trophy} label={quiz ? 'Qualificadas' : 'Viraram oportunidade'} value={fmt(quiz ? qualified : rows.filter((r) => r.opportunityId).length)} color={PALETTE[1]} />
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <Card title="Respostas por dia" sub="Últimos 14 dias"><Area values={data.days.map((d) => d.n)} labels={data.days.map((d) => d.label)} color={PALETTE[2]} /></Card>
        <Card title="Funil do formulário" sub="Da visualização à resposta">
          <Bars items={[{ label: 'Visualizaram', value: views }, { label: 'Responderam', value: total }, ...(quiz ? [{ label: 'Qualificadas', value: qualified }] : [{ label: 'Oportunidades', value: rows.filter((r) => r.opportunityId).length }])]} />
        </Card>
        {data.origin.length > 0 && <Card title="De onde vêm as respostas"><Donut items={data.origin} /></Card>}
        {quiz && data.results.length > 0 && <Card title="Resultados do quiz" sub={data.avg !== undefined ? `Pontuação média ${data.avg.toFixed(1).replace('.', ',')}` : undefined}><Donut items={data.results} /></Card>}
      </div>
      {data.questions.length > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {data.questions.map((q, i) => <Card key={q.id} title={q.label} sub="O que as pessoas escolheram"><Bars items={q.items} offset={i} /></Card>)}
        </div>
      )}
    </div>
  )
}
