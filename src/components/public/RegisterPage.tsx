import React, { useState, useRef } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { maskPhone, normalizePhone } from '../../lib/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseSetupModal } from '../setup/SupabaseSetupModal';
import capoeiraLogo from '../../assets/images/regenerated_image_1788977954111.png';
import { UserPlus, Eye, EyeOff, ArrowLeft, Database } from 'lucide-react';

export function RegisterPage() {
  const { navigate } = useNavigation();
  const { signUp } = useAuth();
  const { success, error } = useToast();

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const isSubmittingRef = useRef(false);

  // Maximum date of birth: today
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhone(e.target.value);
    setWhatsapp(masked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Impede execuções simultâneas ou múltiplos cliques acidentais
    if (loading || isSubmittingRef.current) {
      return;
    }

    if (!isSupabaseConfigured) {
      error('Supabase ainda não configurado. Clique no botão de banco para conectar.');
      setShowSetupModal(true);
      return;
    }

    // Validations
    if (!fullName.trim()) {
      error('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error('Por favor, informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      error('As senhas digitadas não coincidem.');
      return;
    }
    if (!dateOfBirth) {
      error('Informe sua data de nascimento.');
      return;
    }
    if (dateOfBirth > todayStr) {
      error('A data de nascimento não pode ser uma data futura.');
      return;
    }
    if (!address.trim()) {
      error('Por favor, informe seu endereço completo.');
      return;
    }

    const normPhone = normalizePhone(whatsapp);
    if (normPhone.length < 10) {
      error('Por favor, informe um número de WhatsApp válido com DDD.');
      return;
    }

    if (!agreedPrivacy) {
      error('Você deve concordar com os termos de privacidade para continuar.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const { error: signUpError, session: newSession } = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        nickname: nickname.trim() || undefined,
        dateOfBirth,
        address: address.trim(),
        whatsapp: whatsapp.trim(),
        whatsappNormalized: normPhone,
        guardianName: guardianName.trim() || undefined,
      });

      if (signUpError) {
        console.error('Supabase Auth Error:', signUpError);
        const errMsg = (signUpError.message || '').toLowerCase();
        const errStatus = (signUpError as { status?: number }).status;
        const errCode = (signUpError as { code?: string }).code;

        // Trata erro de limite de requisições / rate limit de e-mail (HTTP 429 ou over_email_send_rate_limit)
        if (
          errStatus === 429 ||
          errCode === 'over_email_send_rate_limit' ||
          errMsg.includes('rate limit') ||
          errMsg.includes('over_email_send_rate_limit') ||
          errMsg.includes('email rate limit exceeded') ||
          errMsg.includes('too many requests')
        ) {
          error('Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.');
          return;
        }

        if (errMsg.includes('already registered')) {
          error('Este e-mail já está cadastrado. Faça login em sua conta.');
          return;
        }

        error(`Erro no cadastro: ${signUpError.message}`);
        return;
      }

      // Depois de signUp com sucesso, verificar se existe sessão
      if (newSession) {
        success('Cadastro realizado com sucesso! Bem-vindo(a) à Capoeira Nossa Nação.');
        navigate('/app');
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          success('Cadastro realizado com sucesso! Bem-vindo(a) à Capoeira Nossa Nação.');
          navigate('/app');
        } else {
          success('Cadastro realizado com sucesso! Faça login para acessar sua conta.');
          navigate('/login');
        }
      }
    } catch (err) {
      console.error('Supabase Auth Error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('over_email_send_rate_limit') ||
        errMsg.toLowerCase().includes('429')
      ) {
        error('Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.');
      } else {
        error(`Erro inesperado durante o cadastro: ${errMsg}`);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-neutral-100 flex flex-col justify-center items-center px-4 py-8">
      {/* Top Bar */}
      <div className="w-full max-w-xl mb-4 flex items-center justify-between">
        <button
          id="btn-back-to-home"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </button>

        {!isSupabaseConfigured && (
          <button
            onClick={() => setShowSetupModal(true)}
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-mono"
          >
            <Database className="w-3.5 h-3.5" />
            Configurar Banco
          </button>
        )}
      </div>

      {/* Main Card */}
      <div className="w-full max-w-xl bg-[#15171a] border border-[#27292f] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-900 border border-amber-500/30 mx-auto shadow-md shadow-amber-500/10 flex-shrink-0">
            <img
              src={capoeiraLogo}
              alt="Capoeira Nossa Nação"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">Cadastro de Aluno</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div>
            <label htmlFor="input-full-name" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
              Nome Completo <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Ex: Leonardo Sabbadin Resende"
              className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
          </div>

          {/* Apelido na Capoeira */}
          <div>
            <label htmlFor="input-nickname" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
              Apelido na Capoeira <span className="text-neutral-500 font-normal lowercase tracking-normal">(opcional)</span>
            </label>
            <input
              id="input-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ex: Furacão, Gafanhoto... (se já tiver)"
              className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Como você é chamado nos treinos e nas rodas (caso já possua).
            </p>
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="input-email" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
              E-mail <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seuemail@exemplo.com"
              className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
          </div>

          {/* Senha e Confirmar Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-password" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                Senha <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2.5 pr-10 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                  aria-label="Alternar exibição de senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="input-confirm-password" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                Confirmar Senha <span className="text-amber-400">*</span>
              </label>
              <input
                id="input-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repita sua senha"
                className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>
          </div>

          {/* Data de Nascimento e WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-dob" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                Data de Nascimento <span className="text-amber-400">*</span>
              </label>
              <input
                id="input-dob"
                type="date"
                max={todayStr}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="input-whatsapp" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
                WhatsApp <span className="text-amber-400">*</span>
              </label>
              <input
                id="input-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={handlePhoneChange}
                required
                placeholder="(62) 99999-9999"
                className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label htmlFor="input-address" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
              Endereço Completo <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="Rua, Número, Bairro, Cidade - UF"
              className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
          </div>

          {/* Nome do Pai/Mãe (opcional) */}
          <div>
            <label htmlFor="input-guardian-name" className="block text-xs font-semibold text-neutral-300 mb-1 uppercase tracking-wider">
              Nome do Pai / Mãe <span className="text-neutral-500 font-normal lowercase tracking-normal">(opcional)</span>
            </label>
            <input
              id="input-guardian-name"
              type="text"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Ex: Nome da mãe, pai ou responsável"
              className="w-full px-3.5 py-2.5 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Opcional. Recomendado para alunos menores de idade ou contato de emergência.
            </p>
          </div>

          {/* LGPD / Termos Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                id="check-privacy-policy"
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-neutral-700 bg-[#101113] text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-xs text-neutral-300 leading-relaxed">
                Li e concordo com a Política de Privacidade e com o tratamento dos meus dados para funcionamento da minha conta na Capoeira Nossa Nação.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            id="btn-submit-register"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide mt-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                Criando conta...
              </span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Criar Minha Conta
              </>
            )}
          </button>
        </form>

        {/* Footer link to login */}
        <div className="pt-4 border-t border-[#25272b] text-center text-xs text-neutral-400">
          Já possui cadastro?{' '}
          <button
            id="btn-goto-login"
            onClick={() => navigate('/login')}
            className="font-bold text-amber-400 hover:text-amber-300 hover:underline ml-1"
          >
            Fazer login
          </button>
        </div>
      </div>

      <SupabaseSetupModal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
