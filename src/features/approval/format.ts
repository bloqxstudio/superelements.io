const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "28/09 às 10:30" */
export const when = (time: number) => `${DAY.format(time)} às ${TIME.format(time)}`

export const DECISION_LABELS = { approved: 'Aprovada', changes: 'Ajuste pedido' } as const
