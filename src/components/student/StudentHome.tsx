import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, StudentFinancialSummary } from '../../lib/dbService';
import { formatCurrency, formatDate, ACADEMY_INFO } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ShoppingBag,
  Clock,
  ArrowRight,
  MessageCircle,
  Instagram,
  RefreshCw,
  Info,
} from 'lucide-react';

// Funções isoladas para cálculo financeiro do aluno sem misturar mensalidades e produtos
function getMonthlyBreakdown(summary: StudentFinancialSummary | null) {
  const totalMonthlyOpen = Number(summary?.totalMonthlyOpen ?? 0);
  const openFeesCount = summary?.openFeesCount ?? 0;
  const overdueCount = summary?.overdueCount ?? 0;
  const totalFeesEver = summary?.totalFeesEver ?? 0;

  let monthlyStatus: 'SEM_MENSALIDADE' | 'EM_DIA' | 'PENDENTE' | 'EM_ATRASO' = 'SEM_MENSALIDADE';
  if (totalFeesEver === 0) {
    monthlyStatus = 'SEM_MENSALIDADE';
  } else if (overdueCount > 0) {
    monthlyStatus = 'EM_ATRASO';
  } else if (totalMonthlyOpen > 0) {
    monthlyStatus = 'PENDENTE';
  } else {
    monthlyStatus = 'EM_DIA';
  }

  return {
    totalMonthlyOpen,
    openFeesCount,
    overdueCount,
    totalFeesEver,
    monthlyStatus,
  };
}

function getProductBreakdown(summary: StudentFinancialSummary | null) {
  const totalProductOpen = Number(summary?.totalProductOpen ?? 0);
  const openDebtsCount = summary?.openDebtsCount ?? 0;
  const totalDebtsEver = summary?.totalDebtsEver ?? 0;

  const productStatus: 'NENHUM_DEBITO' | 'PENDENTE' =
    totalProductOpen > 0 ? 'PENDENTE' : 'NENHUM_DEBITO';

  return {
    totalProductOpen,
    openDebtsCount,
    totalDebtsEver,
    productStatus,
  };
}

export function StudentHome() {
  const { user, profile } = useAuth();
  const { navigate, previewStudent } = useNavigation();
  const [summary, setSummary] = useState<StudentFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const targetStudentId = previewStudent?.id || user?.id;
  const studentName = previewStudent?.name || profile?.nickname || profile?.full_name?.split(' ')[0] || 'Aluno';

  const loadSummary = useCallback(async () => {
    if (!targetStudentId) return;
    try {
      const data = await dbService.getStudentSummary(targetStudentId);
      setSummary(data);
    } catch (err) {
      console.error('Erro ao carregar resumo do aluno:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetStudentId]);

  useEffect(() => {
    loadSummary();

    // Refetch on window focus
    const onFocus = () => loadSummary();
    window.addEventListener('focus', onFocus);

    // Realtime subscription
    if (user) {
      const feeSub = supabase
        .channel(`student_fees_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'monthly_fees', filter: `student_id=eq.${user.id}` },
          () => loadSummary()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'product_debts', filter: `student_id=eq.${user.id}` },
          () => loadSummary()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments', filter: `student_id=eq.${user.id}` },
          () => loadSummary()
        )
        .subscribe();

      return () => {
        window.removeEventListener('focus', onFocus);
        supabase.removeChannel(feeSub);
      };
    }

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [loadSummary, targetStudentId]);

  // Cálculos segregados por obrigação financeira
  const {
    totalMonthlyOpen,
    openFeesCount,
    overdueCount,
    totalFeesEver,
    monthlyStatus: monthlyFeeStatus,
  } = getMonthlyBreakdown(summary);

  const {
    totalProductOpen,
    openDebtsCount,
    totalDebtsEver,
    productStatus: productDebtStatus,
  } = getProductBreakdown(summary);

  const totalOpen = Number((totalMonthlyOpen + totalProductOpen).toFixed(2));
  const hasPendingMonthly = totalMonthlyOpen > 0;
  const hasPendingProduct = totalProductOpen > 0;
  const hasAnyPending = hasPendingMonthly || hasPendingProduct;
  const isOverdue = overdueCount > 0;
  const isAllClear = !hasAnyPending && (totalFeesEver > 0 || totalDebtsEver > 0);

  const cardBgStyle = loading
    ? 'bg-[#111317]/90 border-neutral-800/80 shadow-2xl'
    : isOverdue
    ? 'bg-gradient-to-br from-[#201013]/95 via-[#170c0e]/95 to-[#10080a]/95 border-rose-500/40 text-rose-200 shadow-[0_15px_40px_rgba(244,63,94,0.18)]'
    : hasAnyPending
    ? 'bg-gradient-to-br from-[#1e170e]/95 via-[#17120a]/95 to-[#100e0a]/95 border-amber-500/40 text-amber-200 shadow-[0_15px_40px_rgba(245,158,11,0.18)]'
    : isAllClear
    ? 'bg-gradient-to-br from-[#0e1913]/95 via-[#0b140f]/95 to-[#090f0c]/95 border-emerald-500/40 text-emerald-200 shadow-[0_15px_40px_rgba(16,185,129,0.18)]'
    : 'bg-gradient-to-br from-[#121418]/95 to-[#0b0c0f]/95 border-neutral-800 text-neutral-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)]';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting Section with High-End Typography */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90 font-bold">
              Painel do Aluno • Capoeira Nossa Nação
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100 font-display">
            Olá, <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">{studentName}</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
            Acompanhe suas mensalidades, produtos e histórico com total clareza.
          </p>
        </div>

        <button
          id="btn-refresh-student-summary"
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadSummary();
          }}
          className="p-2.5 text-neutral-400 hover:text-amber-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-2xl transition cursor-pointer backdrop-blur-sm shadow-sm flex-shrink-0 active:scale-95"
          title="Atualizar dados"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Primary Status Card: SUA SITUAÇÃO (Hero Card with 3D Depth) */}
      <div
        id="card-student-status"
        className={`p-6 sm:p-7 rounded-3xl border transition-all duration-300 relative overflow-hidden space-y-6 backdrop-blur-xl ${cardBgStyle}`}
      >
        {/* Subtle glass reflection highlight at the top border */}
        <div className="absolute top-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Top Summary & Badge */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold">
                Situação Geral da Conta
              </span>
            </div>

            {loading ? (
              <div className="h-8 w-44 bg-neutral-800/80 rounded-xl animate-pulse"></div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {isOverdue ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-sm shadow-rose-950/40">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Mensalidade em Atraso
                  </span>
                ) : hasPendingMonthly && hasPendingProduct ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-950/40">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Pendências Financeiras
                  </span>
                ) : hasPendingMonthly ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-950/40">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Mensalidade Pendente
                  </span>
                ) : hasPendingProduct ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-950/40">
                    <ShoppingBag className="w-4 h-4 text-amber-400" />
                    {openDebtsCount === 1 ? '1 Produto Pendente' : `${openDebtsCount} Produtos Pendentes`}
                  </span>
                ) : isAllClear ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-950/40">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Tudo em Dia • Sem Pendências
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-300">
                    <Info className="w-4 h-4 text-neutral-400" />
                    Sem Mensalidade Cadastrada
                  </span>
                )}
              </div>
            )}

            <p className="text-sm font-medium text-neutral-200 leading-relaxed max-w-md">
              {loading ? (
                'Carregando sua situação...'
              ) : isOverdue ? (
                'Você possui mensalidade vencida. Regularize com a coordenação para manter seu acesso sem pendências.'
              ) : hasPendingMonthly && hasPendingProduct ? (
                'Você possui mensalidade e débitos de produtos em aberto aguardando acerto.'
              ) : hasPendingMonthly ? (
                `Você possui ${formatCurrency(totalMonthlyOpen)} em mensalidade aguardando vencimento regular.`
              ) : hasPendingProduct ? (
                `Você possui ${openDebtsCount === 1 ? '1 produto pendente' : `${openDebtsCount} produtos pendentes`} (${formatCurrency(totalProductOpen)} em aberto).`
              ) : isAllClear ? (
                'Parabéns! Todas as suas mensalidades e produtos estão em dia com a Capoeira Nossa Nação.'
              ) : (
                'Ainda não há mensalidades cadastradas no sistema para você.'
              )}
            </p>
          </div>

          {!loading && hasAnyPending && (
            <div className="text-left sm:text-right shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/10 flex flex-col sm:items-end">
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 block font-mono font-bold">
                Total Geral em Aberto
              </span>
              <span
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5 ${
                  isOverdue ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {formatCurrency(totalOpen)}
              </span>
              <span className="text-[10px] text-neutral-400 mt-0.5">
                Mensalidades + Materiais
              </span>
            </div>
          )}
        </div>

        {/* Separated Interactive Cards: MENSALIDADES & PRODUTOS / MATERIAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-white/10">
          {/* MENSALIDADES */}
          <button
            id="status-box-mensalidades"
            type="button"
            onClick={() => navigate('/app/mensalidades')}
            className="p-4 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/[0.08] hover:border-amber-500/40 transition-all duration-200 text-left flex items-start justify-between gap-3 group cursor-pointer shadow-sm relative overflow-hidden"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <div className="w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Calendar className="w-3 h-3" />
                </div>
                <span className="font-bold tracking-wide">Mensalidades</span>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                {monthlyFeeStatus === 'EM_ATRASO' ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-xs font-bold text-rose-300">Mensalidade em atraso</span>
                  </>
                ) : monthlyFeeStatus === 'PENDENTE' ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      {formatCurrency(totalMonthlyOpen)} pendente
                    </span>
                  </>
                ) : monthlyFeeStatus === 'EM_DIA' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-300">Mensalidades em dia</span>
                  </>
                ) : (
                  <>
                    <Info className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className="text-xs font-bold text-neutral-300">Sem mensalidade cadastrada</span>
                  </>
                )}
              </div>

              <p className="text-[11px] text-neutral-400">
                {monthlyFeeStatus === 'EM_ATRASO'
                  ? `${formatCurrency(totalMonthlyOpen)} vencida (${overdueCount} em atraso)`
                  : monthlyFeeStatus === 'PENDENTE'
                  ? 'Aguardando vencimento regular'
                  : monthlyFeeStatus === 'EM_DIA'
                  ? 'Nenhuma mensalidade pendente'
                  : 'Ainda não há mensalidades cadastradas no sistema para você.'}
              </p>
            </div>

            <div className="w-7 h-7 rounded-xl bg-white/[0.04] group-hover:bg-amber-500/20 group-hover:text-amber-300 text-neutral-500 flex items-center justify-center transition-all shrink-0 mt-1">
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* PRODUTOS / MATERIAIS */}
          <button
            id="status-box-produtos"
            type="button"
            onClick={() => navigate('/app/produtos')}
            className="p-4 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/[0.08] hover:border-amber-500/40 transition-all duration-200 text-left flex items-start justify-between gap-3 group cursor-pointer shadow-sm relative overflow-hidden"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                <div className="w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ShoppingBag className="w-3 h-3" />
                </div>
                <span className="font-bold tracking-wide">Produtos & Materiais</span>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                {productDebtStatus === 'PENDENTE' ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      {openDebtsCount === 1 ? '1 produto pendente' : `${openDebtsCount} produtos pendentes`}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-300">Nenhum produto pendente</span>
                  </>
                )}
              </div>

              <p className="text-[11px] text-neutral-400">
                {productDebtStatus === 'PENDENTE'
                  ? `${formatCurrency(totalProductOpen)} em aberto`
                  : 'Tudo quitado ou sem débitos'}
              </p>
            </div>

            <div className="w-7 h-7 rounded-xl bg-white/[0.04] group-hover:bg-amber-500/20 group-hover:text-amber-300 text-neutral-500 flex items-center justify-center transition-all shrink-0 mt-1">
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>

      {/* Metrics Grid (2x2 Cards with High-End Finish) */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
        {/* Mensalidades em Aberto */}
        <button
          id="btn-metric-fees"
          type="button"
          onClick={() => navigate('/app/mensalidades')}
          className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/40 transition-all duration-200 text-left space-y-2.5 group cursor-pointer backdrop-blur-md shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Mensalidades</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-100 font-mono">
              {loading ? '-' : openFeesCount}
            </span>
            <p className="text-[11px] text-neutral-400">
              {openFeesCount === 1 ? '1 em aberto' : `${openFeesCount} em aberto`}
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1 text-[11px] text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
            <span>Ver detalhes</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        {/* Produtos em Débito */}
        <button
          id="btn-metric-products"
          type="button"
          onClick={() => navigate('/app/produtos')}
          className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/40 transition-all duration-200 text-left space-y-2.5 group cursor-pointer backdrop-blur-md shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Produtos</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-2xl sm:text-3xl font-black text-neutral-100 font-mono">
              {loading ? '-' : openDebtsCount}
            </span>
            <p className="text-[11px] text-neutral-400">
              {openDebtsCount === 1 ? '1 em aberto' : `${openDebtsCount} em aberto`}
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1 text-[11px] text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
            <span>Ver detalhes</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        {/* Total Geral em Aberto */}
        <div
          id="card-metric-total-open"
          className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] space-y-2.5 backdrop-blur-md shadow-lg"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Total em Aberto</span>
            <span className="text-[10px] text-amber-400/90 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-bold">
              BRL
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-lg sm:text-2xl font-black text-amber-400 font-mono">
              {loading ? '-' : formatCurrency(totalOpen)}
            </span>
            <p className="text-[11px] text-neutral-400">Mensalidades + Produtos</p>
          </div>
        </div>

        {/* Próximo Vencimento (SOMENTE MENSALIDADES) */}
        <div
          id="card-metric-next-due"
          className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] space-y-2.5 backdrop-blur-md shadow-lg"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Próx. Vencimento</span>
            <div className="w-7 h-7 rounded-xl bg-white/[0.04] text-neutral-400 flex items-center justify-center border border-white/[0.06]">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-base sm:text-xl font-bold text-neutral-200 font-mono">
              {loading ? '-' : hasPendingMonthly && summary?.nextDueDate ? formatDate(summary.nextDueDate) : 'Nenhum'}
            </span>
            <p className="text-[11px] text-neutral-400">
              {loading
                ? '-'
                : hasPendingMonthly && overdueCount > 0
                ? `${overdueCount} já vencida(s)`
                : hasPendingMonthly && summary?.nextDueDate
                ? 'Mensalidade mais próxima'
                : 'Sem mensalidade pendente'}
            </p>
          </div>
        </div>
      </div>

      {/* Section: Precisa Falar com a Academia? (Concierge Style) */}
      <div className="p-6 rounded-3xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/20 transition-all space-y-5 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              <span>Canal de Atendimento</span>
            </div>
            <h3 className="text-base font-bold text-neutral-100 font-display">
              Precisa Falar com a Academia?
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed max-w-lg">
              Tire dúvidas sobre mensalidades, treinos, uniformes ou graduações diretamente com o mestre e a equipe.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <a
            id="btn-student-contact-whatsapp"
            href={ACADEMY_INFO.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 font-bold text-xs rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer font-display"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>Falar pelo WhatsApp</span>
          </a>

          <a
            id="btn-student-contact-instagram"
            href={ACADEMY_INFO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 px-5 py-3.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer font-display"
          >
            <Instagram className="w-4 h-4 text-amber-400" />
            <span>Abrir Instagram</span>
          </a>
        </div>
      </div>
    </div>
  );
}
