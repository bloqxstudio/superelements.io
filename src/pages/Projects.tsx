import React, { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useProjects, useProjectMutations } from '@/hooks/useProjects';
import { useProjectsStore } from '@/store/projectsStore';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderOpen, Plus, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ProjectCard from '@/components/projects/ProjectCard';
import ProjectForm from '@/components/projects/ProjectForm';
import ServiceCatalogManager from '@/components/projects/ServiceCatalogManager';
import type { Project, ProjectFormValues } from '@/types/projects';

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

const cardStagger = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const Projects: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id;

  const { data: projects = [], isLoading } = useProjects(wsId);
  const { createProject, updateProject, deleteProject } = useProjectMutations();
  const { serviceCatalogOpen, setServiceCatalogOpen } = useProjectsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { data: clientAccounts = [] } = useQuery({
    queryKey: ['client-accounts', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connections')
        .select('id, name')
        .eq('workspace_id', wsId!)
        .eq('connection_type', 'client_account')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const handleCreate = async (values: ProjectFormValues) => {
    await createProject.mutateAsync(values);
    setFormOpen(false);
  };

  const handleUpdate = async (values: ProjectFormValues) => {
    if (!editingProject) return;
    await updateProject.mutateAsync({ id: editingProject.id, values });
    setEditingProject(null);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteProject.mutate(id);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <motion.div
        className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.section variants={itemVariants} className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FolderOpen className="h-6 w-6" />
                Projetos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie projetos, tarefas e horas trabalhadas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-white hover:shadow-sm"
                onClick={() => setServiceCatalogOpen(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Serviços</span>
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo projeto
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Content */}
        {isLoading ? (
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-3xl" />
            ))}
          </motion.div>
        ) : projects.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="rounded-3xl border border-gray-200/70 bg-white p-12 shadow-sm flex flex-col items-center justify-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-gray-900">Nenhum projeto ainda</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Crie seu primeiro projeto para começar a organizar as demandas
            </p>
            <Button className="mt-5 rounded-xl" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar projeto
            </Button>
          </motion.div>
        ) : (
          <motion.div
            variants={cardStagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {projects.map((project) => (
              <motion.div key={project.id} variants={cardItem}>
                <ProjectCard
                  project={project}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Create project dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <ProjectForm
            clientAccounts={clientAccounts}
            onSubmit={handleCreate}
            isLoading={createProject.isPending}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit project dialog */}
      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm
              defaultValues={editingProject}
              clientAccounts={clientAccounts}
              onSubmit={handleUpdate}
              isLoading={updateProject.isPending}
              onCancel={() => setEditingProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Service catalog manager */}
      <ServiceCatalogManager
        open={serviceCatalogOpen}
        onOpenChange={setServiceCatalogOpen}
      />
    </div>
  );
};

export default Projects;
