import React from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { pauseWork, resumeWork, stopWork, useWork } from '@/features/ia/work'

/** Pausar, continuar e parar o trabalho em andamento, no cartão dele (o mesmo que escrever "pausa" no chat). */
export const WorkBar: React.FC = () => {
  const { running, paused } = useWork()
  if (!running) return null
  const btn = 'inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Controle do trabalho">
      {paused ? (
        <>
          <span className="mr-1 text-[11px] font-medium text-amber-700">Pausado: o próximo passo espera</span>
          <button type="button" className={btn} onClick={() => resumeWork()}>
            <Play className="h-3 w-3" aria-hidden /> Continuar
          </button>
        </>
      ) : (
        <button type="button" className={btn} onClick={() => pauseWork()}>
          <Pause className="h-3 w-3" aria-hidden /> Pausar
        </button>
      )}
      <button type="button" className={`${btn} text-red-700`} onClick={() => stopWork()}>
        <Square className="h-3 w-3" aria-hidden /> Parar
      </button>
    </div>
  )
}
