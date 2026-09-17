import React from 'react';
import { ShieldCheck, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon: Icon = ShieldCheck,
  action,
}: EmptyStateProps) {
  return (
    <div
      id="empty-state"
      className="flex flex-col items-center justify-center p-8 text-center bg-[#18191c]/60 border border-[#2a2c30] rounded-2xl my-4"
    >
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-neutral-200">{title}</h3>
      {description && <p className="text-sm text-neutral-400 max-w-sm mt-1">{description}</p>}
      {action && (
        <button
          id="btn-empty-state-action"
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg transition shadow"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
