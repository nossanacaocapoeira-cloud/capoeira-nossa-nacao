import React, { useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseSetupModal } from '../setup/SupabaseSetupModal';
import capoeiraLogo from '../../assets/images/regenerated_image_1788977954111.png';
import { LogIn, Eye, EyeOff, ArrowLeft, Database, Mail, Lock, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { navigate } = useNavigation();
  const { signIn } = useAuth();
  const { success, error } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      error('Supabase ainda não configurado. Clique no botão de banco para configurar.');
      setShowSetupModal(true);
      return;
    }

    if (!email.trim() || !password) {
      error('Por favor, informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError, profile } = await signIn(email, password);

      if (signInError) {
        error(
          signInError.message.includes('Invalid login credentials')
            ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
            : `Erro ao fazer login: ${signInError.message}`
        );
        return;
      }

      success('Login realizado com sucesso!');

      // Redirect based on role
      if (profile?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } catch (err) {
      error('Ocorreu um erro ao conectar. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0d] text-neutral-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Background Atmospheric Layers & Subtle 3D Lighting */}
      <div className="absolute inset-0 bg-ambient-radial pointer-events-none" />
      <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-40" />

      {/* Subtle 3D floating aura sphere 1 (top center) */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[110px] pointer-events-none animate-aura-pulse" />

      {/* Subtle 3D floating shape 2 (bottom right) */}
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-amber-600/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Floating curved aesthetic lines representing motion & capoeira fluidity */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M -100,200 Q 300,50 600,450 T 1400,300"
          fill="none"
          stroke="url(#curveGrad)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
        <path
          d="M 100,-100 Q 500,250 800,100 T 1500,600"
          fill="none"
          stroke="url(#curveGrad)"
          strokeWidth="1"
        />
      </svg>

      {/* Top action bar */}
      <div className="w-full max-w-md mb-5 flex items-center justify-between z-10">
        <button
          id="btn-back-to-home"
          type="button"
          onClick={() => navigate('/')}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-amber-500/30 text-xs text-neutral-400 hover:text-amber-300 transition-all font-medium cursor-pointer backdrop-blur-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar ao início</span>
        </button>

        {!isSupabaseConfigured && (
          <button
            type="button"
            onClick={() => setShowSetupModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 hover:text-amber-200 font-mono transition backdrop-blur-sm cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Configurar Banco</span>
          </button>
        )}
      </div>

      {/* Floating Card with High-End Finish */}
      <div className="w-full max-w-md relative z-10 group">
        {/* Soft volumetric glow halo behind the card */}
        <div className="absolute -inset-1 bg-gradient-to-b from-amber-500/20 via-transparent to-amber-600/10 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-700 pointer-events-none" />

        <div className="relative bg-[#111317]/90 backdrop-blur-2xl border border-neutral-800/80 hover:border-amber-500/30 rounded-3xl p-7 sm:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.8)] transition-all duration-300 space-y-7">
          {/* Subtle top card glass reflection accent */}
          <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

          {/* Branding Header with 3D Depth */}
          <div className="text-center space-y-3">
            {/* Logo in 3D-styled concentric rings */}
            <div className="relative mx-auto w-20 h-20 mb-1">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl p-1 bg-gradient-to-br from-amber-400 via-amber-600 to-neutral-900 shadow-xl shadow-amber-950/40 flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] overflow-hidden bg-neutral-950 border border-amber-400/30">
                  <img
                    src={capoeiraLogo}
                    alt="Capoeira Nossa Nação"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Badge & Typography */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Portal Exclusivo • Área do Aluno
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-neutral-100 tracking-tight font-display">
                Capoeira <span className="text-amber-400">Nossa Nação</span>
              </h2>

              <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed pt-1">
                Acesse sua conta para acompanhar mensalidades, materiais, histórico e informações da academia.
              </p>
            </div>
          </div>

          {/* Supabase Warning if not configured */}
          {!isSupabaseConfigured && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-200">Supabase não conectado ainda</p>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Configure as credenciais VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ou clique abaixo para conectar.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSetupModal(true)}
                  className="underline font-bold text-amber-200 hover:text-white inline-block pt-1 cursor-pointer"
                >
                  Abrir painel de conexão
                </button>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-email"
                className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider font-mono"
              >
                E-mail
              </label>
              <div className="relative group/input">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within/input:text-amber-400 transition-colors pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-[#0c0d10] border border-neutral-800 focus:border-amber-500/80 focus:bg-[#0f1115] focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none transition duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-password"
                  className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider font-mono"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/recuperar-senha')}
                  className="text-xs text-amber-400 hover:text-amber-300 hover:underline transition font-medium cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative group/input">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within/input:text-amber-400 transition-colors pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-[#0c0d10] border border-neutral-800 focus:border-amber-500/80 focus:bg-[#0f1115] focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none transition duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 transition p-1 cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="btn-submit-login"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] disabled:opacity-50 text-neutral-950 font-black rounded-xl shadow-[0_4px_22px_rgba(245,158,11,0.28)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.4)] transition-all duration-200 flex items-center justify-center gap-2.5 text-xs uppercase tracking-widest cursor-pointer font-display"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Conectando...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                    <span>Entrar na Minha Conta</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer link to register */}
          <div className="pt-5 border-t border-neutral-800/80 flex items-center justify-center text-xs text-neutral-400 gap-1.5">
            <span>Ainda não tem cadastro?</span>
            <button
              id="btn-goto-register"
              type="button"
              onClick={() => navigate('/cadastro')}
              className="font-bold text-amber-400 hover:text-amber-300 hover:underline transition cursor-pointer"
            >
              Criar minha conta
            </button>
          </div>
        </div>
      </div>

      {/* Micro-badge bottom info */}
      <div className="mt-6 flex items-center gap-2 text-[11px] text-neutral-500 font-mono z-10">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
        <span>Acesso seguro & criptografado • Capoeira Nossa Nação</span>
      </div>

      <SupabaseSetupModal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}

