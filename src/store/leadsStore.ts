import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Lead } from '@/types/leads';

interface LeadsUIState {
  // Optimistic state for kanban drag & drop
  optimisticLeads: Lead[] | null;
  previousLeads: Lead[] | null;

  // Dialog/sheet controls
  editingLeadId: string | null;
  detailLeadId: string | null;
  createLeadStatus: string | null;
}

interface LeadsActions {
  setOptimisticLeads: (leads: Lead[]) => void;
  revertLeads: () => void;
  clearOptimistic: () => void;
  setEditingLeadId: (id: string | null) => void;
  setDetailLeadId: (id: string | null) => void;
  setCreateLeadStatus: (status: string | null) => void;
}

export const useLeadsStore = create<LeadsUIState & LeadsActions>()(
  devtools(
    (set, get) => ({
      optimisticLeads: null,
      previousLeads: null,
      editingLeadId: null,
      detailLeadId: null,
      createLeadStatus: null,

      setOptimisticLeads: (leads) =>
        set(
          { previousLeads: get().optimisticLeads, optimisticLeads: leads },
          false,
          'setOptimisticLeads'
        ),

      revertLeads: () =>
        set(
          (state) => ({ optimisticLeads: state.previousLeads, previousLeads: null }),
          false,
          'revertLeads'
        ),

      clearOptimistic: () =>
        set({ optimisticLeads: null, previousLeads: null }, false, 'clearOptimistic'),

      setEditingLeadId: (id) => set({ editingLeadId: id }, false, 'setEditingLeadId'),
      setDetailLeadId: (id) => set({ detailLeadId: id }, false, 'setDetailLeadId'),
      setCreateLeadStatus: (status) => set({ createLeadStatus: status }, false, 'setCreateLeadStatus'),
    }),
    { name: 'leads-store' }
  )
);
