/**
 * "Chamar": abre CRM › WhatsApp já com o número (e a mensagem) de um cliente,
 * de uma oportunidade do funil ou de um prospect da busca. Quem envia é a
 * pessoa, na caixa de entrada; o que for enviado entra na linha do tempo do
 * cliente quando há `cliente`.
 */

export interface CallTarget {
  phone?: string
  name?: string
  clientId?: string
  opportunityId?: string
  text?: string
}

/** Só os dígitos, com o 55 do Brasil quando falta (a mesma regra do banco). Vazio se não for um número. */
export function phoneDigits(phone: string | undefined): string | undefined {
  let digits = (phone ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  return digits.length >= 11 && digits.length <= 15 ? digits : undefined
}

export function callPath(target: CallTarget) {
  const params = new URLSearchParams()
  const digits = phoneDigits(target.phone)
  if (digits) params.set('numero', digits)
  if (target.name) params.set('nome', target.name)
  if (target.clientId) params.set('cliente', target.clientId)
  if (target.opportunityId) params.set('oportunidade', target.opportunityId)
  if (target.text) params.set('texto', target.text)
  return `/crm/whatsapp?${params}`
}

/** A primeira mensagem sugerida; a pessoa ajusta antes de enviar. */
export const openingText = (sender: string | undefined) => `Olá! Aqui é ${sender ? sender.split(' ')[0] : '…'}, da Avence Studio. `
