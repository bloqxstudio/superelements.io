import React from 'react'
import { Loader2, MessageCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ANSWER_LABEL, firstContact, scrollsTo, type Answer, type CopyReading, type DemandQuestion, type PhoneCapture } from './demand'

/** As peças do diagnóstico de captação: o celular de hoje, a primeira tela reescrita, a página tela a tela e as sete perguntas. */

const ANSWER_TONE: Record<Answer, string> = {
  sim: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  parcial: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  nao: 'bg-rose-50 text-rose-800 ring-rose-600/20',
  aberto: 'bg-gray-50 text-gray-600 ring-gray-500/20',
}

const MARK_TONE: Record<Answer, string> = {
  sim: 'bg-emerald-600',
  parcial: 'bg-amber-500',
  nao: 'bg-rose-600',
  aberto: 'bg-gray-500',
}

const PHONE_WIDTH = 232

const clamp = (value: number) => Math.min(94, Math.max(6, value))

export const PhoneFrame: React.FC<{
  label: string
  children: React.ReactNode
}> = ({ label, children }) => (
  <figure className="flex flex-col items-center gap-2">
    <div className="rounded-[30px] bg-gray-900 p-[7px] shadow-[0_12px_32px_-14px_rgb(0_0_0/0.45)]" style={{ width: PHONE_WIDTH }}>
      <div className="relative overflow-hidden rounded-[24px] bg-white" style={{ aspectRatio: '390 / 844' }}>
        {children}
      </div>
    </div>
    <figcaption className="text-xs font-medium text-gray-600">{label}</figcaption>
  </figure>
)

const Mark: React.FC<{
  n: number
  answer: Answer
  left: number
  top: number
  title: string
}> = ({ n, answer, left, top, title }) => (
  <span
    title={title}
    className={cn('absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md ring-2 ring-white', MARK_TONE[answer])}
    style={{ left: `${clamp(left)}%`, top: `${clamp(top)}%` }}
  >
    {n}
  </span>
)

const byId = (questions: DemandQuestion[], id: DemandQuestion['id']) => questions.find((q) => q.id === id)

/** A primeira tela de hoje, com as marcações das perguntas 1, 2 e 3. */
export const CurrentScreen: React.FC<{
  phone: PhoneCapture
  questions: DemandQuestion[]
}> = ({ phone, questions }) => {
  const { width, height } = phone.viewport
  const q1 = byId(questions, 'entende')
  const q2 = byId(questions, 'whatsapp')
  const q3 = byId(questions, 'rapido')
  const headline = phone.headline && phone.headline.y < height ? phone.headline : undefined
  const whats = firstContact(phone, 'whatsapp')
  const whatsInView = whats && scrollsTo(whats, phone.viewport) === 0 ? whats : undefined
  const scrolls = whats ? scrollsTo(whats, phone.viewport) : 0
  return (
    <>
      <img src={phone.firstScreen} alt="A primeira tela do site num celular" className="absolute inset-0 h-full w-full object-cover object-top" />
      {q3 && phone.lcpMs && (
        <span className={cn('absolute left-2 top-2 inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-white shadow-md', MARK_TONE[q3.answer])}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[9px]">3</span>
          aparece em {(phone.lcpMs / 1000).toFixed(1).replace('.', ',')} s
        </span>
      )}
      {headline && q1 && <Mark n={1} answer={q1.answer} left={((headline.x + headline.w / 2) / width) * 100} top={((headline.y + Math.min(headline.h, 60) / 2) / height) * 100} title={q1.detail} />}
      {whatsInView && q2 && <Mark n={2} answer={q2.answer} left={((whatsInView.x + whatsInView.w / 2) / width) * 100} top={((whatsInView.y + whatsInView.h / 2) / height) * 100} title={q2.detail} />}
      {!whatsInView && q2 && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-rose-600/95 px-2 py-1.5 text-[10px] font-medium leading-tight text-white">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold">2</span>
          {whats ? `O WhatsApp só aparece depois de ${scrolls} ${scrolls === 1 ? 'rolagem' : 'rolagens'}` : 'Sem WhatsApp na página'}
        </div>
      )}
    </>
  )
}

export const ScreenWaiting: React.FC<{ text: string }> = ({ text }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
    <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
    <p className="text-xs leading-5 text-gray-500">{text}</p>
  </div>
)

export const ScreenNote: React.FC<{ text: string; onRetry?: () => void }> = ({ text, onRetry }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
    <p className="text-xs leading-5 text-gray-600">{text}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 active:scale-[0.96]"
      >
        <RotateCcw className="h-3 w-3" aria-hidden /> Tentar de novo
      </button>
    )}
  </div>
)

/** A primeira tela reescrita pela leitura do texto: só o texto, num desenho neutro. */
export const RewriteScreen: React.FC<{ copy: CopyReading; name: string }> = ({ copy, name }) => (
  <div className="absolute inset-0 flex flex-col bg-white">
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <span className="truncate text-[11px] font-semibold text-gray-900">{name}</span>
      <span className="flex flex-col gap-[3px]" aria-hidden>
        <span className="h-[1.5px] w-3.5 bg-gray-700" />
        <span className="h-[1.5px] w-3.5 bg-gray-700" />
      </span>
    </div>
    <div className="flex flex-1 flex-col justify-center gap-3 px-5">
      {copy.rewrite.eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{copy.rewrite.eyebrow}</p>}
      <p className="text-balance text-[21px] font-semibold leading-[1.15] tracking-tight text-gray-900">{copy.rewrite.title}</p>
      <p className="text-[12px] leading-[1.5] text-gray-600">{copy.rewrite.subtitle}</p>
      <span className="mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-4 text-[13px] font-semibold text-[#06361b]">
        <MessageCircle className="h-4 w-4" aria-hidden /> {copy.rewrite.button}
      </span>
    </div>
    <p className="px-4 pb-3 text-center text-[9px] leading-4 text-gray-400">Rascunho do texto, feito a partir do que o site diz: conferir antes de usar. O desenho vem na página nova.</p>
  </div>
)

/** A página tela a tela, com as dobras numeradas e onde aparece o primeiro contato. */
export const PageStrip: React.FC<{ phone: PhoneCapture }> = ({ phone }) => {
  if (!phone.strip) return null
  const width = 92
  const k = width / phone.viewport.width
  const whats = firstContact(phone, 'whatsapp')
  const contact = whats ?? firstContact(phone)
  const inFirst = contact ? scrollsTo(contact, phone.viewport) === 0 : false
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="overflow-y-auto rounded-xl bg-gray-900 p-1.5" style={{ maxHeight: (PHONE_WIDTH - 14) * (844 / 390) + 14 }}>
        <div className="relative" style={{ width }}>
          {phone.strip.screens.map((screen, i) => (
            <img key={i} src={screen.image} alt="" className="block" style={{ width, height: screen.height * k }} />
          ))}
          {phone.strip.screens.slice(1).map((_, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-dashed border-white/80" style={{ top: (i + 1) * phone.viewport.height * k }}>
              <span className="absolute -top-2 left-1 rounded bg-gray-900 px-1 text-[9px] font-medium leading-4 text-white">{i + 2}</span>
            </div>
          ))}
          {contact && !inFirst && !contact.fixed && contact.y < phone.strip.height && (
            <span
              className="absolute right-1 flex -translate-y-1/2 items-center gap-1 rounded-full bg-[#25D366] px-1.5 py-0.5 text-[9px] font-semibold text-[#06361b] shadow"
              style={{ top: (contact.y + contact.h / 2) * k }}
            >
              {contact.kind === 'whatsapp' ? 'WhatsApp' : contact.kind === 'phone' ? 'Telefone' : contact.kind === 'form' ? 'Formulário' : 'E-mail'}
            </span>
          )}
        </div>
      </div>
      <figcaption className="text-xs font-medium text-gray-600">A página, tela a tela</figcaption>
    </figure>
  )
}

export const QuestionList: React.FC<{ questions: DemandQuestion[] }> = ({ questions }) => (
  <ol className="-my-3 divide-y divide-gray-100">
    {questions.map((q) => (
      <li key={q.id} className="flex gap-3 py-3">
        <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', MARK_TONE[q.answer])}>{q.n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-gray-900">{q.question}</p>
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', ANSWER_TONE[q.answer])}>
              {q.pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {q.pending ? 'Lendo' : ANSWER_LABEL[q.answer]}
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-6 text-gray-600">{q.detail}</p>
        </div>
      </li>
    ))}
  </ol>
)

/** O que o visitante entende e os trechos que atrapalham. */
export const CopyFindings: React.FC<{ copy: CopyReading }> = ({ copy }) => (
  <div className="space-y-4">
    <blockquote className="rounded-lg bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800">
      <span className="block text-xs font-medium text-gray-500">Quem chega entende, em 5 segundos</span>"{copy.understood}"
    </blockquote>
    {copy.issues.length > 0 && (
      <ul className="space-y-3">
        {copy.issues.map((issue) => (
          <li key={issue.quote} className="border-l-2 border-rose-300 pl-3">
            <p className="text-sm italic text-gray-900">"{issue.quote}"</p>
            <p className="mt-0.5 text-sm leading-6 text-gray-600">{issue.problem}</p>
          </li>
        ))}
      </ul>
    )}
  </div>
)
