import React, { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FIELD } from '@/features/crm/ui'
import { PRODUCT_DEFAULTS, catalogBrands, cleanCatalog, type ProductCatalog } from '@/features/crm/forms'
import { catalogCsv, parseCatalog } from './catalogImport'

/**
 * As configurações do campo "Encontrar produto" (2026-11-07, pedidos da Vizor): o catálogo (importado de
 * CSV ou JSON, baixável para corrigir na planilha), o logo de cada marca, o WhatsApp de vendas e os textos
 * do fim. A prévia ao lado já mostra os cartões de marca, as listas e o card do produto.
 */

const INPUT = `${FIELD} h-9`
const LABEL = 'mb-1 block text-xs font-medium text-gray-600'

export const ProductCatalogEditor: React.FC<{ catalog: ProductCatalog | undefined; onChange: (catalog: ProductCatalog) => void }> = ({ catalog, onChange }) => {
  const c = catalog ?? { items: [], brands: [] }
  const [paste, setPaste] = useState(false)
  const [text, setText] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<ProductCatalog>) => onChange({ ...c, ...patch })
  const brands = catalogBrands(c)

  const load = (raw: string) => {
    try {
      const got = parseCatalog(raw)
      if (!got.items.length) { toast.error('Nenhum produto lido. A primeira linha precisa ter as colunas marca e modelo.'); return }
      // Mantém os logos já cadastrados para as marcas que continuam
      const logos = new Map(c.brands.map((b) => [b.name.toLowerCase(), b.logo]))
      const next = cleanCatalog({ ...c, items: got.items, brands: got.brands.map((b) => ({ name: b.name, logo: b.logo ?? logos.get(b.name.toLowerCase()) })) })
      onChange(next)
      setPaste(false)
      setText('')
      toast.success(`${next.items.length} produto(s) de ${catalogBrands(next).length} marca(s)${got.skipped ? `; ${got.skipped} linha(s) sem marca ou modelo ficaram de fora` : ''}.`)
    } catch (e) {
      toast.error(`Não consegui ler: ${(e as Error).message}`)
    }
  }
  const download = () => {
    const blob = new Blob(['﻿' + catalogCsv(c.items)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'catalogo.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const setLogo = (name: string, logo: string) => {
    const list = brands.map((b) => (b.name === name ? { name, logo: logo.trim() || undefined } : b))
    set({ brands: list })
  }

  return (
    <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Catálogo</p>
          <p className="text-xs text-gray-500">{c.items.length ? `${c.items.length} produto(s) de ${brands.length} marca(s)` : 'Nenhum produto ainda'}</p>
        </div>
        <div className="flex gap-1.5">
          <input ref={file} type="file" accept=".csv,.json,.txt,text/csv,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); e.target.value = '' }} />
          <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()}><Upload className="h-3.5 w-3.5" /> Arquivo</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPaste((v) => !v)}>Colar</Button>
          {c.items.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={download} aria-label="Baixar o catálogo em CSV"><Download className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      {paste && (
        <div className="grid gap-2">
          <textarea className={`${FIELD} min-h-[120px] font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'marca;modelo;ano;nome;imagem;link;código brilho;código fosco\nHonda;CB 500X;2022–2025;Película CB 500X;https://…;https://…;VZB0100;VZF0100'} />
          <p className="text-xs text-gray-500">CSV (vírgula, ponto e vírgula ou tab) ou JSON. Colunas de código viram as variações; importar substitui o catálogo atual.</p>
          <div><Button type="button" size="sm" onClick={() => load(text)} disabled={!text.trim()}>Importar</Button></div>
        </div>
      )}
      {brands.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-violet-700">Logos das marcas ({brands.filter((b) => b.logo).length} de {brands.length})</summary>
          <div className="mt-2 grid gap-1.5">
            {brands.map((b) => (
              <div key={b.name} className="grid grid-cols-[28px_80px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[28px_110px_minmax(0,1fr)]">
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded bg-zinc-50">{b.logo ? <img src={b.logo} alt="" className="h-6 w-6 object-contain" /> : <span className="text-xs font-semibold text-gray-400">{b.name.charAt(0)}</span>}</span>
                <span className="truncate text-sm text-gray-700">{b.name}</span>
                <input className={INPUT} placeholder="https://… (PNG ou SVG)" defaultValue={b.logo ?? ''} onBlur={(e) => setLogo(b.name, e.target.value)} aria-label={`Logo de ${b.name}`} />
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>WhatsApp de vendas</label>
          <input className={INPUT} inputMode="tel" placeholder="55 51 99999-9999" defaultValue={c.whatsapp ?? ''} onBlur={(e) => { const d = e.target.value.replace(/\D/g, ''); set({ whatsapp: d.length >= 10 ? (d.length <= 11 ? `55${d}` : d) : undefined }) }} />
        </div>
        <div>
          <label className={LABEL}>Texto do botão</label>
          <input className={INPUT} placeholder={PRODUCT_DEFAULTS.buttonLabel} value={c.buttonLabel ?? ''} onChange={(e) => set({ buttonLabel: e.target.value || undefined })} />
        </div>
        <div>
          <label className={LABEL}>Rótulo do modelo</label>
          <input className={INPUT} placeholder={PRODUCT_DEFAULTS.modelLabel} value={c.modelLabel ?? ''} onChange={(e) => set({ modelLabel: e.target.value || undefined })} />
        </div>
        <div>
          <label className={LABEL}>Rótulo do ano</label>
          <input className={INPUT} placeholder={PRODUCT_DEFAULTS.yearLabel} value={c.yearLabel ?? ''} onChange={(e) => set({ yearLabel: e.target.value || undefined })} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Título do resultado</label>
        <input className={INPUT} placeholder={PRODUCT_DEFAULTS.resultTitle} value={c.resultTitle ?? ''} onChange={(e) => set({ resultTitle: e.target.value || undefined })} />
      </div>
      <div>
        <label className={LABEL}>Mensagem do WhatsApp</label>
        <textarea className={`${FIELD} min-h-[88px] text-sm`} placeholder={PRODUCT_DEFAULTS.message} value={c.message ?? ''} onChange={(e) => set({ message: e.target.value || undefined })} />
        <p className="mt-1 text-xs text-gray-500">Use {'{produto}'}, {'{marca}'}, {'{modelo}'}, {'{ano}'}, {'{codigos}'}, {'{link}'} e {'{ref}'} (o código que liga a conversa à busca, nas respostas do formulário).</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Abrir o WhatsApp sozinho</label>
          <select className={INPUT} value={String(c.redirectSeconds ?? PRODUCT_DEFAULTS.redirectSeconds)} onChange={(e) => set({ redirectSeconds: Number(e.target.value) })}>
            <option value="0">Não abrir</option>
            {[8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>Depois de {n} s</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Contagem</label>
          <select className={INPUT} value={c.redirectStyle ?? 'fill'} disabled={c.redirectSeconds === 0} onChange={(e) => set({ redirectStyle: e.target.value === 'bar' ? 'bar' : undefined })}>
            <option value="fill">Botão escurecendo</option>
            <option value="bar">Barra abaixo do botão</option>
          </select>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-xs font-medium text-violet-700">Quando a moto não está no catálogo</summary>
        <div className="mt-2 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Link abaixo das listas</label>
              <input className={INPUT} placeholder={PRODUCT_DEFAULTS.noMatchLabel} value={c.noMatchLabel ?? ''} onChange={(e) => set({ noMatchLabel: e.target.value || undefined })} />
            </div>
            <div>
              <label className={LABEL}>Título</label>
              <input className={INPUT} placeholder={PRODUCT_DEFAULTS.noMatchTitle} value={c.noMatchTitle ?? ''} onChange={(e) => set({ noMatchTitle: e.target.value || undefined })} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Texto</label>
            <input className={INPUT} placeholder={PRODUCT_DEFAULTS.noMatchText} value={c.noMatchText ?? ''} onChange={(e) => set({ noMatchText: e.target.value || undefined })} />
          </div>
          <div>
            <label className={LABEL}>Mensagem do WhatsApp</label>
            <textarea className={`${FIELD} min-h-[64px] text-sm`} placeholder={PRODUCT_DEFAULTS.noMatchMessage} value={c.noMatchMessage ?? ''} onChange={(e) => set({ noMatchMessage: e.target.value || undefined })} />
          </div>
        </div>
      </details>
    </div>
  )
}
