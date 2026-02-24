import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  DollarSign,
  Pencil,
  Search,
  Trophy,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types/leads';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_CONFIG } from '@/types/leads';

interface Props {
  leads: Lead[];
  onEditLead: (lead: Lead) => void;
  onLeadClick: (lead: Lead) => void;
}

type SortKey = 'name' | 'company' | 'kanban_status' | 'estimated_value' | 'created_at';
type SortDir = 'asc' | 'desc';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_ORDER: LeadStatus[] = ['new_lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

const LeadListView: React.FC<Props> = ({ leads, onEditLead, onLeadClick }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'pt-BR');
        break;
      case 'company':
        cmp = (a.company ?? '').localeCompare(b.company ?? '', 'pt-BR');
        break;
      case 'kanban_status':
        cmp = STATUS_ORDER.indexOf(a.kanban_status) - STATUS_ORDER.indexOf(b.kanban_status);
        break;
      case 'estimated_value':
        cmp = (a.estimated_value ?? 0) - (b.estimated_value ?? 0);
        break;
      case 'created_at':
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  };

  const ColHeader: React.FC<{ col: SortKey; label: string; className?: string }> = ({
    col,
    label,
    className,
  }) => (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap',
        className
      )}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa ou e-mail…"
          className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm h-8"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <ColHeader col="name" label="Nome" className="pl-5" />
              <ColHeader col="company" label="Empresa" />
              <ColHeader col="kanban_status" label="Status" />
              <ColHeader col="estimated_value" label="Valor" />
              <ColHeader col="created_at" label="Criado em" />
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {sorted.map((lead) => {
              const statusCfg = LEAD_STATUS_CONFIG[lead.kanban_status];
              const isWon = lead.kanban_status === 'won';
              const isLost = lead.kanban_status === 'lost';

              return (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                  onClick={() => onLeadClick(lead)}
                >
                  {/* Name */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isWon && <Trophy className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      {isLost && <X className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {lead.name}
                      </span>
                    </div>
                    {lead.email && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                        {lead.email}
                      </p>
                    )}
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3">
                    {lead.company ? (
                      <span className="text-sm text-gray-700 flex items-center gap-1.5 truncate max-w-[160px]">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        {lead.company}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn('text-xs font-medium', statusCfg.badgeClass)}
                    >
                      {statusCfg.label}
                    </Badge>
                  </td>

                  {/* Value */}
                  <td className="px-4 py-3">
                    {lead.estimated_value != null && lead.estimated_value > 0 ? (
                      <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        {formatCurrency(lead.estimated_value)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Created at */}
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Edit */}
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditLead(lead);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {sorted.length > 0 && (
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-muted-foreground">
            {sorted.length} lead{sorted.length !== 1 ? 's' : ''}
            {search ? ` encontrado${sorted.length !== 1 ? 's' : ''}` : ' no total'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LeadListView;
