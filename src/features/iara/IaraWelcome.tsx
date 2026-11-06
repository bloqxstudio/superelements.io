import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Compass, Eye, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { readScreen, type ScreenSnapshot } from './screens'

/**
 * A conversa vazia da Iara (2026-11-05, o usuário: "crie uma tela de conversa vazia… quero que a
 * Iara saiba em qual tela estamos e o que queremos fazer, me dê contexto daquela tela, veja o que
 * eu estou procurando"). Cumprimenta pelo nome, diz em que tela a pessoa está e para que ela serve,
 * e mostra o que a Iara está vendo ali (aba, período, filtro, busca, o que está aberto), lido da
 * página e atualizado enquanto a pessoa mexe. As sugestões da tela vêm logo abaixo (no chat).
 */

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export const IaraWelcome: React.FC = () => {
  const { pathname, search } = useLocation()
  const { profile, user } = useAuth()
  const first = (profile?.name ?? user?.email ?? '').split(/[\s@.]/)[0]
  const name = first ? first[0].toUpperCase() + first.slice(1) : ''
  const [snap, setSnap] = useState<ScreenSnapshot>(() => readScreen())

  // A página muda (filtro, aba, busca): a leitura acompanha
  useEffect(() => {
    const read = () => setSnap(readScreen())
    const first = setTimeout(read, 300)
    const timer = setInterval(read, 2000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [pathname, search])

  const where = snap.info?.name ?? snap.heading ?? 'esta tela'
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[15px] font-semibold text-gray-900">
          {greeting()}
          {name ? `, ${name}` : ''}.
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">Em que posso ajudar aqui? Peça em poucas palavras: eu leio a tela, os seus números e o plano da conta.</p>
      </div>
      <section aria-label="O que a Iara está vendo" className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          <Compass className="h-3.5 w-3.5" aria-hidden /> Você está em
        </p>
        <p className="mt-1 text-[14px] font-semibold text-gray-900">{where}</p>
        {snap.info && <p className="mt-0.5 text-[12px] leading-snug text-gray-600">{snap.info.purpose[0].toUpperCase() + snap.info.purpose.slice(1)}.</p>}
        {snap.heading && snap.info && snap.heading !== snap.info.name && <p className="mt-1.5 truncate text-[12px] text-gray-700">“{snap.heading}”</p>}
        {snap.looking.length > 0 ? (
          <ul className="mt-2 grid gap-1" aria-label="O que você escolheu ou procurou">
            {snap.looking.slice(0, 5).map((l) => (
              <li key={l} className="flex items-start gap-1.5 text-[12px] text-gray-700">
                {l.startsWith('Procurando') ? <Search className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" aria-hidden /> : <Eye className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" aria-hidden />}
                <span className="min-w-0 break-words">{l}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-gray-500">Quando você escolher uma aba, um período ou buscar algo, eu levo isso em conta.</p>
        )}
      </section>
    </div>
  )
}
