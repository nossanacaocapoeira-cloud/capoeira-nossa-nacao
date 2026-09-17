import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { isSupabaseConfigured, getSupabaseConfig } from '../../lib/supabase';
import { SUPABASE_SCHEMA_SQL } from '../../lib/sqlScript';
import { ACADEMY_INFO } from '../../lib/utils';
import { SupabaseSetupModal } from '../setup/SupabaseSetupModal';
import {
  Database,
  Copy,
  Check,
  ShieldCheck,
  Settings,
  Terminal,
} from 'lucide-react';

export function AdminSettings() {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const config = getSupabaseConfig();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopied(true);
    success('Script SQL copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
          Sistema & Banco de Dados
        </span>
        <h2 className="text-2xl font-black tracking-tight text-neutral-100">
          Configurações da Academia
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Parâmetros do sistema, integração com o Supabase e script de banco de dados
        </p>
      </div>

      {/* Supabase Connection Status Card */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-neutral-100">Conexão com o Supabase</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                    isSupabaseConfigured
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isSupabaseConfigured ? 'Conectado' : 'Aguardando Variáveis'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isSupabaseConfigured
                  ? `URL: ${config.url}`
                  : 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'}
              </p>
            </div>
          </div>

          <button
            id="btn-settings-open-supabase-modal"
            onClick={() => setShowSetupModal(true)}
            className="px-4 py-2 bg-[#1e2126] hover:bg-[#282c33] text-neutral-200 border border-[#30343d] rounded-xl text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Verificar Conexão & SQL</span>
          </button>
        </div>
      </div>

      {/* Academy Info Card */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-neutral-100">Dados da Academia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-[#101113] rounded-xl border border-neutral-800 space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400">Nome Oficial</span>
            <p className="font-bold text-neutral-200">{ACADEMY_INFO.name}</p>
          </div>

          <div className="p-3.5 bg-[#101113] rounded-xl border border-neutral-800 space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400">WhatsApp Oficial</span>
            <p className="font-bold text-emerald-400">{ACADEMY_INFO.whatsapp}</p>
          </div>

          <div className="p-3.5 bg-[#101113] rounded-xl border border-neutral-800 space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400">Instagram Oficial</span>
            <p className="font-bold text-amber-400">{ACADEMY_INFO.instagram}</p>
          </div>

          <div className="p-3.5 bg-[#101113] rounded-xl border border-neutral-800 space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400">
              Mensalidade Padrão / Vencimento
            </span>
            <p className="font-bold text-neutral-200">R$ 120,00 • Todo dia 10</p>
          </div>
        </div>
      </div>

      {/* Grant Admin Command Box */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-neutral-200">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base">Promover Usuário para Administrador</h3>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Para promover qualquer conta de aluno cadastrada para Administrador do sistema, execute este comando no{' '}
          <strong>SQL Editor</strong> do seu Supabase:
        </p>
        <div className="p-3 bg-[#0d0e10] rounded-xl border border-neutral-800 font-mono text-xs text-amber-300 flex items-center justify-between">
          <code>UPDATE public.profiles SET role = 'admin' WHERE email = 'SEU_EMAIL_AQUI';</code>
        </div>
      </div>

      {/* SQL Script Viewer */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-base text-neutral-100">Script SQL das Tabelas (Supabase)</h3>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Tabelas, RLS, triggers e funções necessárias para o funcionamento completo
            </p>
          </div>

          <button
            id="btn-copy-full-sql-settings"
            onClick={handleCopySql}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition self-start sm:self-auto"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Script SQL'}</span>
          </button>
        </div>

        <div className="relative">
          <pre className="p-4 bg-[#0d0e10] border border-neutral-800 rounded-xl text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-80 leading-relaxed">
            {SUPABASE_SCHEMA_SQL}
          </pre>
        </div>
      </div>

      <SupabaseSetupModal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
