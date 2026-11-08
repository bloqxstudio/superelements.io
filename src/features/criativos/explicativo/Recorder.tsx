import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Circle, Mic, RotateCcw, Sparkles, Square, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resolveIa } from '@/features/ia/porTarefa'
import { callAiQuiet, useAiAvailable } from '../link'

/**
 * Gravar a fala aqui mesmo: câmera (vídeo vertical) ou só o microfone, com contagem regressiva e
 * um teleprompter que rola sozinho. A fala pode ser escrita pela IA a partir de um assunto, no
 * formato que funciona em reels: gancho, explicação em 3 ou 4 ideias e chamada no fim.
 */

const MIME = {
  video: ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'],
  audio: ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'],
}
const pickMime = (kind: 'video' | 'audio') => MIME[kind].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''

const FALA_SYSTEM = [
  'Você escreve falas para vídeos curtos virais de explicação (reels, TikTok), para a pessoa ler olhando para a câmera. Português do Brasil, falado, frases curtas, sem jargão.',
  'Estrutura: 1) gancho na primeira frase (uma promessa, um erro comum, um número ou uma pergunta que prende); 2) a explicação em 3 ou 4 ideias concretas, uma por frase ou duas; 3) uma chamada no fim (salvar, seguir ou comentar uma palavra).',
  'Entre 70 e 120 palavras (30 a 45 s). Nada de números, preços ou fatos que não estejam no pedido; se precisar de um exemplo, deixe claro que é exemplo.',
  'Responda pelo esquema: `reply` com uma frase; `items` com {"ref": "fala", "text": a fala, em parágrafos curtos}.',
].join('\n')

export const Recorder: React.FC<{ kind: 'video' | 'audio'; brand?: string; onDone: (blob: Blob, name: string) => void; onCancel: () => void }> = ({ kind, brand, onDone, onCancel }) => {
  const ai = useAiAvailable()
  const preview = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const [state, setState] = useState<'idle' | 'count' | 'rec' | 'done'>('idle')
  const [count, setCount] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null)
  const [script, setScript] = useState('')
  const [topic, setTopic] = useState('')
  const [writing, setWriting] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [level, setLevel] = useState(0)
  const prompter = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    let raf = 0
    let audioCtx: AudioContext | undefined
    navigator.mediaDevices
      .getUserMedia(kind === 'video' ? { video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } }, audio: { echoCancellation: true, noiseSuppression: true } } : { audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (preview.current) {
          preview.current.srcObject = s
          void preview.current.play().catch(() => undefined)
        }
        // Medidor do microfone
        audioCtx = new AudioContext()
        const an = audioCtx.createAnalyser()
        an.fftSize = 512
        audioCtx.createMediaStreamSource(s).connect(an)
        const buf = new Uint8Array(an.fftSize)
        const tick = () => {
          an.getByteTimeDomainData(buf)
          let peak = 0
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
          setLevel(peak / 128)
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => toast.error(kind === 'video' ? 'O navegador bloqueou a câmera ou o microfone. Libere no cadeado da barra de endereço.' : 'O navegador bloqueou o microfone. Libere no cadeado da barra de endereço.'))
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      void audioCtx?.close()
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [kind])

  // Cronômetro e teleprompter rolando
  useEffect(() => {
    if (state !== 'rec') return
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const s = (performance.now() - t0) / 1000
      setElapsed(s)
      if (prompter.current) prompter.current.scrollTop = Math.max(0, (s - 1) * 28 * speed)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state, speed])

  const start = () => {
    if (!stream.current) return toast.error('Sem câmera ou microfone.')
    setResult(null)
    setState('count')
    setCount(3)
    if (prompter.current) prompter.current.scrollTop = 0
    let n = 3
    const timer = setInterval(() => {
      n -= 1
      setCount(n)
      if (n > 0) return
      clearInterval(timer)
      chunks.current = []
      const mimeType = pickMime(kind)
      const r = new MediaRecorder(kind === 'video' ? stream.current! : new MediaStream(stream.current!.getAudioTracks()), { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 4_500_000, audioBitsPerSecond: 128_000 })
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: (r.mimeType || mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm')).split(';')[0] })
        setResult({ blob, url: URL.createObjectURL(blob) })
        setState('done')
      }
      r.start(500)
      rec.current = r
      setState('rec')
    }, 1000)
  }
  const stop = () => rec.current?.state === 'recording' && rec.current.stop()

  const writeFala = async () => {
    if (!topic.trim()) return
    setWriting(true)
    try {
      const out = await callAiQuiet<{ items?: { ref: string; text: string }[] }>('agent', { engine: resolveIa('copy'), system: FALA_SYSTEM, prompt: `## Assunto\n${topic.trim()}\n\n## Quem fala\n${brand || '(a pessoa da conta)'}` })
      const text = out.items?.find((i) => i.ref === 'fala')?.text?.trim()
      if (!text) throw new Error('A IA não devolveu a fala.')
      setScript(text)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'A IA não respondeu.')
    } finally {
      setWriting(false)
    }
  }

  const ext = (result?.blob.type || '').includes('mp4') ? (kind === 'video' ? 'mp4' : 'm4a') : 'webm'
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
      <div>
        <div className={cn('relative mx-auto overflow-hidden rounded-2xl bg-gray-900', kind === 'video' ? 'aspect-[9/16] w-full max-w-[320px]' : 'flex h-48 w-full items-center justify-center')}>
          {kind === 'video' ? (
            result ? <video src={result.url} controls playsInline className="h-full w-full object-cover" /> : <video ref={preview} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          ) : result ? (
            <audio src={result.url} controls className="w-11/12" />
          ) : (
            <div className="flex items-end gap-1" aria-hidden>
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="w-1.5 rounded-full bg-violet-400 transition-[height]" style={{ height: 8 + Math.max(0, level * 120 * Math.sin(((i + 1) / 25) * Math.PI)) }} />
              ))}
            </div>
          )}
          {kind === 'video' && script && state !== 'done' && (
            <div ref={prompter} className="absolute inset-x-0 top-0 max-h-[38%] overflow-hidden bg-gradient-to-b from-black/80 to-black/30 px-4 py-3 text-[15px] font-semibold leading-relaxed text-white">
              <div className="pb-40 whitespace-pre-wrap">{script}</div>
            </div>
          )}
          {state === 'count' && <span className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white drop-shadow">{count}</span>}
          {state === 'rec' && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"><Circle className="h-2.5 w-2.5 fill-white" /> {mmss(elapsed)}</span>}
          {kind === 'video' && !result && <span className="pointer-events-none absolute bottom-[44%] left-0 right-0 border-t border-dashed border-white/40" title="Na versão dividida, a animação fica acima desta linha" />}
        </div>
        {kind === 'audio' && script && state !== 'done' && (
          <div ref={prompter} className="mt-3 max-h-40 overflow-hidden rounded-xl bg-gray-900 px-4 py-3 text-[15px] font-semibold leading-relaxed text-white"><div className="pb-32 whitespace-pre-wrap">{script}</div></div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {state === 'idle' && <Button className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={start}><Circle className="h-3.5 w-3.5 fill-white" /> Gravar</Button>}
          {state === 'rec' && <Button className="gap-1.5" onClick={stop}><Square className="h-3.5 w-3.5 fill-white" /> Parar</Button>}
          {state === 'done' && result && (
            <>
              <Button variant="outline" className="gap-1.5 bg-white" onClick={() => { setState('idle'); setResult(null); if (preview.current && stream.current) { preview.current.srcObject = stream.current; void preview.current.play().catch(() => undefined) } }}><RotateCcw className="h-3.5 w-3.5" /> Gravar de novo</Button>
              <Button className="gap-1.5" onClick={() => onDone(result.blob, `fala-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`)}>Usar esta gravação</Button>
            </>
          )}
          <button type="button" className="text-sm text-gray-500 hover:underline" onClick={onCancel}>Cancelar</button>
        </div>
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">{kind === 'video' ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />} Teleprompter (opcional)</p>
        <p className="mt-0.5 text-xs text-gray-500">O texto rola sozinho enquanto você grava. Escreva, cole, ou peça à IA a partir de um assunto.</p>
        <div className="mt-3 flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Assunto. Ex.: 3 erros que fazem o cliente desistir de comprar no direct" className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <Button variant="outline" className="shrink-0 gap-1.5 bg-white" disabled={!ai || writing || !topic.trim()} onClick={() => void writeFala()}><Sparkles className="h-4 w-4" /> {writing ? 'Escrevendo…' : 'Escrever a fala'}</Button>
        </div>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="A fala que você vai ler…" className="mt-2 min-h-[220px] w-full rounded-md border border-gray-200 p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">Velocidade do texto <input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="accent-violet-600" /> {speed.toFixed(1)}×</label>
        {!ai && <p className="mt-2 text-[11px] text-gray-500">Conecte a IA desta máquina para escrever a fala. Gravar funciona sem ela.</p>}
        <p className="mt-3 text-[11px] leading-snug text-gray-500">Dica: fale perto do microfone, num lugar sem eco, e deixe meio segundo de silêncio entre as ideias: é ali que a animação troca de cena.</p>
      </div>
    </div>
  )
}
