import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Falar com a Iara (2026-11-07, o usuário: "permita enviar audio para a iara"). Os agentes desta
 * máquina (Claude Code, Codex) não ouvem áudio, então a fala vira texto na própria caixa, pelo
 * reconhecimento de voz do navegador (Chrome, Edge, Safari; em português do Brasil), ao vivo:
 * a pessoa vê o que foi entendido, corrige se quiser e manda. Sem chave, sem serviço novo.
 */

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

const RecognitionCtor = (): (new () => Recognition) | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, new () => Recognition>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const dictationSupported = () => !!RecognitionCtor()

const ERRORS: Record<string, string> = {
  'not-allowed': 'O navegador bloqueou o microfone. Libere no cadeado da barra de endereço e tente de novo.',
  'service-not-allowed': 'O navegador bloqueou o microfone. Libere no cadeado da barra de endereço e tente de novo.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de voz precisa de internet.',
  'language-not-supported': 'O navegador não reconhece português.',
}

/**
 * `base` é o texto que já estava na caixa quando a pessoa começou a falar; a cada trecho
 * reconhecido `onText` recebe a caixa inteira (o que estava + o que foi falado até agora).
 */
export function useDictation(onText: (text: string) => void, onError: (message: string) => void, onEnd?: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const base = useRef('')
  const finals = useRef('')
  const callbacks = useRef({ onText, onError, onEnd })
  callbacks.current = { onText, onError, onEnd }

  const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ')

  const stop = useCallback(() => {
    rec.current?.stop()
  }, [])

  const start = useCallback((current: string) => {
    const Ctor = RecognitionCtor()
    if (!Ctor) return callbacks.current.onError('Este navegador não transforma voz em texto. Use o Chrome, o Edge ou o Safari.')
    if (rec.current) return
    const r = new Ctor()
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = true
    base.current = current
    finals.current = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finals.current = join(finals.current, res[0].transcript)
        else interim = join(interim, res[0].transcript)
      }
      callbacks.current.onText(join(base.current, finals.current, interim))
    }
    r.onerror = (e) => {
      // Silêncio e cancelamento não são erro para quem está falando
      if (e.error === 'no-speech' || e.error === 'aborted') return
      callbacks.current.onError(ERRORS[e.error] ?? 'Não consegui ouvir agora. Tente de novo.')
    }
    r.onend = () => {
      // O que ainda estava "em andamento" some no fim: a caixa fica com o que foi confirmado
      const text = join(base.current, finals.current)
      if (finals.current || base.current) callbacks.current.onText(text)
      rec.current = null
      setListening(false)
      callbacks.current.onEnd?.(text)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      rec.current = null
      callbacks.current.onError('Não consegui usar o microfone.')
    }
  }, [])

  // A caixa saiu da tela no meio da fala: solta o microfone
  useEffect(() => () => rec.current?.abort(), [])

  return { listening, start, stop }
}
