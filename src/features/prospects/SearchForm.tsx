import React, { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NICHES, nicheFor } from './niches'
import type { Coverage, ProspectSource, SearchInput } from './types'
import { Chip, SURFACE } from './ui'

const LAST = 'prospeccao:ultima-busca'

const remembered = (): Partial<SearchInput> => {
  try {
    return JSON.parse(localStorage.getItem(LAST) ?? '{}')
  } catch {
    return {}
  }
}

const SOURCES: { id: ProspectSource; title: string; text: string }[] = [
  { id: 'maps', title: 'Google Maps', text: 'Grátis. As empresas do Maps, lidas como o navegador lê. Se o Google pedir uma pausa, a busca guarda o que já achou.' },
  { id: 'osm', title: 'Mapa aberto', text: 'Grátis. Traz o que a comunidade do OpenStreetMap mapeou: bem menos empresas.' },
  { id: 'google', title: 'API do Google', text: 'Paga por consulta, com a chave GOOGLE_PLACES_API_KEY do .env.' },
]

const COVERAGES: { id: Coverage; title: string; text: string }[] = [
  { id: 'centro', title: 'Centro da cidade', text: 'Rápido: até uns 300 por nicho, do centro para fora.' },
  { id: 'cidade', title: 'Cidade inteira', text: 'Varre a cidade em pontos: alguns minutos por nicho.' },
]

/** Botão de escolha em cartão (fonte, cobertura). */
const Option: React.FC<{ name: string; title: string; text: string; checked: boolean; onChange: () => void }> = ({ name, title, text, checked, onChange }) => (
  <label className={cn('flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ring-inset transition-colors', checked ? 'bg-gray-50 ring-gray-900' : 'ring-gray-200 hover:bg-gray-50')}>
    <input type="radio" name={name} className="mt-0.5 accent-gray-900" checked={checked} onChange={onChange} />
    <span>
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      <span className="mt-0.5 block text-xs text-gray-500">{text}</span>
    </span>
  </label>
)

const FIELD = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const SearchForm: React.FC<{ google: boolean; running: boolean; onSearch: (input: SearchInput) => void }> = ({ google, running, onSearch }) => {
  const [initial] = useState(remembered)
  const [region, setRegion] = useState(initial.region ?? '')
  const [areas, setAreas] = useState((initial.areas ?? []).join(', '))
  const [niches, setNiches] = useState<string[]>(initial.niches ?? [])
  const [custom, setCustom] = useState('')
  // Começa sempre no Google Maps (o mapa aberto cobre pouco); a API só se tiver a chave
  const [source, setSource] = useState<ProspectSource>(google && initial.source === 'google' ? 'google' : 'maps')
  const [coverage, setCoverage] = useState<Coverage>(initial.coverage ?? 'centro')
  const sources = SOURCES.filter((option) => option.id !== 'google' || google)
  const withAreas = areas.split(/[,;\n]/).some((a) => a.trim())

  const toggle = (id: string) => setNiches((list) => (list.includes(id) ? list.filter((n) => n !== id) : [...list, id]))
  const addCustom = () => {
    const text = custom.trim()
    if (text && !niches.includes(text)) setNiches((list) => [...list, text])
    setCustom('')
  }
  const customNiches = niches.filter((n) => !NICHES.some((preset) => preset.id === n))
  const ready = region.trim() && niches.length && !running

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready) return
    const input: SearchInput = {
      region: region.trim(),
      areas: areas.split(/[,;\n]/).map((a) => a.trim()).filter(Boolean),
      niches,
      source,
      coverage: source === 'maps' && !withAreas ? coverage : undefined,
    }
    try {
      localStorage.setItem(LAST, JSON.stringify(input))
    } catch {
      // Sem armazenamento: só não lembra a última busca
    }
    onSearch(input)
  }

  return (
    <form onSubmit={submit} className={cn(SURFACE, 'p-5 md:p-6')}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Cidade</span>
          <input className={cn(FIELD, 'mt-1.5')} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="São Paulo, SP" autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-900">
            Bairros <span className="font-normal text-gray-500">(opcional)</span>
          </span>
          <input className={cn(FIELD, 'mt-1.5')} value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Pinheiros, Moema, Itaim Bibi" autoComplete="off" />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">Com bairros, a busca roda bairro por bairro: até uns 300 por nicho em cada um.</p>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-gray-900">Nichos</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {NICHES.map((niche) => (
            <Chip key={niche.id} active={niches.includes(niche.id)} onClick={() => toggle(niche.id)}>
              {niche.label}
            </Chip>
          ))}
          {customNiches.map((text) => (
            <Chip key={text} active onClick={() => toggle(text)} aria-label={`Tirar ${text}`}>
              {nicheFor(text).label}
              <X className="h-3.5 w-3.5" aria-hidden />
            </Chip>
          ))}
          <div className="flex h-8 items-center rounded-full ring-1 ring-inset ring-gray-200 focus-within:ring-2 focus-within:ring-ring">
            <input
              className="h-full w-40 rounded-l-full bg-transparent pl-3 text-sm placeholder:text-gray-400 focus:outline-none"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="Outro nicho"
              aria-label="Outro nicho"
            />
            <button type="button" onClick={addCustom} disabled={!custom.trim()} className="flex h-full items-center rounded-r-full px-2.5 text-gray-500 hover:text-gray-900 disabled:opacity-40" aria-label="Juntar nicho">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-gray-900">Onde procurar</legend>
        <div className={cn('mt-2 grid gap-2', sources.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          {sources.map((option) => (
            <Option key={option.id} name="fonte" title={option.title} text={option.text} checked={source === option.id} onChange={() => setSource(option.id)} />
          ))}
        </div>
      </fieldset>

      {source === 'maps' && !withAreas && (
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-gray-900">Cobertura</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {COVERAGES.map((option) => (
              <Option key={option.id} name="cobertura" title={option.title} text={option.text} checked={coverage === option.id} onChange={() => setCoverage(option.id)} />
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        {!niches.length && <p className="text-xs text-gray-500">Escolha pelo menos um nicho.</p>}
        <Button type="submit" disabled={!ready} className="gap-1.5">
          <Search className="h-4 w-4" />
          {running ? 'Buscando…' : 'Buscar empresas'}
        </Button>
      </div>
    </form>
  )
}
