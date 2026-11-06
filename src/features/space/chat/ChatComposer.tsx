import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Check, ExternalLink, Gauge, ImagePlus, Loader2, LogIn, Square, Wand2, X } from 'lucide-react'
import { skillIcon } from '@/features/skills/skillIcon'
import { CHAT_IMAGE_LIMIT, type ChatImageUpload } from './protocol'
import { isChatImage, readChatImage } from './attachments'
import type { ChatSkill } from './skills'

/**
 * A caixa de mensagem dos agentes: a do projeto (SpaceChat) e a da Iara usam a mesma (2026-11-05,
 * o usuário: "aquele campo do projeto deve ser o campo da Iara… enviar foto, escolher skill…
 * use o mesmo"). Skill escolhida em chip, "/" abre skills e comandos, imagens pelo botão, Ctrl+V ou
 * arrastando (o pai chama `addFiles` no drop), e embaixo o que cada chat põe (agente, modo).
 */

/** A tela Skills numa aba nova: o canvas continua aberto. */
export const ManageSkillsLink: React.FC<{ className?: string }> = ({ className }) => (
  <a
    href="/skills"
    target="_blank"
    rel="noreferrer"
    className={`inline-flex items-center gap-1 font-medium text-gray-500 transition-colors hover:text-gray-900 ${className ?? ''}`}
  >
    Gerenciar skills
    <ExternalLink className="h-3 w-3" />
  </a>
)

/** Os comandos do chat dos agentes, no mesmo menu do "/" que as skills. */
const COMMANDS = [
  { id: 'usage', name: '/usage', hint: 'Quanto do plano do agente já foi usado', icon: Gauge },
  { id: 'login', name: '/login', hint: 'Entrar de novo na conta do agente', icon: LogIn },
] as const

type MenuItem = { type: 'skill'; skill: ChatSkill } | { type: 'command'; command: (typeof COMMANDS)[number] }

/** Os grupos do menu, na ordem da lista. */
const MENU_GROUP: Record<ChatSkill['source'] | 'command', string> = {
  personal: 'Suas skills',
  global: 'Da equipe',
  builtin: 'Padrão',
  command: 'Comandos',
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** O que o "/" mostra: skills e comandos que começam (ou têm uma palavra que começa) com o que foi digitado. */
const menuItems = (query: string, skills: ChatSkill[], commands: boolean): MenuItem[] => {
  const q = fold(query)
  const hit = (...names: string[]) => !q || names.some((n) => fold(n).split(/[\s/-]+/).some((word) => word.startsWith(q)) || fold(n).startsWith(q))
  return [
    ...skills.filter((s) => hit(s.name, ...(s.source === 'builtin' ? [s.id] : []))).map((skill): MenuItem => ({ type: 'skill', skill })),
    ...(commands ? COMMANDS.filter((c) => hit(c.id)).map((command): MenuItem => ({ type: 'command', command })) : []),
  ]
}

/** Imagem na caixa, antes de mandar: a prévia local aparece na hora, enquanto a aba reduz a imagem. */
interface Attachment {
  id: string
  name: string
  url: string
  state: 'reading' | 'ready'
  upload?: ChatImageUpload
}

/** Atrás da prévia na caixa: um logo branco recortado continua visível. */
const CHECKER: React.CSSProperties = { background: 'repeating-conic-gradient(#d1d5db 0% 25%, #f3f4f6 0% 50%) 0 0 / 8px 8px' }

export const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

export interface ComposerMessage {
  text: string
  images: ChatImageUpload[]
  skill?: ChatSkill
  /** /usage ou /login: as imagens e a skill ficam para o próximo pedido. */
  command: boolean
}

export interface ChatComposerHandle {
  addFiles: (files: File[]) => void
  focus: () => void
  setDraft: (text: string) => void
  /** Manda um texto pronto (a barrinha do /usage, uma sugestão). */
  send: (text: string) => void
}

export interface ChatComposerProps {
  skills: ChatSkill[]
  skillId: string | null
  onSkill: (id: string | null) => void
  /** Mostrar /usage e /login no menu (só o chat dos agentes do projeto). */
  commands?: boolean
  /** Chips na linha de cima, depois da skill (a seleção do canvas, a tela aberta). */
  chips?: ReactNode
  /** À esquerda, embaixo: o agente, o modo. */
  footer?: ReactNode
  busy: boolean
  onStop: () => void
  /** Não dá para mandar agora (agente indisponível, a Iara ocupada em outra conversa). */
  blocked?: boolean
  sendColor: string
  sendLabel: string
  stopLabel: string
  ariaLabel: string
  placeholder: (state: { attachments: number; skill?: ChatSkill }) => string
  /** Devolve false quando não mandou (a caixa fica como está). */
  onSend: (message: ComposerMessage) => boolean
  rows?: number
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { skills, skillId, onSkill, commands = false, chips, footer, busy, onStop, blocked, sendColor, sendLabel, stopLabel, ariaLabel, placeholder, onSend, rows = 2 },
  ref
) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const skill = skills.find((s) => s.id === skillId)
  const SkillIcon = skill ? skillIcon(skill) : null

  // Imagens da próxima mensagem (botão, Ctrl+V ou arrastar)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const [note, setNote] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Skills e comandos: o menu abre pelo botão ou pelo "/" no começo da caixa
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)
  const slash = /^\/(\S*)$/.exec(draft)
  const menuQuery = slash?.[1] ?? ''
  const showMenu = menuOpen || !!slash
  const items = useMemo(() => (showMenu ? menuItems(menuQuery, skills, commands) : []), [showMenu, menuQuery, skills, commands])
  useEffect(() => setMenuIndex(0), [menuQuery, showMenu])

  // Clique fora fecha o menu aberto pelo botão
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!form.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // O aviso (arquivo que não é imagem, imagem demais) some sozinho
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => setNote(null), 5000)
    return () => clearTimeout(timer)
  }, [note])

  // As prévias locais saem da memória quando a caixa sai da tela
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url)), [])

  // Autoaltura da caixa de texto
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  const addFiles = (files: File[]) => {
    if (!files.length) return
    const images = files.filter(isChatImage)
    const taken = images.slice(0, Math.max(0, CHAT_IMAGE_LIMIT - attachmentsRef.current.length))
    const notes = [
      images.length < files.length ? 'Só imagens: PNG, JPG, WebP ou GIF.' : '',
      taken.length < images.length ? `Até ${CHAT_IMAGE_LIMIT} imagens por mensagem.` : '',
    ].filter(Boolean)
    setNote(notes.length ? notes.join(' ') : null)
    for (const file of taken) {
      const item: Attachment = { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), state: 'reading' }
      attachmentsRef.current = [...attachmentsRef.current, item]
      setAttachments(attachmentsRef.current)
      readChatImage(file).then(
        (upload) => setAttachments((list) => list.map((a) => (a.id === item.id ? { ...a, state: 'ready', upload, name: upload.name } : a))),
        (error) => {
          URL.revokeObjectURL(item.url)
          setAttachments((list) => list.filter((a) => a.id !== item.id))
          setNote(error instanceof Error ? error.message : 'O navegador não conseguiu abrir essa imagem.')
        }
      )
    }
    input.current?.focus()
  }

  const removeAttachment = (id: string) =>
    setAttachments((list) => {
      const gone = list.find((a) => a.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return list.filter((a) => a.id !== id)
    })

  const clearAttachments = () => {
    attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url))
    setAttachments([])
  }

  const ready = attachments.filter((a) => a.state === 'ready' && a.upload)
  const reading = attachments.some((a) => a.state === 'reading')

  const send = (text = draft) => {
    const clean = text.trim()
    const command = commands && /^\/(usage|login)\b/i.test(clean)
    const images = command ? [] : ready.map((a) => a.upload!)
    if ((!clean && !images.length) || busy || blocked || (!command && reading)) return
    if (!onSend({ text: clean, images, skill: command ? undefined : skill, command })) return
    // O /usage da barrinha não apaga o que a pessoa estava escrevendo
    if (text === draft) setDraft('')
    if (images.length) clearAttachments()
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => input.current?.focus(), setDraft, send }))

  /** Item do menu: a skill fica na caixa até a pessoa tirar; o comando vai na hora. */
  const pick = (item: MenuItem) => {
    setMenuOpen(false)
    if (slash) setDraft('')
    if (item.type === 'command') return send(item.command.name)
    onSkill(item.skill.id)
    input.current?.focus()
  }

  const canSend = (!!draft.trim() || ready.length > 0) && !reading && !blocked

  return (
    <form
      ref={form}
      className="relative m-2 shrink-0 rounded-xl border border-gray-200 bg-white transition-[border-color,box-shadow] focus-within:border-gray-300 focus-within:shadow-[0_4px_16px_-6px_rgb(0_0_0/0.16)]"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      {showMenu && <SkillMenu items={items} query={menuQuery} active={menuIndex} chosen={skillId} onActive={setMenuIndex} onPick={pick} />}
      {((skill && SkillIcon) || chips) && (
        <div className="flex items-center gap-1.5 px-2 pt-2">
          {skill && SkillIcon && (
            <span title={skill.hint} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-lg bg-gray-900 pl-2 pr-1 text-[11px] font-medium text-white">
              <SkillIcon className="h-3 w-3" />
              {skill.name}
              <button type="button" aria-label={`Tirar a skill ${skill.name}`} className="rounded p-px opacity-70 transition-opacity hover:bg-white/15 hover:opacity-100" onClick={() => onSkill(null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {chips}
        </div>
      )}
      {(attachments.length > 0 || note) && (
        <div className="px-2 pt-2">
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Imagens que vão com a mensagem">
              {attachments.map((a) => (
                <li key={a.id} title={a.name} className="relative h-14 w-14 overflow-hidden rounded-lg border border-gray-200" style={CHECKER}>
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                  {a.state === 'reading' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Tirar ${a.name}`}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900/75 text-white transition-colors hover:bg-gray-900"
                    onClick={() => removeAttachment(a.id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {note && (
            <p role="status" className="mt-1.5 text-[11px] leading-snug text-amber-700">
              {note}
            </p>
          )}
        </div>
      )}
      <textarea
        ref={input}
        rows={rows}
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder({ attachments: attachments.length, skill })}
        className="block max-h-40 w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
        onChange={(e) => setDraft(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files)
          if (!files.some(isChatImage)) return
          // Imagem copiada: vai como anexo; texto junto (de uma página, de um documento) continua colando
          if (!e.clipboardData.getData('text/plain')) e.preventDefault()
          addFiles(files.filter(isChatImage))
        }}
        onKeyDown={(e) => {
          if (showMenu && items.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const step = e.key === 'ArrowDown' ? 1 : -1
              setMenuIndex((i) => (i + step + items.length) % items.length)
              return
            }
            if ((e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) || e.key === 'Tab') {
              e.preventDefault()
              pick(items[menuIndex] ?? items[0])
              return
            }
          }
          if (e.key === 'Escape' && showMenu) {
            e.preventDefault()
            setMenuOpen(false)
            if (slash) setDraft('')
            return
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        {footer}
        <div className="flex-1" />
        <button
          type="button"
          disabled={attachments.length >= CHAT_IMAGE_LIMIT}
          aria-label="Anexar imagem"
          title={attachments.length >= CHAT_IMAGE_LIMIT ? `Até ${CHAT_IMAGE_LIMIT} imagens por mensagem` : 'Anexar imagem (ou cole com Ctrl+V, ou arraste para cá)'}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          aria-label="Skills e comandos"
          aria-expanded={showMenu}
          title={commands ? 'Skills e comandos (ou digite / na caixa)' : 'Skills (ou digite / na caixa)'}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900 ${showMenu ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
          onClick={() => {
            setMenuOpen((open) => !open)
            input.current?.focus()
          }}
        >
          <Wand2 className="h-4 w-4" />
        </button>
        {busy ? (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white transition-transform hover:bg-gray-700 active:scale-[0.94]"
            aria-label={stopLabel}
            title={stopLabel}
            onClick={onStop}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-[transform,background-color] active:scale-[0.94] disabled:bg-gray-200 disabled:text-gray-400"
            style={canSend ? { background: sendColor } : undefined}
            aria-label={sendLabel}
            title={reading ? 'Preparando a imagem…' : undefined}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  )
})

interface SkillMenuProps {
  items: MenuItem[]
  query: string
  active: number
  chosen: string | null
  onActive: (index: number) => void
  onPick: (item: MenuItem) => void
}

/** Acima da caixa: as skills (ficam ligadas até tirar) e os comandos do chat. Setas, Enter e Esc pelo teclado. */
const SkillMenu: React.FC<SkillMenuProps> = ({ items, query, active, chosen, onActive, onPick }) => {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Skills e comandos"
      className="absolute inset-x-0 bottom-full z-20 mb-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.28)]"
    >
      {items.length === 0 ? (
        <p className="px-2.5 py-2 text-[12px] text-gray-500">Nenhuma skill ou comando com “{query}”.</p>
      ) : (
        items.map((item, i) => {
          const group = (it: MenuItem) => (it.type === 'skill' ? it.skill.source : 'command')
          const header = i === 0 || group(items[i - 1]) !== group(item) ? MENU_GROUP[group(item)] : null
          const Icon = item.type === 'skill' ? skillIcon(item.skill) : item.command.icon
          const name = item.type === 'skill' ? item.skill.name : item.command.name
          const hint = item.type === 'skill' ? item.skill.hint : item.command.hint
          const on = item.type === 'skill' && item.skill.id === chosen
          return (
            <div key={item.type === 'skill' ? item.skill.id : item.command.id}>
              {header && <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{header}</p>}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                data-index={i}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${i === active ? 'bg-gray-100' : ''}`}
                onMouseEnter={() => onActive(i)}
                // A caixa de texto continua com o foco (as setas seguem valendo)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
              >
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1 text-[12px] font-medium text-gray-900 ${item.type === 'command' ? 'font-mono' : ''}`}>
                    {name}
                    {on && <Check className="h-3 w-3 text-emerald-600" aria-label="escolhida" />}
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-500">{hint}</span>
                </span>
              </button>
            </div>
          )
        })
      )}
      <div className="mt-1 flex items-center justify-between border-t border-gray-100 px-2 pb-0.5 pt-1.5 text-[11px] text-gray-400">
        <span>Crie as suas ou importe um SKILL.md</span>
        <ManageSkillsLink />
      </div>
    </div>
  )
}
