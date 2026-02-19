import { useState } from 'react';
import { useResources, useResourceCategories } from '@/hooks/useResources';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ResourceCard } from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardStagger = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const sectionClass =
  'rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6';

const Resources = () => {
  const { activeWorkspace } = useWorkspace();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: resources, isLoading, error } = useResources({
    workspaceId: activeWorkspace?.id,
    category: selectedCategory,
  });
  const { data: categories } = useResourceCategories(activeWorkspace?.id);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Erro ao carregar recursos</h2>
            <p className="text-muted-foreground">Tente novamente mais tarde</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-6xl space-y-7"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section variants={itemVariants} className={sectionClass}>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Recursos</h1>
          <p className="text-sm text-muted-foreground">
            Acesse plugins, templates e materiais exclusivos para usuários PRO
          </p>
        </motion.section>

      {/* Category filters */}
        {categories && categories.length > 0 && (
          <motion.section variants={itemVariants} className={sectionClass}>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
              size="sm"
            >
              Todos
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
          </motion.section>
        )}

      {/* Resources grid */}
        {isLoading ? (
          <motion.section variants={itemVariants} className={sectionClass}>
          <motion.div variants={cardStagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div key={i} variants={cardItem} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </motion.div>
            ))}
          </motion.div>
          </motion.section>
        ) : resources && resources.length > 0 ? (
          <motion.section variants={itemVariants} className={sectionClass}>
          <motion.div variants={cardStagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((resource) => (
              <motion.div key={resource.id} variants={cardItem}>
                <ResourceCard resource={resource} />
              </motion.div>
            ))}
          </motion.div>
          </motion.section>
        ) : (
          <motion.section variants={itemVariants} className={sectionClass}>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <p className="text-muted-foreground text-lg">
              Nenhum recurso disponível no momento
            </p>
          </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
};

export default Resources;
