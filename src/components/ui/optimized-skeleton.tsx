
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface OptimizedSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'card' | 'text' | 'circle' | 'button';
}

function OptimizedSkeleton({
  className,
  count = 1,
  variant = 'card',
  ...props
}: OptimizedSkeletonProps & React.HTMLAttributes<HTMLDivElement>) {
  
  const getSkeletonContent = () => {
    switch (variant) {
      case 'card':
        return (
          <div className="rounded-lg border border-border bg-card">
            <Skeleton className="aspect-[4/3] w-full rounded-t-lg" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        );
      case 'text':
        return <Skeleton className="h-4 w-full" />;
      case 'circle':
        return <Skeleton className="h-12 w-12 rounded-full" />;
      case 'button':
        return <Skeleton className="h-10 w-24 rounded-md" />;
      default:
        return <Skeleton className="h-4 w-full" />;
    }
  };

  if (count === 1) {
    return (
      <div className={cn(className)} {...props}>
        {getSkeletonContent()}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} {...props}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          {getSkeletonContent()}
        </div>
      ))}
    </div>
  );
}

export { OptimizedSkeleton };
