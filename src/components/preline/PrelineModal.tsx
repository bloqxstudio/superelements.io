
import React from 'react';
import { PrelineWrapper } from './PrelineWrapper';
import { cn } from '@/lib/utils';

interface PrelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PrelineModal: React.FC<PrelineModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  return (
    <PrelineWrapper>
      <div
        className={cn(
          "hs-overlay hs-overlay-backdrop-open:bg-gray-900/50 size-full fixed top-0 start-0 z-[80] overflow-x-hidden overflow-y-auto",
          isOpen ? "hs-overlay-open:opacity-100 hs-overlay-open:duration-500" : "hidden"
        )}
      >
        <div className={cn("hs-overlay-open:opacity-100 hs-overlay-open:duration-500 opacity-0 transition-all sm:max-w-lg sm:w-full m-3 sm:mx-auto", sizeClasses[size])}>
          <div className={cn("flex flex-col bg-white border shadow-sm rounded-xl dark:bg-neutral-900 dark:border-neutral-800", className)}>
            <div className="flex justify-between items-center py-3 px-4 border-b dark:border-neutral-800">
              <h3 className="font-bold text-gray-800 dark:text-white">
                {title}
              </h3>
              <button
                type="button"
                className="size-8 inline-flex justify-center items-center gap-x-2 rounded-full border border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 focus:outline-none focus:bg-gray-200 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-neutral-400 dark:focus:bg-neutral-600"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <svg
                  className="shrink-0 size-4"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </PrelineWrapper>
  );
};
