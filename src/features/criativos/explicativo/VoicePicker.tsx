import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Loader2, Play, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { addVoiceViaLink, brazilVoicesViaLink, elevenVoicesViaLink, saveImageKey, speakViaLink, useCreativeLink } from '../link'
import { TONES, VOICES, directionFor, elevenSettings, type ToneId, type VoiceAI, type VoiceProvider } from './narracao'
import { field } from './shared'

/**
 * Escolher a voz da narração por IA: OpenAI (gpt-4o-mini-tts, direção de voz em texto) ou
 * ElevenLabs (as vozes da conta, inclusive a clonada da pessoa; Multilingual v2 ou v3). Jeito de
 * falar, ritmo, direção livre e "reescrever a fala para soar natural", com amostra para ouvir.
 * Sem a chave do serviço neste computador, pede a chave e a guarda pelo conector (fica só aqui).
 */

export const DEFAULT_VOICE: VoiceAI = { provider: 'openai', voice: 'marin', tone: 'reels', speed: 1, rewrite: true }

export const useVoiceReady = (provider: VoiceProvider = 'openai') => {
  const connected = useCreativeLink((s) => s.connected)
  const key = useCreativeLink((s) => (provider === 'elevenlabs' ? !!s.keys.elevenlabs : s.keys.openai))
  return { connected, key }
}

const SAMPLE = (brand?: string) => `Sabe aquele vídeo que você pula nos primeiros dois segundos? Pois é, esse aqui não. Olha só como fica a narração${brand ? ` da ${brand}` : ''}, natural, do jeito que a gente conversa.`

type ElevenVoice = { id: string; name: string; category: string; description: string; preview?: string }

const KeyBox: React.FC<{ provider: VoiceProvider }> = ({ provider }) => {
  const [draft, setDraft] = useState('')
  const eleven = provider === 'elevenlabs'
  const ok = eleven ? draft.trim().length >= 20 : draft.trim().startsWith('sk-')
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900"><KeyRound className="h-3.5 w-3.5" /> Falta a chave da {eleven ? 'ElevenLabs' : 'OpenAI'} neste computador</p>
      <p className="mt-1 text-[11px] leading-snug text-amber-900/80">{eleven ? 'elevenlabs.io › Developers › API keys (com permissão de Text to Speech e de ler vozes).' : 'É a mesma das imagens (platform.openai.com › API keys).'} Fica guardada só neste computador, pelo conector; o app nunca a vê.</p>
      <div className="mt-2 flex gap-1.5">
        <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={eleven ? 'sk_…' : 'sk-…'} className={cn(field, 'font-mono')} autoComplete="off" />
        <Button type="button" size="sm" className="h-8 shrink-0" disabled={!ok} onClick={() => { saveImageKey(provider, draft.trim()); setDraft(''); toast.success('Chave guardada neste computador.') }}>Guardar</Button>
      </div>
    </div>
  )
}

type BrVoice = { ownerId: string; id: string; name: string; gender?: string; age?: string; description: string; preview?: string; added: boolean }

/** As vozes nativas do Brasil da biblioteca da ElevenLabs: ouvir a prévia e usar (adiciona à conta). */
const BrazilLibrary: React.FC<{ onPick: (id: string, name: string) => void; play: (src: string) => void }> = ({ onPick, play }) => {
  const [list, setList] = useState<BrVoice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const load = async () => {
    setOpen(true)
    if (list) return
    try {
      setList(await brazilVoicesViaLink())
    } catch (err) {
      setList([])
      toast.error(err instanceof Error ? err.message : 'Não consegui ler a biblioteca de vozes.')
    }
  }
  const use = async (v: BrVoice) => {
    setBusy(v.id)
    try {
      const out = v.added ? { id: v.id } : await addVoiceViaLink(v.ownerId, v.id, v.name)
      onPick(out.id, `${v.name} (BR)`)
      toast.success(`Voz ${v.name} pronta.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui adicionar a voz.')
    } finally {
      setBusy(null)
    }
  }
  if (!open) return <button type="button" className="text-[11px] font-medium text-violet-700 hover:underline" onClick={() => void load()}>🇧🇷 Ver vozes brasileiras da biblioteca</button>
  return (
    <div className="rounded-md border border-gray-200 p-2">
      <p className="mb-1 text-[11px] font-medium text-gray-700">Vozes brasileiras (biblioteca da ElevenLabs)</p>
      {!list ? <p className="text-[11px] text-gray-500">Lendo…</p> : !list.length ? <p className="text-[11px] text-gray-500">Nenhuma voz brasileira encontrada.</p> : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {list.map((v) => (
            <li key={v.id} className="flex items-center gap-1.5 text-[11px]">
              {v.preview && <button type="button" aria-label={`Ouvir ${v.name}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 hover:bg-gray-50" onClick={() => play(v.preview!)}><Play className="h-3 w-3" /></button>}
              <span className="min-w-0 flex-1 truncate"><b>{v.name}</b>{[v.gender === 'male' ? 'masculina' : v.gender === 'female' ? 'feminina' : '', v.age, v.description].filter(Boolean).length ? ` · ${[v.gender === 'male' ? 'masculina' : v.gender === 'female' ? 'feminina' : '', v.age, v.description].filter(Boolean).join(', ')}` : ''}</span>
              <Button type="button" size="sm" variant="outline" className="h-6 shrink-0 bg-white px-2 text-[11px]" disabled={!!busy} onClick={() => void use(v)}>{busy === v.id ? '…' : 'Usar'}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const VoicePicker: React.FC<{ value: VoiceAI; onChange: (v: VoiceAI) => void; brand?: string }> = ({ value, onChange, brand }) => {
  const provider: VoiceProvider = value.provider ?? 'openai'
  const eleven = provider === 'elevenlabs'
  const { connected, key } = useVoiceReady(provider)
  const [sampling, setSampling] = useState(false)
  const [voices, setVoices] = useState<ElevenVoice[] | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  // As vozes da conta da ElevenLabs (as clonadas primeiro)
  useEffect(() => {
    if (!eleven || !connected || !key || voices) return
    let alive = true
    void elevenVoicesViaLink()
      .then((list) => {
        if (!alive) return
        const rank = (v: ElevenVoice) => (v.category === 'cloned' || v.category === 'professional' ? 2 : /\(BR\)|brazil|brasil/i.test(`${v.name} ${v.description}`) ? 1 : 0)
        const sorted = [...list].sort((a, b) => rank(b) - rank(a))
        setVoices(sorted)
        if (!sorted.some((v) => v.id === value.voice) && sorted[0]) onChange({ ...value, voice: sorted[0].id, voiceName: sorted[0].name })
      })
      .catch((err) => {
        if (alive) {
          setVoices([])
          toast.error(err instanceof Error ? err.message : 'Não consegui ler as vozes da ElevenLabs.')
        }
      })
    return () => {
      alive = false
    }
  }, [eleven, connected, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = (src: string) => {
    audio.current?.pause()
    audio.current = new Audio(src)
    void audio.current.play()
  }
  const sample = async () => {
    setSampling(true)
    try {
      const out = eleven
        ? await speakViaLink({ provider: 'elevenlabs', text: SAMPLE(brand), voice: value.voice, model: value.model, ...elevenSettings(value) })
        : await speakViaLink({ text: SAMPLE(brand), voice: value.voice, instructions: directionFor(value, brand) })
      play(out.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui gerar a amostra.')
    } finally {
      setSampling(false)
    }
  }
  const setProvider = (p: VoiceProvider) => {
    if (p === provider) return
    onChange(p === 'elevenlabs' ? { ...value, provider: p, voice: voices?.[0]?.id ?? '', voiceName: voices?.[0]?.name, model: value.model ?? 'eleven_multilingual_v2' } : { ...value, provider: p, voice: 'marin', voiceName: undefined })
  }

  const current = voices?.find((v) => v.id === value.voice)

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-md bg-gray-100 p-0.5 text-xs">
        {(['openai', 'elevenlabs'] as const).map((p) => (
          <button key={p} type="button" onClick={() => setProvider(p)} className={cn('flex-1 rounded px-2 py-1', provider === p ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>{p === 'openai' ? 'OpenAI' : 'ElevenLabs'}</button>
        ))}
      </div>
      {!connected ? (
        <p className="text-[11px] text-gray-500">A narração por IA precisa do conector desta máquina aberto.</p>
      ) : !key ? (
        <KeyBox provider={provider} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {eleven ? (
              <label className="col-span-2 text-[11px] text-gray-500">Voz da sua conta
                <div className="flex gap-1.5">
                  <select className={field} value={value.voice} disabled={!voices} onChange={(e) => { const v = voices?.find((x) => x.id === e.target.value); onChange({ ...value, voice: e.target.value, voiceName: v?.name }) }}>
                    {!voices && <option>Lendo as vozes…</option>}
                    {voices?.map((v) => (<option key={v.id} value={v.id}>{v.category === 'cloned' || v.category === 'professional' ? '★ ' : ''}{v.name}{v.description ? ` · ${v.description}` : ''}</option>))}
                  </select>
                  {current?.preview && <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0 bg-white" title="Ouvir a prévia da voz (grátis)" onClick={() => play(current.preview!)}><Play className="h-3.5 w-3.5" /></Button>}
                </div>
              </label>
            ) : (
              <label className="text-[11px] text-gray-500">Voz
                <select className={field} value={value.voice} onChange={(e) => onChange({ ...value, voice: e.target.value })}>
                  {VOICES.map((v) => (<option key={v.id} value={v.id}>{v.label} · {v.hint}</option>))}
                </select>
              </label>
            )}
            {eleven && (
              <label className="text-[11px] text-gray-500">Modelo
                <select className={field} value={value.model ?? 'eleven_multilingual_v2'} onChange={(e) => onChange({ ...value, model: e.target.value })}>
                  <option value="eleven_multilingual_v2">Multilingual v2 · estável</option>
                  <option value="eleven_v3">v3 · mais expressiva</option>
                </select>
              </label>
            )}
            <label className="text-[11px] text-gray-500">Jeito de falar
              <select className={field} value={value.tone} onChange={(e) => onChange({ ...value, tone: e.target.value as ToneId })}>
                {(Object.keys(TONES) as ToneId[]).map((t) => (<option key={t} value={t}>{TONES[t].label}</option>))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-gray-500">Ritmo
              <select className={field} value={value.speed >= 1.12 ? 'rapido' : value.speed <= 0.93 ? 'calmo' : 'normal'} onChange={(e) => onChange({ ...value, speed: e.target.value === 'rapido' ? 1.15 : e.target.value === 'calmo' ? 0.9 : 1 })}>
                <option value="calmo">Mais calmo</option>
                <option value="normal">Natural</option>
                <option value="rapido">Mais rápido</option>
              </select>
            </label>
            <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 bg-white text-xs" disabled={sampling || (eleven && !value.voice)} onClick={() => void sample()}>{sampling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />} Ouvir amostra</Button>
          </div>
          {!eleven && (
            <label className="block text-[11px] text-gray-500">Direção da voz (opcional)
              <textarea value={value.direction ?? ''} onChange={(e) => onChange({ ...value, direction: e.target.value || undefined })} placeholder="Ex.: comece baixinho, como quem conta um segredo, e cresça até a chamada; pronuncie a marca como “avênce”." className="mt-0.5 min-h-[48px] w-full rounded-md border border-gray-200 p-2 text-xs text-gray-800" />
            </label>
          )}
          {eleven && <BrazilLibrary play={play} onPick={(id, name) => { setVoices(null); onChange({ ...value, voice: id, voiceName: name }) }} />}
          {!eleven && <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-900">As vozes da OpenAI falam português com sotaque estrangeiro. Para voz brasileira de verdade, use a ElevenLabs (vozes da biblioteca do Brasil ou a sua clonada).</p>}
          {eleven && <p className="text-[11px] leading-snug text-gray-500">★ são as suas vozes (clonadas). Na ElevenLabs o jeito de falar vira estabilidade e estilo; o v3 é mais expressivo, o v2 mais constante.</p>}
          <label className="flex items-start gap-2 text-[11px] text-gray-700"><input type="checkbox" className="mt-0.5" checked={value.rewrite !== false} onChange={(e) => onChange({ ...value, rewrite: e.target.checked })} /> <span>Reescrever a fala para soar natural<span className="block text-gray-500">A IA transforma as cenas num monólogo falado e conectado antes de narrar (recomendado).</span></span></label>
        </>
      )}
    </div>
  )
}
