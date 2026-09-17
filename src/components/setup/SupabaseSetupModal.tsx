import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { COMPLETE_SUPABASE_SQL } from '../../lib/sqlScript';
import { supabaseUrl, supabasePublishableKey, isSupabaseConfigured } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Database, Copy, Check, ExternalLink, ShieldAlert, Key, ShieldCheck } from 'lucide-react';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseSetupModal({ isOpen, onClose }: SupabaseSetupModalProps) {
  const { success, error } = useToast();
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(COMPLETE_SUPABASE_SQL);
      setCopiedSql(true);
      success('Script SQL copiado com sucesso! Cole no SQL Editor do Supabase.');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      error('Não foi possível copiar para a área de transferência.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conexão Supabase • Capoeira Nossa Nação"
      maxWidth="lg"
    >
      <div className="space-y-5 text-xs text-neutral-300">
        {/* Status banner */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            isSupabaseConfigured
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          }`}
        >
          <Database className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-bold text-sm">
              {isSupabaseConfigured
                ? 'Conexão Supabase Ativa'
                : 'Aguardando Variáveis de Ambiente do Supabase'}
            </p>
            <p className="text-neutral-400 leading-relaxed">
              {isSupabaseConfigured
                ? `Conectado ao projeto exclusivo: ${supabaseUrl}`
                : 'Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no painel do aplicativo.'}
            </p>
          </div>
        </div>

        {/* Exclusive Variables info */}
        <div className="p-4 bg-[#1b1d20] border border-[#2e3035] rounded-xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-neutral-100">
            <Key className="w-4 h-4 text-amber-400" />
            <span>Variáveis Padronizadas do Projeto</span>
          </div>

          <p className="text-neutral-400 leading-relaxed">
            Este aplicativo utiliza exclusivamente as seguintes variáveis de ambiente, sem dependência de chaves de projetos anteriores ou chaves administrativas:
          </p>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="p-3 bg-[#111214] border border-neutral-800 rounded-lg flex flex-col gap-1">
              <span className="text-amber-400 font-bold">VITE_SUPABASE_URL</span>
              <span className="text-neutral-300 break-all">{supabaseUrl || '(não definida no momento)'}</span>
            </div>

            <div className="p-3 bg-[#111214] border border-neutral-800 rounded-lg flex flex-col gap-1">
              <span className="text-amber-400 font-bold">VITE_SUPABASE_PUBLISHABLE_KEY</span>
              <span className="text-neutral-300 break-all">
                {supabasePublishableKey
                  ? `${supabasePublishableKey.slice(0, 16)}...${supabasePublishableKey.slice(-8)}`
                  : '(não definida no momento)'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-neutral-300 space-y-1">
            <p className="font-bold text-red-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Segurança & Chaves Permitidas
            </p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Utilize exclusivamente a chave pública (<code className="text-amber-300">VITE_SUPABASE_PUBLISHABLE_KEY</code>). Nunca utilize <code className="text-red-300">service_role</code>, <code className="text-red-300">sb_secret</code> ou qualquer credencial administrativa no cliente frontend.
            </p>
          </div>
        </div>

        {/* SQL Script Step */}
        <div className="p-4 bg-[#1b1d20] border border-[#2e3035] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-neutral-100">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Script SQL do Banco de Dados</span>
            </div>
            <button
              id="btn-copy-sql-script"
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-bold transition shadow"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copiado!' : 'Copiar SQL Completo'}</span>
            </button>
          </div>

          <p className="text-neutral-400 leading-relaxed">
            Execute este script uma única vez no <strong>SQL Editor</strong> do painel Supabase do novo projeto. Ele provisiona todas as tabelas (<code>profiles</code>, <code>monthly_fees</code>, <code>products</code>, <code>product_debts</code>, <code>payments</code>, <code>financial_movements</code>, <code>internal_notes</code>), políticas RLS e a função <code>is_admin()</code>.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSqlPreview(!showSqlPreview)}
              className="text-xs text-amber-400 hover:underline font-semibold"
            >
              {showSqlPreview ? 'Ocultar código SQL' : 'Visualizar código SQL'}
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              Abrir Supabase Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {showSqlPreview && (
            <pre className="max-h-60 overflow-y-auto p-3 bg-[#101113] border border-neutral-800 rounded-lg text-[11px] font-mono text-neutral-300 leading-relaxed select-all">
              {COMPLETE_SUPABASE_SQL}
            </pre>
          )}
        </div>

        {/* How to promote admin instruction */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-neutral-300 space-y-1.5">
          <p className="font-bold text-amber-300">Como promover uma conta para Administrador:</p>
          <p>
            Após cadastrar o usuário com o e-mail da academia (<code className="text-amber-200 font-mono">nossanacaocapoeira@gmail.com</code>), execute no SQL Editor do Supabase:
          </p>
          <code className="block p-2 bg-black/50 rounded font-mono text-[11px] text-amber-200 select-all">
            UPDATE public.profiles SET role = &apos;admin&apos; WHERE email = &apos;nossanacaocapoeira@gmail.com&apos;;
          </code>
        </div>
      </div>
    </Modal>
  );
}
