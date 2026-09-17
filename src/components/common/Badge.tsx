import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'neutral',
  children,
  className = '',
  size = 'md',
}: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  const variantClasses = {
    success: 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300',
    warning: 'bg-amber-950/70 border border-amber-500/40 text-amber-300',
    danger: 'bg-rose-950/70 border border-rose-500/40 text-rose-300',
    info: 'bg-sky-950/70 border border-sky-500/40 text-sky-300',
    neutral: 'bg-neutral-800 border border-neutral-700 text-neutral-300',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase tracking-wider font-mono ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </span>
  );
}
