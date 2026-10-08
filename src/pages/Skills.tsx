import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CircleAlert, FileUp, ImagePlus, Plus, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { CHAT_SKILLS, type ChatSkill } from '@/features/space/chat/skills'
import { SkillEditor, type SkillEditorState } from '@/features/skills/SkillEditor'
import { readSkillFile } from '@/features/skills/skillFiles'
import { SOURCE_LABEL, skillIcon } from '@/features/skills/skillIcon'
import { useSkills, watchSkills } from '@/features/skills/skillsStore'

/**
 * Skills: o jeito de trabalhar que o agente segue no chat do canvas. As
 * padrão vêm com o Superelements; as da equipe valem para todas as contas
 * (só admin cria e muda); as suas, só para você. Uma skill do Claude Code
 * entra importando o SKILL.md.
 */

const updated = (at?: number) => (at ? new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '')

const SkillCard: React.FC<{ skill: ChatSkill; onOpen: () => void }> = ({ skill, onOpen }) => {
  const Icon = skillIcon(skill)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-h-[148px] flex-col rounded-xl bg-white p-4 text-left shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)] transition-[box-shadow,transform] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_6px_16px_-6px_rgb(0_0_0/0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700 ring-1 ring-gray-200">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{skill.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-gray-500">{skill.hint || 'Sem a linha do que ela faz.'}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-[11px] text-gray-500">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-medium',
            skill.source === 'personal' ? 'bg-gray-900 text-white' : skill.source === 'global' ? 'bg-violet-50 text-violet-800' : 'bg-gray-100 text-gray-700'
          )}
        >
          {SOURCE_LABEL[skill.source]}
        </span>
        {skill.needsImage && (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5">
            <ImagePlus className="h-3 w-3" />
            Pede imagem
          </span>
        )}
        {skill.starters.length > 0 && (
          <span>
            {skill.starters.length} {skill.starters.length === 1 ? 'pedido pronto' : 'pedidos prontos'}
          </span>
        )}
        {skill.updatedAt && <span className="ml-auto tabular-nums text-gray-400">{updated(skill.updatedAt)}</span>}
      </div>
    </button>
  )
}

const Section: React.FC<{ title: string; hint: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, hint, action, children }) => (
  <section className="mt-10">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{hint}</p>
      </div>
      {action}
    </div>
    {children}
  </section>
)

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>

export default function Skills() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const custom = useSkills((s) => s.custom)
  const status = useSkills((s) => s.status)
  const error = useSkills((s) => s.error)
  const [editor, setEditor] = useState<SkillEditorState>({ open: false })
  const importRef = useRef<HTMLInputElement>(null)
  useEffect(() => watchSkills(), [])

  const mine = custom.filter((s) => s.source === 'personal')
  const team = custom.filter((s) => s.source === 'global')
  const tableReady = status === 'ready'
  const loading = status === 'idle' || status === 'loading'

  const open = (skill: ChatSkill) => setEditor({ open: true, skill })
  const create = (scope: 'personal' | 'global' = 'personal') => setEditor({ open: true, scope })
  const duplicate = (skill: ChatSkill) =>
    setEditor({
      open: true,
      scope: 'personal',
      initial: { name: `${skill.name} (cópia)`.slice(0, 60), hint: skill.hint, instructions: skill.instructions, starters: skill.starters, needsImage: !!skill.needsImage },
    })

  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setEditor({ open: true, scope: 'personal', initial: await readSkillFile(file) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler o arquivo.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="min-h-[calc(100vh-57px)] bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Skills</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              O jeito de trabalhar que o agente segue no chat do canvas. Escolha uma no chat pelo botão{' '}
              <Wand2 className="-mt-0.5 inline h-3.5 w-3.5" aria-label="da varinha" /> ou digitando <code className="rounded bg-gray-100 px-1 font-mono text-[12px] text-gray-700">/</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5 bg-white" onClick={() => importRef.current?.click()} disabled={!tableReady}>
              <FileUp className="h-4 w-4" />
              Importar SKILL.md
            </Button>
            <input ref={importRef} type="file" accept=".md,.markdown,text/markdown,text/plain" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
            <Button className="gap-1.5" onClick={() => create()} disabled={!tableReady}>
              <Plus className="h-4 w-4" />
              Nova skill
            </Button>
          </div>
        </div>

        {status === 'missing' && (
          <div role="status" className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Para criar e guardar skills, falta aplicar a migração <code className="font-mono text-[12px]">20261008120000_space_skills.sql</code> no Supabase. As padrão já
              funcionam no chat.
            </p>
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">Não foi possível ler as skills da conta. {error}</p>
            <Button size="sm" variant="outline" className="bg-white" onClick={() => void useSkills.getState().load(true)}>
              Tentar de novo
            </Button>
          </div>
        )}

        <Section title="Suas skills" hint="Só você vê e usa. Traga uma skill que você já usa no Claude Code importando o SKILL.md.">
          {loading ? (
            <Grid>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[148px] animate-pulse rounded-xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]" />
              ))}
            </Grid>
          ) : mine.length ? (
            <Grid>
              {mine.map((skill) => (
                <SkillCard key={skill.id} skill={skill} onOpen={() => open(skill)} />
              ))}
            </Grid>
          ) : (
            <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-gray-500 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.08)]">
                <Wand2 className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">Nenhuma skill sua ainda</h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Escreva o seu jeito de montar um tipo de site, ou importe o SKILL.md de uma skill do Claude Code. Também dá para duplicar uma padrão e ajustar.
              </p>
              <div className="mt-5 flex gap-2">
                <Button variant="outline" className="gap-1.5 bg-white" onClick={() => importRef.current?.click()} disabled={!tableReady}>
                  <FileUp className="h-4 w-4" />
                  Importar SKILL.md
                </Button>
                <Button className="gap-1.5" onClick={() => create()} disabled={!tableReady}>
                  <Plus className="h-4 w-4" />
                  Criar skill
                </Button>
              </div>
            </div>
          )}
        </Section>

        {(team.length > 0 || isAdmin) && (
          <Section
            title="Da equipe"
            hint={isAdmin ? 'Valem para todas as contas. Só admin cria e muda: você pode.' : 'Valem para todas as contas. Só admin cria e muda.'}
            action={
              isAdmin && (
                <Button variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => create('global')} disabled={!tableReady}>
                  <Plus className="h-3.5 w-3.5" />
                  Nova skill da equipe
                </Button>
              )
            }
          >
            {team.length ? (
              <Grid>
                {team.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onOpen={() => open(skill)} />
                ))}
              </Grid>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                Nenhuma skill da equipe ainda. A que você criar aqui aparece no chat de todo mundo.
              </p>
            )}
          </Section>
        )}

        <Section title="Padrão" hint="Vêm com o Superelements e valem para todos. Duplique uma para fazer a sua versão.">
          <Grid>
            {CHAT_SKILLS.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onOpen={() => open(skill)} />
            ))}
          </Grid>
        </Section>

        <p className="mt-10 text-xs text-gray-400">
          Do SKILL.md vêm o nome, a descrição e o texto. Arquivos de apoio da skill (scripts, referências, modelos) não vêm junto.
        </p>
      </div>

      <SkillEditor {...editor} onOpenChange={(open) => setEditor((e) => ({ ...e, open }))} isAdmin={isAdmin} tableReady={tableReady} onDuplicate={duplicate} />
    </div>
  )
}
