
import React, { useState } from 'react';
import { PrelineWrapper } from './PrelineWrapper';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface PrelineTabsProps {
  tabs: Tab[];
  defaultActiveTab?: string;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export const PrelineTabs: React.FC<PrelineTabsProps> = ({
  tabs,
  defaultActiveTab,
  className,
  variant = 'default'
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.id);

  const variantClasses = {
    default: "border-b border-gray-200 dark:border-neutral-700",
    pills: "bg-gray-100 rounded-lg p-1 dark:bg-neutral-800",
    underline: "border-b-2 border-transparent"
  };

  const tabClasses = {
    default: "py-4 px-1 inline-flex items-center gap-x-2 border-b-2 border-transparent text-sm whitespace-nowrap text-gray-500 hover:text-blue-600 focus:outline-none focus:text-blue-600 disabled:opacity-50 disabled:pointer-events-none dark:text-neutral-400 dark:hover:text-blue-500",
    pills: "py-3 px-4 inline-flex items-center gap-x-2 bg-transparent text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 disabled:opacity-50 disabled:pointer-events-none dark:text-neutral-400 dark:hover:text-white dark:focus:text-white rounded-lg",
    underline: "py-4 px-1 inline-flex items-center gap-x-2 border-b-2 border-transparent text-sm whitespace-nowrap text-gray-500 hover:text-blue-600 focus:outline-none focus:text-blue-600 disabled:opacity-50 disabled:pointer-events-none dark:text-neutral-400 dark:hover:text-blue-500"
  };

  const activeClasses = {
    default: "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500",
    pills: "bg-white text-gray-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-400",
    underline: "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
  };

  return (
    <PrelineWrapper className={className}>
      <div>
        <nav className={cn("flex space-x-2", variantClasses[variant])} aria-label="Tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                tabClasses[variant],
                activeTab === tab.id && activeClasses[variant]
              )}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-3">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={activeTab === tab.id ? "block" : "hidden"}
              role="tabpanel"
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </PrelineWrapper>
  );
};
