/**
 * Mock data for the Ousen workspace.
 * Simulates a law firm agency managing multiple lawyer client accounts.
 *
 * Usage example (dev/preview mode):
 *   import { OUSEN_WORKSPACE, OUSEN_CONNECTIONS, OUSEN_PROPOSALS, ... } from '@/mocks/ousenWorkspace';
 */

import type { WordPressConnection } from '@/store/connectionsStore';

// ─────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────

export const OUSEN_WORKSPACE = {
  id: 'ws-ousen-2024',
  name: 'Ousen',
  slug: 'ousen',
  role: 'owner' as const,
};

// ─────────────────────────────────────────────
// Client Accounts (connections of type client_account)
// ─────────────────────────────────────────────

export const OUSEN_CONNECTIONS: WordPressConnection[] = [
  {
    id: 'conn-joao-adv',
    name: 'Dr. João Advogados',
    slug: 'dr-joao-advogados',
    base_url: 'https://dr-joao-advogados.com.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connected',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-20T14:30:00'),
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2023-08-10'),
    updatedAt: new Date('2024-02-20'),
  },
  {
    id: 'conn-silva-escritorio',
    name: 'Escritório Silva & Associados',
    slug: 'escritorio-silva-associados',
    base_url: 'https://escritorio-silva.com.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connected',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-20T09:15:00'),
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2023-09-05'),
    updatedAt: new Date('2024-02-20'),
  },
  {
    id: 'conn-torres-advocacia',
    name: 'Torres Advocacia Criminal',
    slug: 'torres-advocacia-criminal',
    base_url: 'https://advocacia-torres.com',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connected',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-19T16:45:00'),
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2023-10-12'),
    updatedAt: new Date('2024-02-19'),
  },
  {
    id: 'conn-camila-mendes',
    name: 'Dra. Camila Mendes',
    slug: 'camila-mendes-adv',
    base_url: 'https://camilamendes-adv.com.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'error',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-18T11:00:00'),
    componentsCount: 0,
    error: 'Falha na autenticação: credenciais expiradas',
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2023-11-01'),
    updatedAt: new Date('2024-02-18'),
  },
  {
    id: 'conn-ramos-previdenciario',
    name: 'Ramos & Ramos Previdenciário',
    slug: 'ramos-previdenciario',
    base_url: 'https://ramosprevidenciario.adv.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connected',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-20T08:00:00'),
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2023-11-20'),
    updatedAt: new Date('2024-02-20'),
  },
  {
    id: 'conn-lima-tributario',
    name: 'Lima Tributário Consultores',
    slug: 'lima-tributario',
    base_url: 'https://limatributario.com.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'disconnected',
    isActive: false,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-10T10:30:00'),
    componentsCount: 0,
    error: 'Sem resposta do servidor',
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-02-10'),
  },
  {
    id: 'conn-ferreira-familia',
    name: 'Ferreira Direito de Família',
    slug: 'ferreira-familia',
    base_url: 'https://ferreirafamilia.adv.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connected',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: new Date('2024-02-20T13:20:00'),
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-20'),
  },
  {
    id: 'conn-barbosa-trabalhista',
    name: 'Barbosa Advocacia Trabalhista',
    slug: 'barbosa-trabalhista',
    base_url: 'https://barbosatrabalhista.com.br',
    post_type: 'pages',
    json_field: 'content',
    preview_field: 'link',
    status: 'connecting',
    isActive: true,
    userType: 'pro',
    accessLevel: 'pro',
    lastTested: undefined,
    componentsCount: 0,
    connection_type: 'client_account',
    workspace_id: 'ws-ousen-2024',
    createdAt: new Date('2024-02-19'),
    updatedAt: new Date('2024-02-19'),
  },
];

// ─────────────────────────────────────────────
// Client Pages (linked to connections)
// ─────────────────────────────────────────────

export interface MockClientPage {
  id: string;
  connection_id: string;
  wordpress_page_id: number;
  title: string;
  slug: string;
  url: string;
  status: 'publish' | 'draft' | 'private' | 'pending';
  modified_date: string;
  imported_at: string;
  last_synced: string | null;
}

export const OUSEN_CLIENT_PAGES: MockClientPage[] = [
  // Dr. João Advogados — 5 páginas
  { id: 'pg-joao-01', connection_id: 'conn-joao-adv', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://dr-joao-advogados.com.br/', status: 'publish', modified_date: '2024-02-15', imported_at: '2023-08-12', last_synced: '2024-02-15' },
  { id: 'pg-joao-02', connection_id: 'conn-joao-adv', wordpress_page_id: 5, title: 'Áreas de Atuação', slug: 'areas-de-atuacao', url: 'https://dr-joao-advogados.com.br/areas-de-atuacao/', status: 'publish', modified_date: '2024-01-28', imported_at: '2023-08-12', last_synced: '2024-01-28' },
  { id: 'pg-joao-03', connection_id: 'conn-joao-adv', wordpress_page_id: 8, title: 'Sobre o Escritório', slug: 'sobre', url: 'https://dr-joao-advogados.com.br/sobre/', status: 'publish', modified_date: '2024-01-10', imported_at: '2023-08-12', last_synced: '2024-01-10' },
  { id: 'pg-joao-04', connection_id: 'conn-joao-adv', wordpress_page_id: 11, title: 'Blog Jurídico', slug: 'blog', url: 'https://dr-joao-advogados.com.br/blog/', status: 'publish', modified_date: '2024-02-18', imported_at: '2023-09-01', last_synced: '2024-02-18' },
  { id: 'pg-joao-05', connection_id: 'conn-joao-adv', wordpress_page_id: 14, title: 'Contato', slug: 'contato', url: 'https://dr-joao-advogados.com.br/contato/', status: 'publish', modified_date: '2024-01-05', imported_at: '2023-08-12', last_synced: '2024-01-05' },

  // Escritório Silva — 3 páginas
  { id: 'pg-silva-01', connection_id: 'conn-silva-escritorio', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://escritorio-silva.com.br/', status: 'publish', modified_date: '2024-02-10', imported_at: '2023-09-07', last_synced: '2024-02-10' },
  { id: 'pg-silva-02', connection_id: 'conn-silva-escritorio', wordpress_page_id: 6, title: 'Prática Civil', slug: 'pratica-civil', url: 'https://escritorio-silva.com.br/pratica-civil/', status: 'publish', modified_date: '2024-01-22', imported_at: '2023-09-07', last_synced: '2024-01-22' },
  { id: 'pg-silva-03', connection_id: 'conn-silva-escritorio', wordpress_page_id: 9, title: 'Contato', slug: 'contato', url: 'https://escritorio-silva.com.br/contato/', status: 'draft', modified_date: '2024-02-19', imported_at: '2023-10-01', last_synced: null },

  // Torres Advocacia — 8 páginas
  { id: 'pg-torres-01', connection_id: 'conn-torres-advocacia', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://advocacia-torres.com/', status: 'publish', modified_date: '2024-02-12', imported_at: '2023-10-14', last_synced: '2024-02-12' },
  { id: 'pg-torres-02', connection_id: 'conn-torres-advocacia', wordpress_page_id: 4, title: 'Direito Criminal', slug: 'direito-criminal', url: 'https://advocacia-torres.com/direito-criminal/', status: 'publish', modified_date: '2024-02-01', imported_at: '2023-10-14', last_synced: '2024-02-01' },
  { id: 'pg-torres-03', connection_id: 'conn-torres-advocacia', wordpress_page_id: 7, title: 'Habeas Corpus', slug: 'habeas-corpus', url: 'https://advocacia-torres.com/habeas-corpus/', status: 'publish', modified_date: '2024-01-18', imported_at: '2023-11-01', last_synced: '2024-01-18' },
  { id: 'pg-torres-04', connection_id: 'conn-torres-advocacia', wordpress_page_id: 10, title: 'Defesas Criminais', slug: 'defesas-criminais', url: 'https://advocacia-torres.com/defesas-criminais/', status: 'publish', modified_date: '2024-01-30', imported_at: '2023-11-01', last_synced: '2024-01-30' },
  { id: 'pg-torres-05', connection_id: 'conn-torres-advocacia', wordpress_page_id: 13, title: 'Casos de Sucesso', slug: 'casos-de-sucesso', url: 'https://advocacia-torres.com/casos-de-sucesso/', status: 'publish', modified_date: '2024-02-05', imported_at: '2023-11-15', last_synced: '2024-02-05' },
  { id: 'pg-torres-06', connection_id: 'conn-torres-advocacia', wordpress_page_id: 16, title: 'Equipe', slug: 'equipe', url: 'https://advocacia-torres.com/equipe/', status: 'publish', modified_date: '2024-01-08', imported_at: '2023-11-15', last_synced: '2024-01-08' },
  { id: 'pg-torres-07', connection_id: 'conn-torres-advocacia', wordpress_page_id: 19, title: 'Blog', slug: 'blog', url: 'https://advocacia-torres.com/blog/', status: 'publish', modified_date: '2024-02-20', imported_at: '2023-12-01', last_synced: '2024-02-20' },
  { id: 'pg-torres-08', connection_id: 'conn-torres-advocacia', wordpress_page_id: 22, title: 'Contato', slug: 'contato', url: 'https://advocacia-torres.com/contato/', status: 'publish', modified_date: '2023-12-05', imported_at: '2023-12-01', last_synced: '2023-12-05' },

  // Dra. Camila Mendes — 2 páginas (com erro de conexão)
  { id: 'pg-camila-01', connection_id: 'conn-camila-mendes', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://camilamendes-adv.com.br/', status: 'publish', modified_date: '2024-01-20', imported_at: '2023-11-03', last_synced: '2024-01-20' },
  { id: 'pg-camila-02', connection_id: 'conn-camila-mendes', wordpress_page_id: 5, title: 'Direito de Família', slug: 'direito-de-familia', url: 'https://camilamendes-adv.com.br/direito-de-familia/', status: 'publish', modified_date: '2024-01-05', imported_at: '2023-11-03', last_synced: '2024-01-05' },

  // Ramos Previdenciário — 6 páginas
  { id: 'pg-ramos-01', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://ramosprevidenciario.adv.br/', status: 'publish', modified_date: '2024-02-16', imported_at: '2023-11-22', last_synced: '2024-02-16' },
  { id: 'pg-ramos-02', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 5, title: 'Aposentadoria por Invalidez', slug: 'aposentadoria-invalidez', url: 'https://ramosprevidenciario.adv.br/aposentadoria-invalidez/', status: 'publish', modified_date: '2024-02-08', imported_at: '2023-11-22', last_synced: '2024-02-08' },
  { id: 'pg-ramos-03', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 8, title: 'Benefício por Incapacidade', slug: 'beneficio-incapacidade', url: 'https://ramosprevidenciario.adv.br/beneficio-incapacidade/', status: 'publish', modified_date: '2024-01-25', imported_at: '2023-12-01', last_synced: '2024-01-25' },
  { id: 'pg-ramos-04', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 11, title: 'Pensão por Morte', slug: 'pensao-por-morte', url: 'https://ramosprevidenciario.adv.br/pensao-por-morte/', status: 'publish', modified_date: '2024-01-12', imported_at: '2023-12-01', last_synced: '2024-01-12' },
  { id: 'pg-ramos-05', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 14, title: 'Revisão de Benefícios', slug: 'revisao-beneficios', url: 'https://ramosprevidenciario.adv.br/revisao-beneficios/', status: 'draft', modified_date: '2024-02-19', imported_at: '2024-01-10', last_synced: null },
  { id: 'pg-ramos-06', connection_id: 'conn-ramos-previdenciario', wordpress_page_id: 17, title: 'Contato', slug: 'contato', url: 'https://ramosprevidenciario.adv.br/contato/', status: 'publish', modified_date: '2023-12-10', imported_at: '2023-12-01', last_synced: '2023-12-10' },

  // Ferreira Família — 4 páginas
  { id: 'pg-ferreira-01', connection_id: 'conn-ferreira-familia', wordpress_page_id: 2, title: 'Home', slug: 'home', url: 'https://ferreirafamilia.adv.br/', status: 'publish', modified_date: '2024-02-18', imported_at: '2024-01-17', last_synced: '2024-02-18' },
  { id: 'pg-ferreira-02', connection_id: 'conn-ferreira-familia', wordpress_page_id: 5, title: 'Divórcio', slug: 'divorcio', url: 'https://ferreirafamilia.adv.br/divorcio/', status: 'publish', modified_date: '2024-02-10', imported_at: '2024-01-17', last_synced: '2024-02-10' },
  { id: 'pg-ferreira-03', connection_id: 'conn-ferreira-familia', wordpress_page_id: 8, title: 'Guarda de Filhos', slug: 'guarda-de-filhos', url: 'https://ferreirafamilia.adv.br/guarda-de-filhos/', status: 'publish', modified_date: '2024-02-05', imported_at: '2024-01-17', last_synced: '2024-02-05' },
  { id: 'pg-ferreira-04', connection_id: 'conn-ferreira-familia', wordpress_page_id: 11, title: 'Inventário e Herança', slug: 'inventario-heranca', url: 'https://ferreirafamilia.adv.br/inventario-heranca/', status: 'draft', modified_date: '2024-02-20', imported_at: '2024-02-01', last_synced: null },
];

// ─────────────────────────────────────────────
// Performance scores (Lighthouse)
// ─────────────────────────────────────────────

export interface MockPagePerformance {
  id: string;
  client_page_id: string;
  url: string;
  performance_score: number;
  lcp_ms: number;
  cls: number;
  inp_ms: number;
  tbt_ms: number;
  strategy: 'mobile' | 'desktop';
  analyzed_at: string;
}

export const OUSEN_PAGE_PERFORMANCE: MockPagePerformance[] = [
  { id: 'perf-joao-01', client_page_id: 'pg-joao-01', url: 'https://dr-joao-advogados.com.br/', performance_score: 94, lcp_ms: 1420, cls: 0.02, inp_ms: 180, tbt_ms: 85, strategy: 'desktop', analyzed_at: '2024-02-15T14:00:00' },
  { id: 'perf-joao-02', client_page_id: 'pg-joao-02', url: 'https://dr-joao-advogados.com.br/areas-de-atuacao/', performance_score: 91, lcp_ms: 1650, cls: 0.04, inp_ms: 210, tbt_ms: 120, strategy: 'desktop', analyzed_at: '2024-02-15T14:05:00' },
  { id: 'perf-joao-03', client_page_id: 'pg-joao-03', url: 'https://dr-joao-advogados.com.br/sobre/', performance_score: 97, lcp_ms: 980, cls: 0.01, inp_ms: 150, tbt_ms: 40, strategy: 'desktop', analyzed_at: '2024-02-15T14:10:00' },
  { id: 'perf-joao-04', client_page_id: 'pg-joao-04', url: 'https://dr-joao-advogados.com.br/blog/', performance_score: 88, lcp_ms: 2100, cls: 0.08, inp_ms: 280, tbt_ms: 200, strategy: 'desktop', analyzed_at: '2024-02-18T10:00:00' },
  { id: 'perf-joao-05', client_page_id: 'pg-joao-05', url: 'https://dr-joao-advogados.com.br/contato/', performance_score: 99, lcp_ms: 750, cls: 0.0, inp_ms: 100, tbt_ms: 20, strategy: 'desktop', analyzed_at: '2024-02-15T14:15:00' },

  { id: 'perf-silva-01', client_page_id: 'pg-silva-01', url: 'https://escritorio-silva.com.br/', performance_score: 92, lcp_ms: 1380, cls: 0.03, inp_ms: 190, tbt_ms: 95, strategy: 'desktop', analyzed_at: '2024-02-10T09:00:00' },
  { id: 'perf-silva-02', client_page_id: 'pg-silva-02', url: 'https://escritorio-silva.com.br/pratica-civil/', performance_score: 95, lcp_ms: 1100, cls: 0.01, inp_ms: 160, tbt_ms: 55, strategy: 'desktop', analyzed_at: '2024-02-10T09:05:00' },

  { id: 'perf-torres-01', client_page_id: 'pg-torres-01', url: 'https://advocacia-torres.com/', performance_score: 96, lcp_ms: 1050, cls: 0.01, inp_ms: 155, tbt_ms: 50, strategy: 'desktop', analyzed_at: '2024-02-12T11:00:00' },
  { id: 'perf-torres-02', client_page_id: 'pg-torres-02', url: 'https://advocacia-torres.com/direito-criminal/', performance_score: 93, lcp_ms: 1300, cls: 0.02, inp_ms: 175, tbt_ms: 80, strategy: 'desktop', analyzed_at: '2024-02-12T11:05:00' },
  { id: 'perf-torres-05', client_page_id: 'pg-torres-05', url: 'https://advocacia-torres.com/casos-de-sucesso/', performance_score: 89, lcp_ms: 1900, cls: 0.06, inp_ms: 260, tbt_ms: 180, strategy: 'desktop', analyzed_at: '2024-02-12T11:30:00' },
  { id: 'perf-torres-07', client_page_id: 'pg-torres-07', url: 'https://advocacia-torres.com/blog/', performance_score: 85, lcp_ms: 2350, cls: 0.1, inp_ms: 310, tbt_ms: 240, strategy: 'desktop', analyzed_at: '2024-02-20T08:00:00' },

  { id: 'perf-ramos-01', client_page_id: 'pg-ramos-01', url: 'https://ramosprevidenciario.adv.br/', performance_score: 90, lcp_ms: 1720, cls: 0.05, inp_ms: 230, tbt_ms: 140, strategy: 'desktop', analyzed_at: '2024-02-16T08:30:00' },
  { id: 'perf-ramos-02', client_page_id: 'pg-ramos-02', url: 'https://ramosprevidenciario.adv.br/aposentadoria-invalidez/', performance_score: 93, lcp_ms: 1280, cls: 0.02, inp_ms: 170, tbt_ms: 75, strategy: 'desktop', analyzed_at: '2024-02-16T08:35:00' },

  { id: 'perf-ferreira-01', client_page_id: 'pg-ferreira-01', url: 'https://ferreirafamilia.adv.br/', performance_score: 98, lcp_ms: 870, cls: 0.01, inp_ms: 120, tbt_ms: 30, strategy: 'desktop', analyzed_at: '2024-02-18T13:00:00' },
  { id: 'perf-ferreira-02', client_page_id: 'pg-ferreira-02', url: 'https://ferreirafamilia.adv.br/divorcio/', performance_score: 95, lcp_ms: 1120, cls: 0.02, inp_ms: 158, tbt_ms: 60, strategy: 'desktop', analyzed_at: '2024-02-18T13:05:00' },
];

// ─────────────────────────────────────────────
// Proposals
// ─────────────────────────────────────────────

export interface MockProposal {
  id: string;
  token: string;
  workspace_id: string;
  client_name: string;
  client_email: string | null;
  scope: string;
  price: number;
  payment_terms: string | null;
  deadline: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  template: 'simple' | 'partners';
  accepted_at: string | null;
  created_at: string;
}

export const OUSEN_PROPOSALS: MockProposal[] = [
  {
    id: 'prop-001',
    token: 'tkn-prop-001',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Dra. Beatriz Fonseca',
    client_email: 'beatriz@fonsecaradv.com.br',
    scope: 'Criação de site institucional com 5 páginas: Home, Áreas de Atuação (Direito Imobiliário), Sobre, Blog e Contato. Design moderno com Elementor Pro.',
    price: 3000,
    payment_terms: '50% na aprovação, 50% na entrega',
    deadline: '2024-03-15',
    status: 'pending',
    template: 'partners',
    accepted_at: null,
    created_at: '2024-02-18T10:00:00',
  },
  {
    id: 'prop-002',
    token: 'tkn-prop-002',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Dr. Marcos Vinicius Alves',
    client_email: 'marcos@alves-trabalhista.com.br',
    scope: 'Redesign completo do site com 7 páginas focadas em Direito Trabalhista. Integração com WhatsApp Business e formulário de triagem de casos.',
    price: 4200,
    payment_terms: '30% na assinatura, 40% na aprovação do design, 30% na entrega',
    deadline: '2024-04-01',
    status: 'accepted',
    template: 'partners',
    accepted_at: '2024-02-19T15:30:00',
    created_at: '2024-02-10T09:00:00',
  },
  {
    id: 'prop-003',
    token: 'tkn-prop-003',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Escritório Pinheiro & Lima',
    client_email: null,
    scope: 'Landing page única para captação de clientes em Direito Previdenciário. Foco em conversão com formulário integrado ao CRM.',
    price: 1200,
    payment_terms: '100% antecipado',
    deadline: '2024-02-28',
    status: 'accepted',
    template: 'simple',
    accepted_at: '2024-02-12T11:00:00',
    created_at: '2024-02-08T14:00:00',
  },
  {
    id: 'prop-004',
    token: 'tkn-prop-004',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Dra. Amanda Souza',
    client_email: 'amanda@souzafamilia.adv.br',
    scope: 'Site completo com 4 páginas para escritório de Direito de Família. Galeria de artigos e depoimentos de clientes.',
    price: 2400,
    payment_terms: '50% na aprovação, 50% na entrega',
    deadline: '2024-03-20',
    status: 'pending',
    template: 'simple',
    accepted_at: null,
    created_at: '2024-02-20T08:30:00',
  },
  {
    id: 'prop-005',
    token: 'tkn-prop-005',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Dr. Carlos Menezes',
    client_email: 'carlos@menezes-criminal.com',
    scope: 'Site institucional 3 páginas para advocacia criminal. Design sóbrio e profissional com foco em credibilidade.',
    price: 1800,
    payment_terms: '50% na aprovação, 50% na entrega',
    deadline: '2024-02-25',
    status: 'rejected',
    template: 'simple',
    accepted_at: null,
    created_at: '2024-02-01T16:00:00',
  },
  {
    id: 'prop-006',
    token: 'tkn-prop-006',
    workspace_id: 'ws-ousen-2024',
    client_name: 'Oliveira & Neto Advogados',
    client_email: 'contato@oliveiraneto.adv.br',
    scope: 'Pacote completo: site 8 páginas + manutenção mensal por 12 meses. Especialidade em Direito Empresarial e Contratos.',
    price: 5800,
    payment_terms: '30% na assinatura + R$ 299/mês de manutenção',
    deadline: '2024-04-30',
    status: 'pending',
    template: 'partners',
    accepted_at: null,
    created_at: '2024-02-20T11:00:00',
  },
];

// ─────────────────────────────────────────────
// Resources / Templates
// ─────────────────────────────────────────────

export interface MockResource {
  id: string;
  workspace_id: string;
  title: string;
  type: 'pdf' | 'kit' | 'template' | 'video' | 'link';
  url: string;
  category: string;
  is_active: boolean;
  order: number;
  created_at: string;
}

export const OUSEN_RESOURCES: MockResource[] = [
  { id: 'res-001', workspace_id: 'ws-ousen-2024', title: 'Briefing Padrão — Escritório Advocacia', type: 'pdf', url: '/resources/briefing-advocacia.pdf', category: 'Onboarding', is_active: true, order: 1, created_at: '2023-09-01' },
  { id: 'res-002', workspace_id: 'ws-ousen-2024', title: 'Kit Elementor — Direito (Dark)', type: 'kit', url: '/resources/kit-direito-dark.zip', category: 'Templates', is_active: true, order: 2, created_at: '2023-09-15' },
  { id: 'res-003', workspace_id: 'ws-ousen-2024', title: 'Kit Elementor — Direito (Light)', type: 'kit', url: '/resources/kit-direito-light.zip', category: 'Templates', is_active: true, order: 3, created_at: '2023-10-01' },
  { id: 'res-004', workspace_id: 'ws-ousen-2024', title: 'Checklist de Entrega — Site Jurídico', type: 'pdf', url: '/resources/checklist-entrega.pdf', category: 'Processos', is_active: true, order: 4, created_at: '2023-10-10' },
  { id: 'res-005', workspace_id: 'ws-ousen-2024', title: 'Modelo de Contrato de Serviço', type: 'pdf', url: '/resources/contrato-servico.pdf', category: 'Jurídico', is_active: true, order: 5, created_at: '2023-11-01' },
  { id: 'res-006', workspace_id: 'ws-ousen-2024', title: 'Tutorial: Conectando WordPress ao Painel', type: 'video', url: 'https://www.youtube.com/watch?v=example', category: 'Tutoriais', is_active: true, order: 6, created_at: '2023-11-15' },
  { id: 'res-007', workspace_id: 'ws-ousen-2024', title: 'Paleta de Cores — Identidade Jurídica', type: 'template', url: '/resources/paleta-juridica.json', category: 'Design', is_active: true, order: 7, created_at: '2023-12-01' },
  { id: 'res-008', workspace_id: 'ws-ousen-2024', title: 'Guia SEO para Escritórios de Advocacia', type: 'pdf', url: '/resources/guia-seo-advocacia.pdf', category: 'Marketing', is_active: true, order: 8, created_at: '2024-01-05' },
];

// ─────────────────────────────────────────────
// Dashboard KPIs (computed from mock data above)
// ─────────────────────────────────────────────

export const OUSEN_DASHBOARD_KPIS = {
  totalClients: OUSEN_CONNECTIONS.length,                                           // 8
  connectedClients: OUSEN_CONNECTIONS.filter(c => c.status === 'connected').length,  // 5
  errorClients: OUSEN_CONNECTIONS.filter(c => c.status === 'error').length,          // 1
  totalPages: OUSEN_CLIENT_PAGES.length,                                             // 28
  publishedPages: OUSEN_CLIENT_PAGES.filter(p => p.status === 'publish').length,    // 24
  draftPages: OUSEN_CLIENT_PAGES.filter(p => p.status === 'draft').length,          // 4
  totalProposals: OUSEN_PROPOSALS.filter(p => p.status !== 'rejected').length,      // 5
  acceptedProposals: OUSEN_PROPOSALS.filter(p => p.status === 'accepted').length,   // 2
  pendingProposals: OUSEN_PROPOSALS.filter(p => p.status === 'pending').length,     // 3
  avgPerformanceScore: Math.round(
    OUSEN_PAGE_PERFORMANCE.reduce((acc, p) => acc + p.performance_score, 0) /
      OUSEN_PAGE_PERFORMANCE.length
  ),                                                                                 // ~93
  totalRevenuePipeline: OUSEN_PROPOSALS
    .filter(p => p.status !== 'rejected')
    .reduce((acc, p) => acc + p.price, 0),                                          // R$ 17.600
};
