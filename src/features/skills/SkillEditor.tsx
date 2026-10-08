import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, FileUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MAX_SKILL_TEXT, parseSkillMarkdown, type ChatSkill, type SkillDraft } from '@/features/space/chat/skills'
import { canEditSkill, downloadSkill, readSkillFile } from './skillFiles'
import { SOURCE_LABEL, skillIcon } from './skillIcon'
import { useSkills } from './skillsStore'
import type { SkillScope } from './storage'

/**
 * Uma skill aberta: criar, mudar, ou só ver (as padrão e as da equipe, para
 * quem não é admin), com importar e baixar o `SKILL.md` do Claude Code.
 */

export interface SkillEditorState {
  open: boolean
  /** A skill aberta; sem ela, uma nova. */
  skill?: ChatSkill
  /** O começo de uma nova: um SKILL.md importado ou a cópia de outra. */
  initial?: SkillDraft
  scope?: SkillScope
}

interface SkillEditorProps extends SkillEditorState {
  onOpenChange: (open: boolean) => void
  /** Pode criar e mudar as globais. */
  isAdmin: boolean
  /** A tabela existe no banco (a migração foi aplicada). */
  tableReady: boolean
  /** Abre uma cópia editável da skill, como sua. */
  onDuplicate: (skill: ChatSkill) => void
}

const EMPTY: SkillDraft = { name: '', hint: '', instructions: '', starters: [], needsImage: false }

const draftOf = (skill: ChatSkill): SkillDraft => ({
  name: skill.name,
  hint: skill.hint,
  instructions: skill.instructions,
  starters: skill.starters,
  needsImage: !!skill.needsImage,
})

export const SkillEditor: React.FC<SkillEditorProps> = ({ open, onOpenChange, skill, initial, scope: initialScope, isAdmin, tableReady, onDuplicate }) => {
  const editable = !skill || canEditSkill(skill, isAdmin)
  const [draft, setDraft] = useState<SkillDraft>(EMPTY)
  const [startersText, setStartersText] = useState('')
  const [scope, setScope] = useState<SkillScope>('personal')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Cada abertura começa da skill (ou do rascunho) de agora
  useEffect(() => {
    if (!open) return
    const start = skill ? draftOf(skill) : (initial ?? EMPTY)
    setDraft(start)
    setStartersText(start.starters.join('\n'))
    setScope(skill?.source === 'global' ? 'global' : (initialScope ?? 'personal'))
    setConfirmDelete(false)
  }, [open, skill, initial, initialScope])

  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const set = (patch: Partial<SkillDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const starters = startersText.split('\n').map((s) => s.trim()).filter(Boolean)
  const valid = !!draft.name.trim() && !!draft.instructions.trim() && starters.length <= 6
  const Icon = skill ? skillIcon(skill) : skillIcon({ id: '', source: scope })

  const fill = (next: SkillDraft) => {
    setDraft(next)
    setStartersText(next.starters.join('\n'))
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      fill(await readSkillFile(file))
      toast.success('SKILL.md importado', { description: 'Confira o nome e a linha do que ela faz antes de salvar.' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não consegui ler o arquivo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const saved = await useSkills.getState().save({ ...draft, starters }, scope, skill?.id)
      toast.success(skill ? 'Skill salva' : 'Skill criada', { description: `${saved.name} já aparece no chat do canvas.` })
      onOpenChange(false)
    } catch (error) {
      toast.error('Não foi possível salvar a skill', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!skill) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await useSkills.getState().remove(skill.id)
      toast.success(`${skill.name} foi apagada`)
      onOpenChange(false)
    } catch (error) {
      toast.error('Não foi possível apagar a skill', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const title = !skill ? (scope === 'global' ? 'Nova skill da equipe' : 'Nova skill') : editable ? 'Editar skill' : skill.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700 ring-1 ring-gray-200">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{title}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {skill && !editable
                  ? `${SOURCE_LABEL[skill.source]}: ${skill.source === 'builtin' ? 'vem com o Superelements.' : 'só admin muda.'} Duplique para fazer a sua versão.`
                  : 'O agente recebe as instruções junto com o pedido, no chat do canvas.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {editable ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="skill-name">Nome</Label>
                  <Input id="skill-name" value={draft.name} maxLength={60} placeholder="Landing de clínica" onChange={(e) => set({ name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="skill-hint">O que ela faz</Label>
                  <Input
                    id="skill-hint"
                    value={draft.hint}
                    maxLength={200}
                    placeholder="Uma linha: aparece no menu do chat"
                    onChange={(e) => set({ hint: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="skill-instructions">Instruções para o agente</Label>
                  <span className={cn('text-[11px] tabular-nums', draft.instructions.length > MAX_SKILL_TEXT * 0.9 ? 'text-amber-700' : 'text-gray-400')}>
                    {draft.instructions.length.toLocaleString('pt-BR')} / {MAX_SKILL_TEXT.toLocaleString('pt-BR')}
                  </span>
                </div>
                <Textarea
                  id="skill-instructions"
                  value={draft.instructions}
                  maxLength={MAX_SKILL_TEXT}
                  rows={14}
                  spellCheck={false}
                  placeholder={
                    'Escreva como se falasse com alguém da equipe: o que olhar, em que ordem, o que sempre fazer e o que nunca fazer.\n\n' +
                    'Ex.: 1. Antes de mexer, veja a seção no desktop e no celular.\n2. Títulos curtos, com o benefício para quem lê.\n3. Nunca invente preço, depoimento ou número.'
                  }
                  className="min-h-[260px] resize-y font-mono text-[12.5px] leading-relaxed"
                  onChange={(e) => set({ instructions: e.target.value })}
                  onPaste={(e) => {
                    // Colou um SKILL.md inteiro na caixa vazia: vira os campos
                    const text = e.clipboardData.getData('text/plain')
                    if (draft.instructions.trim() || !/^\uFEFF?---\r?\n[\s\S]*?\n---/.test(text)) return
                    e.preventDefault()
                    const parsed = parseSkillMarkdown(text)
                    fill({ ...parsed, name: draft.name.trim() || parsed.name, hint: draft.hint.trim() || parsed.hint })
                  }}
                />
                <p className="text-[12px] leading-relaxed text-gray-500">
                  O agente já sabe mexer no canvas, ler a marca do projeto e conferir a página: aqui vai o seu jeito de trabalhar. Cole um SKILL.md inteiro na caixa vazia, ou importe o arquivo, e os campos se preenchem.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="skill-starters">Pedidos prontos</Label>
                <Textarea
                  id="skill-starters"
                  value={startersText}
                  rows={3}
                  placeholder={'Um por linha, até 6. Aparecem como sugestões no chat.\nMonte a home completa para esta clínica'}
                  className="resize-y text-[13px]"
                  onChange={(e) => setStartersText(e.target.value)}
                />
                {starters.length > 6 && <p className="text-[12px] text-amber-700">Até 6 pedidos prontos: tire {starters.length - 6}.</p>}
              </div>

              <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 px-3.5 py-3">
                <span>
                  <span className="block text-sm font-medium text-gray-900">Pede uma imagem</span>
                  <span className="block text-[12px] text-gray-500">A caixa do chat pede a imagem de referência quando esta skill está escolhida.</span>
                </span>
                <Switch checked={draft.needsImage} onCheckedChange={(needsImage) => set({ needsImage })} />
              </label>

              {isAdmin && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-gray-900">Quem usa</legend>
                  <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { id: 'personal', label: 'Só eu', text: 'Aparece só no seu chat.' },
                        { id: 'global', label: 'Todas as contas', text: 'Da equipe: aparece no chat de todo mundo.' },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={scope === option.id}
                        // Uma global continua global (outros já usam); para ter só sua, duplique
                        disabled={skill?.source === 'global' && option.id === 'personal'}
                        onClick={() => setScope(option.id)}
                        className={cn(
                          'rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          scope === option.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                        <span className="block text-[12px] text-gray-500">{option.text}</span>
                      </button>
                    ))}
                  </div>
                  {scope === 'global' && (
                    <p className="text-[12px] leading-relaxed text-amber-800">
                      As instruções vão para o agente no computador de quem escolher a skill. Escreva só o que a equipe assinaria.
                    </p>
                  )}
                </fieldset>
              )}
            </>
          ) : (
            skill && (
              <>
                {skill.hint && <p className="text-sm text-gray-700">{skill.hint}</p>}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-900">Instruções para o agente</p>
                  <pre className="max-h-[360px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-3.5 font-mono text-[12.5px] leading-relaxed text-gray-800">
                    {skill.instructions}
                  </pre>
                </div>
                {skill.starters.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-gray-900">Pedidos prontos</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {skill.starters.map((text) => (
                        <li key={text} className="rounded-full border border-gray-200 px-2.5 py-1 text-[12px] text-gray-700">
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {skill.needsImage && <p className="text-[12px] text-gray-500">Pede uma imagem de referência no chat.</p>}
              </>
            )
          )}
        </div>

        <DialogFooter className="flex-row flex-wrap items-center gap-2 border-t bg-gray-50/60 px-6 py-3.5 sm:justify-between sm:space-x-0">
          <div className="flex flex-wrap items-center gap-1">
            {editable && (
              <>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-3.5 w-3.5" />
                  Importar SKILL.md
                </Button>
                <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown,text/plain" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
              </>
            )}
            {(skill || draft.instructions.trim()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                title="Para usar no Claude Code: .claude/skills/<nome>/SKILL.md"
                onClick={() => downloadSkill(editable ? draft : skill!)}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar SKILL.md
              </Button>
            )}
            {skill && editable && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('gap-1.5', confirmDelete ? 'bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800' : 'text-gray-600 hover:text-red-700')}
                onClick={remove}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? 'Clique de novo para apagar' : 'Apagar'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editable ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={save} disabled={!valid || saving || !tableReady} title={tableReady ? undefined : 'Falta aplicar a migração das skills no Supabase'}>
                  {saving ? 'Salvando…' : skill ? 'Salvar' : 'Criar skill'}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                {skill && (
                  <Button type="button" className="gap-1.5" onClick={() => onDuplicate(skill)} disabled={!tableReady}>
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar para mim
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
