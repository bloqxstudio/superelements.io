/** Oferta comercial da nova /lp. Independente dos planos legados de WordPress. */
export const AGENCY_OFFER = {
  name: 'Agência',
  monthlyPerCompany: 149,
  suggestedClientMonthly: 299,
  items: [
    'CRM, contatos, responsáveis e oportunidades',
    'WhatsApp, histórico e rotinas de contato',
    'Formulários e quizzes de qualificação',
    'Origem disponível, site e campanhas Meta',
    'Relatórios e acompanhamento da operação',
    'Criação de páginas e criativos pela agência',
  ],
} as const;

export const AVENCE_OFFER = {
  name: 'Gestão de tráfego + plataforma',
  managementMonthly: 1500,
  productMonthly: AGENCY_OFFER.suggestedClientMonthly,
  get monthlyTotal() { return this.managementMonthly + this.productMonthly; },
} as const;

export const monthlyBrl = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value);
