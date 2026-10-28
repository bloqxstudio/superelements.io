import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/**
 * Gravar uma mensagem de voz na conversa do WhatsApp: o microfone começa a gravar,
 * a pessoa cancela ou envia. O navegador entrega WebM/Opus (Chrome, Firefox) ou MP4
 * (Safari); o serviço converte para o OGG/Opus que o WhatsApp toca como voz.
 */

/** Passou disso, o envio para sozinho (o arquivo fica longe do limite de 25 MB) */
const MAX_SECONDS = 5 * 60

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const pickType = () => ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))

export const VoiceRecorder: React.FC<{ disabled?: boolean; onVoice: (file: File) => void; onActive: (active: boolean) => void }> = ({ disabled, onVoice, onActive }) => {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder>()
  const stream = useRef<MediaStream>()
  const chunks = useRef<Blob[]>([])
  const send = useRef(false)
  // Quem chama passa funções novas a cada renderização: guardá-las aqui mantém `release` estável
  const callbacks = useRef({ onActive, onVoice })
  callbacks.current = { onActive, onVoice }

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = undefined
    recorder.current = undefined
    setRecording(false)
    setSeconds(0)
    callbacks.current.onActive(false)
  }, [])

  // Saiu da conversa no meio da gravação: solta o microfone e descarta
  useEffect(
    () => () => {
      send.current = false
      stream.current?.getTracks().forEach((track) => track.stop())
    },
    []
  )

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  const stop = useCallback((deliver: boolean) => {
    send.current = deliver
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop(true)
  }, [recording, seconds, stop])

  const start = async () => {
    const type = pickType()
    if (!navigator.mediaDevices?.getUserMedia || !type) return void toast.error('Este navegador não grava áudio.', { description: 'Use o Chrome, o Edge, o Firefox ou o Safari atualizados.' })
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      chunks.current = []
      const next = new MediaRecorder(media, { mimeType: type })
      next.ondataavailable = (event) => event.data.size && chunks.current.push(event.data)
      next.onstop = () => {
        const deliver = send.current
        const blob = new Blob(chunks.current, { type: type.split(';')[0] })
        release()
        if (!deliver || blob.size < 1000) return
        const ext = type.startsWith('audio/mp4') ? 'm4a' : type.startsWith('audio/ogg') ? 'ogg' : 'webm'
        callbacks.current.onVoice(new File([blob], `voz-${Date.now()}.${ext}`, { type: blob.type }))
      }
      recorder.current = next
      next.start()
      setRecording(true)
      callbacks.current.onActive(true)
    } catch (error) {
      release()
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      toast.error(denied ? 'O navegador bloqueou o microfone.' : 'Não consegui usar o microfone.', { description: denied ? 'Libere o microfone para este site (ícone de cadeado, na barra de endereço) e tente de novo.' : undefined })
    }
  }

  if (!recording) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void start()} aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz">
        <Mic className="h-4 w-4" aria-hidden />
      </Button>
    )
  }

  return (
    <div className="flex min-h-9 flex-1 items-center gap-3 rounded-lg bg-red-50 px-3 text-sm text-red-700" role="status">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
      <span className="tabular-nums" aria-label={`Gravando há ${clock(seconds)}`}>
        {clock(seconds)}
      </span>
      <span className="flex-1 text-xs text-red-600/80">Gravando…</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => stop(false)} aria-label="Cancelar a gravação" title="Cancelar">
        <X className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" size="sm" onClick={() => stop(true)} aria-label="Enviar a mensagem de voz" title="Enviar">
        <Send className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}
