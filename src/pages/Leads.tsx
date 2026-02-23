import React, { useCallback, useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLeads, useLeadMutations } from '@/hooks/useLeads';
import { useLeadsStore } from '@/store/leadsStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TrendingUp, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import LeadKanban from '@/components/leads/LeadKanban';
import LeadForm from '@/components/leads/LeadForm';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import type { Lead, LeadStatus, LeadFormValues } from '@/types/leads';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const Leads: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const { data: leads = [], isLoading } = useLeads(wsId);
  const { createLead, updateLead, deleteLead, moveLead } = useLeadMutations();

  const {
    optimisticLeads,
    setOptimisticLeads,
    revertLeads,
    clearOptimistic,
    detailLeadId,
    setDetailLeadId,
    editingLeadId,
    setEditingLeadId,
    createLeadStatus,
    setCreateLeadStatus,
  } = useLeadsStore();

  const [createOpen, setCreateOpen] = useState(false);

  const displayLeads = optimisticLeads ?? leads;
  const editingLead = leads.find((l) => l.id === editingLeadId) ?? null;

  // ── Optimistic drag-and-drop ──────────────────────────────────────────────

  const handleLeadsChange = useCallback(
    (affected: Array<{ id: string; kanban_status: LeadStatus; position: number }>) => {
      const updatedMap = new Map(affected.map((l) => [l.id, l]));
      const optimistic = leads.map((l) => {
        const update = updatedMap.get(l.id);
        if (!update) return l;
        return { ...l, kanban_status: update.kanban_status, position: update.position };
      });
      setOptimisticLeads(optimistic);
      moveLead.mutate(affected, {
        onSuccess: () => clearOptimistic(),
        onError: () => revertLeads(),
      });
    },
    [leads, setOptimisticLeads, clearOptimistic, revertLeads, moveLead]
  );

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async (values: LeadFormValues) => {
    await createLead.mutateAsync(values);
    setCreateOpen(false);
    setCreateLeadStatus(null);
  };

  const handleOpenCreate = (status: LeadStatus) => {
    setCreateLeadStatus(status);
    setCreateOpen(true);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEditLead = (lead: Lead) => {
    setEditingLeadId(lead.id);
  };

  const handleUpdate = async (values: LeadFormValues) => {
    if (!editingLeadId) return;
    await updateLead.mutateAsync({ id: editingLeadId, values });
    setEditingLeadId(null);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-[100vw] space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-start sm:items-center justify-between flex-wrap gap-3"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie leads e acompanhe o funil de vendas
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setCreateLeadStatus('new_lead');
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </Button>
        </motion.div>

        {/* Kanban */}
        <motion.div variants={itemVariants}>
          {isLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-lg" />
              ))}
            </div>
          ) : (
            <LeadKanban
              leads={displayLeads}
              onLeadsChange={handleLeadsChange}
              onEditLead={handleEditLead}
              onLeadClick={(lead) => setDetailLeadId(lead.id)}
              onAddLead={handleOpenCreate}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Create lead dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateLeadStatus(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
          </DialogHeader>
          <LeadForm
            initialStatus={(createLeadStatus as LeadStatus) ?? 'new_lead'}
            onSubmit={handleCreate}
            isLoading={createLead.isPending}
            onCancel={() => {
              setCreateOpen(false);
              setCreateLeadStatus(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit lead dialog */}
      <Dialog
        open={!!editingLeadId}
        onOpenChange={(open) => { if (!open) setEditingLeadId(null); }}
      >
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <LeadForm
              defaultValues={editingLead}
              onSubmit={handleUpdate}
              isLoading={updateLead.isPending}
              onCancel={() => setEditingLeadId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Lead detail sheet */}
      <LeadDetailSheet
        leadId={detailLeadId}
        onClose={() => setDetailLeadId(null)}
        onEditLead={(id) => {
          setDetailLeadId(null);
          setEditingLeadId(id);
        }}
      />
    </div>
  );
};

export default Leads;
