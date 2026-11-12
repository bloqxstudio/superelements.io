import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Loader2, Mic, PanelRight, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dictationSupported, useDictation } from '@/features/space/chat/useDictation'
import { useIara } from './store'

/**
 * A Iara fechada (2026-11-12, o usuário, com prints do painel da Hostinger: "quero fazer a Iara como
 * um chat aberto em todas as telas e uma versão expandida"). Uma caixa "Pergunte à Iara" no pé de
 * qualquer tela: o que a pessoa escreve (ou fala) abre o painel lateral já mandando a mensagem; o
 * botão da direita só expande. Nas telas de canvas (projeto, editor, quadro) ela vira um botão no
 * canto, para não cobrir as ferramentas de baixo. O × da caixa (o usuário: "permita também fechar essa
 * tela da Iara") recolhe para o mesmo botão do canto, que traz a caixa de volta (`iara-caixa` = 0).
 */

const readHidden = () => {
  try {
    return localStorage.getItem('iara-caixa') === '0'
  } catch {
    return false
  }
}
const writeHidden = (hidden: boolean) => {
  try {
    localStorage.setItem('iara-caixa', hidden ? '0' : '1')
  } catch {
    // vale até recarregar
  }
}
export const IaraBar: React.FC<{ compact: boolean; placeholder: string }> = ({ compact, placeholder }) => {
  const busy = useIara((s) => s.busy)
  const step = useIara((s) => s.step)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [hidden, setHidden] = useState(readHidden)
  const pill = compact || hidden
  // A caixa abre espaço embaixo do conteúdo, para o fim da página não ficar escondido atrás dela
  useEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-iara-bar', !pill)
    return () => root.removeAttribute('data-iara-bar')
  }, [pill])
  const input = useRef<HTMLTextAreaElement>(null)
  const sendAfterSpeech = useRef(false)

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return useIara.setState({ open: true })
    useIara.getState().ask(t)
    setDraft('')
  }
  const dictation = useDictation(
    (text) => setDraft(text),
    (message) => setNote(message),
    (text) => {
      if (!sendAfterSpeech.current) return input.current?.focus()
      sendAfterSpeech.current = false
      send(text)
    }
  )
  const canDictate = useMemo(dictationSupported, [])

  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(''), 5000)
    return () => clearTimeout(timer)
  }, [note])

  // A caixa cresce com o texto até 4 linhas
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [draft])

  const submit = () => {
    if (dictation.listening) {
      sendAfterSpeech.current = true
      return dictation.stop()
    }
    send(draft)
  }

  if (pill)
    return (
      <button
        type="button"
        onClick={() => {
          if (compact) return useIara.setState({ open: true })
          setHidden(false)
          writeHidden(false)
          setTimeout(() => input.current?.focus(), 0)
        }}
        aria-label={compact ? 'Abrir a Iara (⌘J)' : 'Mostrar a caixa da Iara'}
        title={compact ? 'Abrir a Iara (⌘J)' : 'Mostrar a caixa da Iara'}
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-gray-900 pl-3.5 pr-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)] transition-transform duration-200 ease-out animate-in fade-in-0 slide-in-from-right-12 hover:bg-black active:scale-[0.97] motion-reduce:animate-none"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        </span>
        Iara
      </button>
    )

  const canSend = !!draft.trim() || dictation.listening
  return (
    <div className="se-iara-bar pointer-events-none fixed bottom-4 z-40 flex w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-1.5">
      {(note || busy) && (
        <p role="status" className="pointer-events-auto inline-flex max-w-full items-center gap-1.5 truncate duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none rounded-full bg-gray-900/90 px-3 py-1 text-[11px] font-medium text-white shadow">
          {busy && !note && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />}
          {note || <button type="button" onClick={() => useIara.setState({ open: true })} className="truncate">{step ?? 'A Iara está trabalhando'} · ver</button>}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="pointer-events-auto flex w-full items-end gap-1 duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-12 motion-reduce:animate-none rounded-[22px] border border-gray-200 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.02),0_12px_40px_-12px_rgb(0_0_0/0.28)] backdrop-blur transition-shadow focus-within:border-violet-300 focus-within:shadow-[0_0_0_3px_rgb(139_92_246/0.12),0_12px_40px_-12px_rgb(0_0_0/0.28)]"
      >
        <span className="mb-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white" aria-hidden>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <textarea
          ref={input}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          aria-label="Pergunte à Iara"
          placeholder={dictation.listening ? 'Pode falar… o que você disser aparece aqui' : placeholder}
          className="min-w-0 flex-1 resize-none self-center bg-transparent px-1.5 py-1.5 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-400"
        />
        {canDictate && (
          <button
            type="button"
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start(draft))}
            aria-label={dictation.listening ? 'Parar de ouvir' : 'Falar a mensagem'}
            title={dictation.listening ? 'Parar de ouvir' : 'Falar a mensagem'}
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', dictation.listening ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}
          >
            <Mic className={cn('h-4 w-4', dictation.listening && 'animate-pulse')} aria-hidden />
          </button>
        )}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar à Iara"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-black disabled:bg-gray-100 disabled:text-gray-400"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
        <span className="mx-0.5 mb-2 h-5 w-px shrink-0 self-end bg-gray-200" aria-hidden />
        <button
          type="button"
          onClick={() => useIara.setState({ open: true })}
          aria-label="Expandir a Iara (⌘J)"
          title="Expandir a Iara (⌘J)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <PanelRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (dictation.listening) dictation.stop()
            setHidden(true)
            writeHidden(true)
          }}
          aria-label="Fechar a caixa da Iara"
          title="Fechar a caixa (fica o botão no canto)"
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </form>
    </div>
  )
}
