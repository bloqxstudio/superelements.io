/** Oferta comercial da nova /lp. Independente dos planos legados de WordPress. */
export const AGENCY_OFFER = {
  name: 'Agência',
  monthlyPerCompany: 149,
  suggestedClientMonthly: 299,
  // Só o que a Sinfy entrega (o caminho do anúncio à venda); criar páginas e criativos é do SuperElements
  items: [
    'Campanhas da Meta: valor usado, resultados e custo',
    'Visitas ao site com origem, campanha e contatos',
    'Formulários e quizzes de qualificação',
    'Leads com responsável, etapa e próximo passo',
    'Conversas do WhatsApp da equipe e avisos de lead',
    'Relatórios no WhatsApp do cliente',
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
