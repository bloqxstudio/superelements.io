// ── Enums ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new_lead'
  | 'contacted'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadSource =
  | 'indication'
  | 'instagram'
  | 'linkedin'
  | 'website'
  | 'cold_outreach'
  | 'other';

// ── Kanban column metadata ────────────────────────────────────────────────────

export interface LeadKanbanColumn {
  id: LeadStatus;
  label: string;
  colorClass: string;
  headerClass: string;
  terminal?: boolean;
}

export const LEAD_KANBAN_COLUMNS: LeadKanbanColumn[] = [
  {
    id: 'new_lead',
    label: 'Novo Lead',
    colorClass: 'bg-gray-50 border-gray-200',
    headerClass: 'bg-gray-100 text-gray-600',
  },
  {
    id: 'contacted',
    label: 'Contato Feito',
    colorClass: 'bg-blue-50 border-blue-200',
    headerClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'proposal',
    label: 'Proposta',
    colorClass: 'bg-amber-50 border-amber-200',
    headerClass: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'negotiation',
    label: 'Negociação',
    colorClass: 'bg-purple-50 border-purple-200',
    headerClass: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'won',
    label: 'Ganho',
    colorClass: 'bg-emerald-50 border-emerald-200',
    headerClass: 'bg-emerald-100 text-emerald-700',
    terminal: true,
  },
  {
    id: 'lost',
    label: 'Perdido',
    colorClass: 'bg-red-50 border-red-200',
    headerClass: 'bg-red-100 text-red-700',
    terminal: true,
  },
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  indication:    'Indicação',
  instagram:     'Instagram',
  linkedin:      'LinkedIn',
  website:       'Site',
  cold_outreach: 'Cold Outreach',
  other:         'Outro',
};

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; badgeClass: string }> = {
  new_lead:    { label: 'Novo Lead',     badgeClass: 'bg-gray-100 text-gray-700 border-gray-300' },
  contacted:   { label: 'Contato Feito', badgeClass: 'bg-blue-100 text-blue-700 border-blue-300' },
  proposal:    { label: 'Proposta',      badgeClass: 'bg-amber-100 text-amber-700 border-amber-300' },
  negotiation: { label: 'Negociação',    badgeClass: 'bg-purple-100 text-purple-700 border-purple-300' },
  won:         { label: 'Ganho',         badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  lost:        { label: 'Perdido',       badgeClass: 'bg-red-100 text-red-700 border-red-300' },
};

// ── Domain entities ───────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  estimated_value: number | null;
  tags: string[];
  kanban_status: LeadStatus;
  position: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  workspace_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; email: string } | null;
}

export interface LeadProject {
  id: string;
  lead_id: string;
  project_id: string;
  created_at: string;
  project?: { id: string; name: string; status: string } | null;
}

export interface LeadDetail {
  lead: Lead;
  interactions: LeadInteraction[];
  linkedProjects: LeadProject[];
}

// ── Form value types ──────────────────────────────────────────────────────────

export interface LeadFormValues {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  estimated_value: string;
  tags: string;
  notes: string;
  kanban_status: LeadStatus;
}

export interface LeadInteractionFormValues {
  content: string;
}
