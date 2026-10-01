import React from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ACADEMY_INFO } from '../../lib/utils';
import capoeiraLogo from '../../assets/images/regenerated_image_1788977954111.png';
import { MessageCircle, Instagram, UserPlus, LogIn, Sparkles, ArrowRight } from 'lucide-react';

export function LandingPage() {
  const { navigate } = useNavigation();
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-[#090a0d] text-neutral-100 flex flex-col justify-between relative overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Hero Background Image (Apache) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[image:url('/assets/Apache.png'),url('/Apache.png')] bg-cover bg-no-repeat bg-[position:50%_18%] sm:bg-[position:50%_22%] lg:bg-[position:50%_24%]"
      />

      {/* Camada de Overlay Escura (~0.60) para contraste cinematográfico e leitura perfeita */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.56)_35%,rgba(0,0,0,0.64)_70%,rgba(0,0,0,0.72)_100%)]"
      />

      {/* Top Bar Header */}
      <header className="relative z-10 px-6 py-5 border-b border-white/[0.06] backdrop-blur-md bg-[#090a0d]/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative w-11 h-11 rounded-xl p-0.5 bg-gradient-to-br from-amber-400 via-amber-600 to-neutral-900 shadow-md shadow-amber-950/30 flex-shrink-0">
              <div className="w-full h-full rounded-[10px] overflow-hidden bg-neutral-950">
                <img
                  src={capoeiraLogo}
                  alt="Capoeira Nossa Nação"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-wider text-neutral-100 uppercase font-display">
                Capoeira Nossa Nação
              </h1>
              <p className="text-[10px] font-mono text-amber-400/90 tracking-wide">
                Tradição, Disciplina & Movimento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-nav-login"
              type="button"
              onClick={() => navigate(user ? (role === 'admin' ? '/admin' : '/app') : '/login')}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-500/30 text-xs font-semibold text-neutral-300 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>{user ? 'Acessar Painel' : 'Entrar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16 sm:py-24 max-w-4xl mx-auto w-full">
        <div className="w-full text-center space-y-10">
          {/* Subtle floating 3D badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/45 border border-amber-500/30 text-xs font-mono text-amber-300 font-semibold shadow-lg shadow-black/40 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Portal Oficial dos Alunos</span>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-5 max-w-3xl mx-auto">
            <p className="text-sm sm:text-base text-neutral-200 max-w-xl mx-auto leading-relaxed font-normal drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              Acompanhe suas mensalidades, materiais, graduações e histórico financeiro com total transparência e praticidade em uma experiência premium.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
            <button
              id="btn-landing-login"
              type="button"
              onClick={() => navigate(user ? (role === 'admin' ? '/admin' : '/app') : '/login')}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-neutral-950 font-black rounded-2xl shadow-[0_4px_25px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_32px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer font-display"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>Acessar Minha Conta</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              id="btn-landing-register"
              type="button"
              onClick={() => navigate('/cadastro')}
              className="w-full sm:w-auto px-7 py-4 bg-[#14161a]/90 hover:bg-[#1c1f24] text-neutral-200 hover:text-white border border-neutral-700/70 hover:border-amber-500/40 font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer backdrop-blur-sm"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Criar Minha Conta</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer & Academy Contacts */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#07080a]/90 backdrop-blur-lg px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="text-center sm:text-left space-y-1">
            <p className="font-semibold text-neutral-200">{ACADEMY_INFO.name}</p>
            <p className="text-neutral-400">Goiânia - GO • Brasil</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              id="link-footer-whatsapp"
              href={ACADEMY_INFO.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/50 transition font-medium cursor-pointer shadow-sm"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp: {ACADEMY_INFO.whatsapp}</span>
            </a>

            <a
              id="link-footer-instagram"
              href={ACADEMY_INFO.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 border border-amber-500/25 hover:border-amber-500/50 transition font-medium cursor-pointer shadow-sm"
            >
              <Instagram className="w-4 h-4 text-amber-400" />
              <span>{ACADEMY_INFO.instagram}</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

