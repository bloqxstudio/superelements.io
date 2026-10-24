/** Junta o perfil do agente (quem é, como trabalha, regras) ao sistema do pedido. */
export const withPersona = (system: string, persona?: string) => {
  const text = String(persona ?? '').trim().slice(0, 4000)
  return text ? `${system}\n\n## Seu perfil e as regras da equipe (valem junto das instruções acima, nunca contra o formato da resposta)\n${text}` : system
}
