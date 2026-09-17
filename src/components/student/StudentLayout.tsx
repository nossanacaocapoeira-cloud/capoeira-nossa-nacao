import React from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import capoeiraLogo from '../../assets/images/regenerated_image_1788977954111.png';
import { Home, Calendar, ShoppingBag, History, User, LogOut, Eye, ArrowLeft, Sparkles } from 'lucide-react';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const { path, navigate, previewStudent, setPreviewStudent } = useNavigation();
  const { profile, signOut } = useAuth();

  const isAdminViewing = profile?.role === 'admin' || previewStudent !== null;

  const navItems = [
    { label: 'Início', path: '/app', icon: Home },
    { label: 'Mensalidades', path: '/app/mensalidades', icon: Calendar },
    { label: 'Produtos', path: '/app/produtos', icon: ShoppingBag },
    { label: 'Histórico', path: '/app/historico', icon: History },
    { label: 'Perfil', path: '/app/perfil', icon: User },
  ];

  const studentDisplayName = previewStudent?.name || profile?.nickname || profile?.full_name || 'Aluno';
  const studentInitials = studentDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  return (
    <div className="min-h-screen bg-[#090a0d] text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black pb-28 md:pb-12 relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 bg-ambient-radial pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-subtle-grid pointer-events-none opacity-25 -z-10" />

      {/* Top Banner for Admin Student Preview Mode */}
      {isAdminViewing && (
        <div
          id="bar-admin-student-preview"
          className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-neutral-950 px-4 py-2 text-xs font-black flex items-center justify-between shadow-xl sticky top-0 z-50 border-b border-amber-600/60 font-display"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-neutral-950 flex-shrink-0 animate-pulse" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="hidden xs:inline">Modo Visualização:</span>
              <span>
                Visualizando como{' '}
                <strong className="underline underline-offset-2">
                  {studentDisplayName}
                </strong>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] bg-neutral-950/15 font-mono uppercase tracking-wider font-bold">
                Apenas Leitura
              </span>
            </div>
          </div>

          <button
            id="btn-return-admin-panel"
            type="button"
            onClick={() => {
              setPreviewStudent(null);
              navigate('/admin');
            }}
            className="px-3 py-1 bg-neutral-950 hover:bg-neutral-900 text-amber-400 text-xs font-black rounded-lg transition shadow flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" />
            <span>PAINEL ADMIN</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <header
        className={`sticky ${
          isAdminViewing ? 'top-10' : 'top-0'
        } z-30 bg-[#0c0d11]/85 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6 py-3.5 transition-all`}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Logo & Academy Label */}
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="flex items-center gap-3 text-left group cursor-pointer"
          >
            <div className="relative w-9 h-9 rounded-xl p-0.5 bg-gradient-to-br from-amber-400 via-amber-600 to-neutral-900 shadow-md shadow-amber-950/30 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
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
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-extrabold uppercase tracking-wider text-neutral-100 font-display group-hover:text-amber-300 transition-colors">
                  Capoeira Nossa Nação
                </h1>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-[10px] font-mono text-amber-400 font-semibold tracking-wide">
                  Área do Aluno
                </p>
              </div>
            </div>
          </button>

          {/* User profile & actions */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-neutral-200 truncate max-w-[140px]">
                {studentDisplayName}
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {isAdminViewing ? 'Modo Visualização' : 'Aluno Oficial'}
              </span>
            </div>

            {/* Avatar Pill with Initials */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-900/30 border border-amber-500/40 text-amber-300 font-bold font-mono text-xs flex items-center justify-center shadow-inner">
              {studentInitials}
            </div>

            {isAdminViewing ? (
              <button
                id="btn-quick-exit-preview"
                type="button"
                onClick={() => {
                  setPreviewStudent(null);
                  navigate('/admin');
                }}
                className="px-2.5 py-1 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition border border-amber-500/30 cursor-pointer"
                title="Voltar ao Painel Admin"
              >
                Voltar Admin
              </button>
            ) : (
              <button
                id="btn-student-logout"
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }}
                className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                title="Sair da Conta"
                aria-label="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 relative z-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Floating Dock) */}
      <nav
        id="student-bottom-nav"
        className="fixed bottom-3 left-4 right-4 z-40 md:hidden"
      >
        <div className="max-w-md mx-auto bg-[#101217]/92 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.85)] rounded-2xl px-2 py-1.5 flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = path.split('?')[0] === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                id={`nav-item-${item.path.replace(/\//g, '-')}`}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                  isActive
                    ? 'text-amber-300 font-bold scale-105'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5] text-amber-400' : 'stroke-2'}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
                  )}
                </div>
                <span className="text-[10px] mt-1.5 tracking-tight font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

