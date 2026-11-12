import React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowUpRight, LayoutGrid, Sparkles } from 'lucide-react'
import { useMenuBadges } from '@/features/crm/menuBadges'
import { plural } from '@/features/crm/ui'
import { useIara } from '@/features/iara/store'
import { MODULE_PROMPTS, SCREEN_INFO, useMenuModules } from '@/features/navigation/moduleHome'

/**
 * Visão geral de um módulo (`/modulo/:moduleId`): a tela em que se cai ao abrir o módulo, com só as
 * telas dele, o que há de novo em cada uma e pedidos de partida à Iara. Nenhuma tela vem destacada:
 * todas têm o mesmo peso (o usuário não quer levar as pessoas direto ao Cérebro, o mais pesado).
 */

/** O que há de novo numa tela (os mesmos avisos do menu). */
const ScreenNews: React.FC<{ to: string }> = ({ to }) => {
  const b = useMenuBadges((s) => s)
  const parts: string[] = []
  if (to === '/crm' && b.opportunities > 0) parts.push(plural(b.opportunities, 'novidade no funil', 'novidades no funil'))
  if (to === '/crm/whatsapp' && b.whatsapp > 0) parts.push(plural(b.whatsapp, 'mensagem não lida', 'mensagens não lidas'))
  if (to === '/crm/instagram' && b.followers > 0) parts.push(plural(b.followers, 'seguidor novo', 'seguidores novos'))
  if (to === '/crm/site' && b.live > 0) parts.push(b.live === 1 ? '1 pessoa no site agora' : `${b.live} pessoas no site agora`)
  if (to === '/crm/site' && b.contacts > 0) parts.push(plural(b.contacts, 'contato novo', 'contatos novos'))
  if (!parts.length) return null
  return (
    <span className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-violet-600" />
      {parts.join(' · ')}
    </span>
  )
}

const ModuleHome: React.FC = () => {
  const { moduleId } = useParams()
  const modules = useMenuModules((s) => s.modules)
  const module = modules.find((m) => m.id === moduleId)
  // O menu ainda não montou os módulos da conta
  if (!modules.length) return <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10" aria-busy />
  if (!module) return <Navigate to="/inicio" replace />
  const Icon = module.icon
  const prompts = MODULE_PROMPTS[module.id] ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <header className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/.25),0_1px_2px_rgb(0_0_0/.12)]" style={{ background: module.color }} aria-hidden>
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Módulo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{module.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{module.hint}</p>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="module-screens">
        <h2 id="module-screens" className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <LayoutGrid className="h-4 w-4 text-gray-400" aria-hidden /> {plural(module.items.length, 'tela', 'telas')} neste módulo
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {module.items.map((item) => {
            const info = SCREEN_INFO[item.to]
            const ItemIcon = info?.icon ?? LayoutGrid
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-gray-300 hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 active:scale-[0.99]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition-colors group-hover:bg-gray-900 group-hover:text-white" aria-hidden>
                      <ItemIcon className="h-4 w-4" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-gray-300 transition-[color,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-700" aria-hidden />
                  </span>
                  <span className="mt-3 text-[15px] font-semibold text-gray-900">{item.label}</span>
                  {info && <span className="mt-1 text-sm leading-snug text-gray-500">{info.desc}</span>}
                  <ScreenNews to={item.to} />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {prompts.length > 0 && (
        <section className="mt-10" aria-labelledby="module-iara">
          <h2 id="module-iara" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Sparkles className="h-4 w-4 text-violet-500" aria-hidden /> Peça à Iara
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => useIara.getState().ask(p)}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
              >
                {p}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default ModuleHome
