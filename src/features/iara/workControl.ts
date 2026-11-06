import { pauseWork, resumeWork, stopWork, useWork } from '@/features/ia/work'
import { addCard } from './feed'
import { attachmentFiles, nextAttachmentRef } from './store'

/**
 * "pausa", "continua", "para" escritos no chat da Iara enquanto um trabalho dela roda (criativos, equipe de agentes):
 * controlam o trabalho na hora, sem passar pelo agente (2026-11-05, o usuário: "apenas pedir pra pausar").
 * Só frases curtas e só com um trabalho em andamento; fora disso a mensagem vai normalmente ao agente.
 */
const PAUSE = /^(pode\s+)?(pausa|pausar|pause|segura|espera|aguarda)\b/i
const RESUME = /^(pode\s+)?(continua|continuar|continue|retoma|retomar|segue|seguir|prossiga|prosseguir)\b/i
const STOP = /^(pode\s+)?(para|parar|pare|cancela|cancelar|cancele|interrompe|interromper|stop)\b/i

export function workCommand(raw: string): boolean {
  const text = raw.trim().replace(/[.!]+$/, '')
  if (!text || text.length > 60) return false
  const { running, paused, label } = useWork.getState()
  if (!running) return false
  const what = label ? `"${label.slice(0, 80)}"` : 'o trabalho'
  if (STOP.test(text)) {
    stopWork()
    addCard({ role: 'iara', text: `Parei ${what}. O que já tinha ficado pronto continua salvo.` })
    return true
  }
  if (PAUSE.test(text)) {
    if (paused) addCard({ role: 'iara', text: `${what} já está pausado. Escreva "continua" para seguir ou "para" para cancelar.` })
    else {
      pauseWork()
      addCard({ role: 'iara', text: `Pausado: ${what}. O passo que estava rodando termina e o próximo espera. Escreva "continua" para seguir ou "para" para cancelar.` })
    }
    return true
  }
  if (RESUME.test(text) && paused) {
    resumeWork()
    addCard({ role: 'iara', text: `Seguindo com ${what}.` })
    return true
  }
  return false
}

/** Guarda a imagem anexada no chat com o nome que as ações de criativo usam (anexo-1, anexo-2…). */
export function registerAttachment(name: string, data: string): { ref: string; name: string } {
  const ref = nextAttachmentRef()
  attachmentFiles.set(ref, { name: name || ref, data })
  return { ref, name: name || ref }
}
