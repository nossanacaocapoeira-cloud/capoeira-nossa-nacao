import React from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { ArrowLeft } from 'lucide-react';

interface BackToHomeButtonProps {
  id?: string;
  className?: string;
}

export function BackToHomeButton({ id = 'btn-student-back-home', className = '' }: BackToHomeButtonProps) {
  const { navigate } = useNavigation();

  return (
    <div className={`w-fit ${className}`}>
      <button
        id={id}
        type="button"
        onClick={() => navigate('/app')}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] hover:bg-amber-500/10 border border-white/[0.06] hover:border-amber-500/30 text-xs font-semibold text-neutral-400 hover:text-amber-300 active:scale-95 transition-all cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 backdrop-blur-sm shadow-sm"
        aria-label="Voltar ao início"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-400 group-hover:-translate-x-1 transition-transform duration-200" />
        <span className="tracking-wide">Voltar ao início</span>
      </button>
    </div>
  );
}

