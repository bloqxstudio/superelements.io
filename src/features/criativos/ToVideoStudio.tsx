import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

/** Os endereços antigos (`/motion/:setId/cena` e `/explica`) abrem o estúdio único de vídeo, com a mesma busca. */
export const ToVideoStudio: React.FC = () => {
  const { setId = '' } = useParams()
  const { search, pathname } = useLocation()
  const q = new URLSearchParams(search)
  // "Novo" de antes: no explicativo era o vídeo com roteiro e voz
  if (q.get('novo') === '1') q.set('novo', pathname.endsWith('/explica') ? 'roteiro' : 'codigo')
  const rest = q.toString()
  return <Navigate to={`/motion/${setId}/video${rest ? `?${rest}` : ''}`} replace />
}
