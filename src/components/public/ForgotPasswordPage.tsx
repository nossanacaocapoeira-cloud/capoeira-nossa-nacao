import React, { useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, KeyRound, Mail, CheckCircle2 } from 'lucide-react';

export function ForgotPasswordPage() {
  const { navigate } = useNavigation();
  const { resetPassword } = useAuth();
  const { success, error } = useToast();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error('Por favor, informe um e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetErr } = await resetPassword(email);
      if (resetErr) {
        error(`Erro ao solicitar recuperação: ${resetErr.message}`);
        return;
      }

      setSubmitted(true);
      success('Link de recuperação enviado para o seu e-mail!');
    } catch (err) {
      error('Ocorreu um erro inesperado.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-neutral-100 flex flex-col justify-center items-center px-4 py-8">
      {/* Back button */}
      <div className="w-full max-w-md mb-4">
        <button
          id="btn-back-to-login"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </button>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#15171a] border border-[#27292f] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">Recuperar Senha</h2>
          <p className="text-xs text-neutral-400">
            Informe o e-mail cadastrado na Capoeira Nossa Nação para receber as instruções.
          </p>
        </div>

        {submitted ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-200">Verifique seu e-mail!</p>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Enviamos um link para redefinir sua senha para <strong>{email}</strong>.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-2 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg transition"
            >
              Ir para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="input-reset-email" className="block text-xs font-semibold text-neutral-300 mb-1.5 uppercase tracking-wider">
                Seu E-mail Cadastrado
              </label>
              <div className="relative">
                <input
                  id="input-reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-3.5 py-2.5 pl-10 bg-[#101113] border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                />
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              id="btn-submit-reset-password"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
            >
              {loading ? 'Enviando link...' : 'Enviar Link de Recuperação'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
