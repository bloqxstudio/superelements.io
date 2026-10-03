/**
 * Planos do Superelements, mensais, em reais. Valores da página-conceito
 * (src/pages/SuperElementsLanding.tsx), confirmados pelo usuário em 2026-10-02
 * para a página Preços. Mudar um valor aqui e reconstruir as seções de preço.
 */
export interface Plan {
  key: 'produto' | 'completo' | 'agencia'
  name: string
  price: number
  text: string
  items: string[]
  cta: string
  featured?: string
}

export const PLANS: Plan[] = [
  {
    key: 'produto', name: 'Produto', price: 89,
    text: 'Para uma empresa que já tem WordPress e hospedagem.',
    items: ['1 site conectado', 'Canvas, editor visual e Navigator', 'Marca e biblioteca de seções', 'Importação e publicação', '1 colaborador'],
    cta: 'Começar com o Produto',
  },
  {
    key: 'completo', name: 'Completo', price: 179, featured: 'Mais simples para a empresa',
    text: 'O Superelements e a hospedagem gerenciada no mesmo plano.',
    items: ['Tudo do plano Produto', 'Hospedagem WordPress', 'SSL, backup e ambiente técnico', 'Atualizações e monitoramento', '3 colaboradores'],
    cta: 'Começar com o Completo',
  },
  {
    key: 'agencia', name: 'Agência', price: 349,
    text: 'Uma central para criar e operar os sites dos clientes.',
    items: ['5 sites conectados', 'Projetos e marcas ilimitados', 'Equipe, convites e aprovação', 'Biblioteca compartilhada', 'Site adicional por R$ 39/mês', 'Hospedagem opcional por site'],
    cta: 'Começar com a Agência',
  },
]

export const EXTRA_SITE = 39

export const brl = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`
