
import React, { useEffect, useRef } from 'react';
import { refreshPrelineComponents } from '@/lib/preline';
import { cn } from '@/lib/utils';

interface PrelineWrapperProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Force re-initialization of Preline components when content changes
   */
  refreshOnChange?: boolean;
}

export const PrelineWrapper: React.FC<PrelineWrapperProps> = ({
  children,
  className,
  refreshOnChange = true
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (refreshOnChange) {
      refreshPrelineComponents();
    }
  }, [children, refreshOnChange]);

  return (
    <div 
      ref={wrapperRef}
      className={cn("preline-wrapper", className)}
    >
      {children}
    </div>
  );
};
