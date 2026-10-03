import { useEffect, useState } from 'react'

/** Renderiza de novo de tempos em tempos: "há 2 minutos" e "Parado" mudam sem evento nenhum. */
export const useTick = (every = 30_000) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(timer)
  }, [every])
  return now
}
