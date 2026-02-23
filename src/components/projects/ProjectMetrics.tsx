import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, DollarSign, CheckSquare, TrendingUp } from 'lucide-react';
import type { ProjectTask, Project } from '@/types/projects';

interface Props {
  project: Project;
  tasks: ProjectTask[];
}

const ProjectMetrics: React.FC<Props> = ({ project, tasks }) => {
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.kanban_status === 'done' || t.kanban_status === 'billed'
    ).length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actual_hours ?? 0), 0);

    const totalCost = tasks.reduce((sum, t) => sum + (t.task_cost ?? 0), 0);
    const billedCost = tasks
      .filter((t) => t.billing_status === 'billed')
      .reduce((sum, t) => sum + (t.task_cost ?? 0), 0);
    const unbilledCost = totalCost - billedCost;

    return {
      totalTasks,
      completedTasks,
      progressPct,
      totalEstimatedHours,
      totalActualHours,
      totalCost,
      billedCost,
      unbilledCost,
    };
  }, [tasks]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const hoursVariance = metrics.totalActualHours - metrics.totalEstimatedHours;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Progresso — {metrics.completedTasks} de {metrics.totalTasks} tarefas concluídas
          </span>
          <span className="font-semibold">{metrics.progressPct}%</span>
        </div>
        <Progress value={metrics.progressPct} className="h-2" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Hours */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Horas</span>
            </div>
            <p className="text-2xl font-bold">{metrics.totalActualHours}h</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              de {metrics.totalEstimatedHours}h estimadas
            </p>
            {hoursVariance !== 0 && (
              <p className={`text-xs mt-1 font-medium ${hoursVariance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {hoursVariance > 0 ? `+${hoursVariance}h acima` : `${Math.abs(hoursVariance)}h abaixo`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total cost */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Custo total</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(metrics.totalCost)}</p>
            {project.budget != null && (
              <p className={`text-xs mt-1 font-medium ${metrics.totalCost > project.budget ? 'text-red-600' : 'text-emerald-600'}`}>
                {metrics.totalCost > project.budget
                  ? `${formatCurrency(metrics.totalCost - project.budget)} acima do orçamento`
                  : `${formatCurrency(project.budget - metrics.totalCost)} disponível`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Unbilled */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">A faturar</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(metrics.unbilledCost)}</p>
            {metrics.billedCost > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(metrics.billedCost)} faturado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckSquare className="h-4 w-4" />
              <span className="text-xs">Tarefas</span>
            </div>
            <p className="text-2xl font-bold">{metrics.completedTasks}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              de {metrics.totalTasks} concluídas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectMetrics;
