import React, { useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { SupabaseSetupModal } from '../setup/SupabaseSetupModal';
import { isSupabaseConfigured } from '../../lib/supabase';
import capoeiraLogo from '../../assets/images/regenerated_image_1788977954111.png';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ShoppingBag,
  CreditCard,
  History,
  Cake,
  Settings,
  LogOut,
  Menu,
  X,
  Database,
  Shield,
  ArrowLeft,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { path, navigate } = useNavigation();
  const { profile, signOut, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Alunos', path: '/admin/alunos', icon: Users },
    { label: 'Mensalidades', path: '/admin/mensalidades', icon: Calendar },
    { label: 'Produtos', path: '/admin/produtos', icon: ShoppingBag },
    { label: 'Pagamentos', path: '/admin/pagamentos', icon: CreditCard },
    { label: 'Movimentações', path: '/admin/movimentacoes', icon: History },
    { label: 'Aniversariantes', path: '/admin/aniversariantes', icon: Cake },
    { label: 'Configurações', path: '/admin/configuracoes', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-neutral-100 flex flex-col md:flex-row selection:bg-amber-500 selection:text-black">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-[#141619]/95 backdrop-blur-md border-b border-[#25272d] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-neutral-900 border border-amber-500/30 flex-shrink-0 shadow-sm">
            <img
              src={capoeiraLogo}
              alt="Capoeira Nossa Nação"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider text-neutral-100 font-sans">
              Capoeira Nossa Nação
            </h1>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
              Painel Administrativo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-neutral-300 hover:text-white bg-[#1e2025] rounded-lg"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col justify-between bg-[#121316] border-r border-[#24262b] p-4 flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo & Academy */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 border border-amber-500/30 shadow-md shadow-amber-500/10 flex-shrink-0">
              <img
                src={capoeiraLogo}
                alt="Capoeira Nossa Nação"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-xs uppercase tracking-wide text-neutral-100">
                Capoeira Nossa Nação
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                  Administração
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive =
                item.path === '/admin'
                  ? path === '/admin'
                  : path.startsWith(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  id={`admin-nav-${item.path.replace(/\//g, '-')}`}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10 font-bold'
                      : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a1c20]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="pt-4 border-t border-[#222429] space-y-3">
          <button
            onClick={() => setShowSetupModal(true)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-mono border transition ${
              isSupabaseConfigured
                ? 'bg-[#181a1d] border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              {isSupabaseConfigured ? 'Supabase Ativo' : 'Conectar Banco'}
            </span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40">SQL</span>
          </button>

          <div className="px-2 py-1">
            <p className="text-xs font-bold text-neutral-200 truncate">
              {profile?.full_name || 'Administrador'}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">{profile?.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-admin-preview-student-area"
              onClick={() => navigate('/app')}
              className="flex-1 py-2 text-center text-[11px] text-neutral-400 hover:text-neutral-200 bg-[#17191d] hover:bg-[#202328] rounded-lg transition border border-neutral-800"
              title="Visualizar como Aluno"
            >
              Ver Área Aluno
            </button>
            <button
              id="btn-admin-logout"
              onClick={handleSignOut}
              className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition border border-neutral-800"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 h-full bg-[#121316] border-r border-[#25272d] p-5 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-neutral-950 font-black text-sm flex items-center justify-center">
                    CNN
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wide text-neutral-100">
                    Capoeira N. Nação
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const isActive =
                    item.path === '/admin'
                      ? path === '/admin'
                      : path.startsWith(item.path);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
                        isActive
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-[#1a1c20]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-neutral-800 space-y-3">
              <button
                onClick={() => {
                  navigate('/app');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 text-xs text-neutral-300 bg-[#1a1c20] hover:bg-[#25272d] rounded-xl font-medium transition"
              >
                Alternar para Área do Aluno
              </button>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 text-xs font-bold text-rose-400 bg-rose-950/30 hover:bg-rose-950/60 rounded-xl transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Content Canvas */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {children}
      </main>

      <SupabaseSetupModal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
