import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, StudentPaymentItem } from '../../lib/dbService';
import { formatCurrency } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import {
  History,
  CheckCircle2,
  RefreshCw,
  CreditCard,
  AlertOctagon,
  Calendar,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { BackToHomeButton } from './BackToHomeButton';

function formatPaymentDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const datePart = d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} às ${timePart}`;
  } catch {
    return dateString;
  }
}

export function StudentHistory() {
  const { user } = useAuth();
  const { previewStudent } = useNavigation();
  const [payments, setPayments] = useState<StudentPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const targetStudentId = previewStudent?.id || user?.id;

  const loadHistory = useCallback(async () => {
    if (!targetStudentId) return;
    try {
      const data = await dbService.getStudentPaymentHistory(targetStudentId);
      setPayments(data);
    } catch (err) {
      console.error('Erro ao carregar histórico de pagamentos do aluno:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetStudentId]);

  useEffect(() => {
    loadHistory();
    const onFinancialUpdated = () => loadHistory();
    const onFocus = () => loadHistory();
    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadHistory]);

  // Cálculos de totais de pagamentos válidos (excluindo revertidos)
  const activePayments = payments.filter((p) => p.status !== 'reversed');
  const totalPaid = activePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const reversedCount = payments.filter((p) => p.status === 'reversed').length;

  return (
    <div className="space-y-6">
      {/* Voltar ao início */}
      <BackToHomeButton id="btn-back-home-history" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100 font-display">
            Histórico Financeiro
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            Consulte todos os pagamentos registrados para a sua conta
          </p>
        </div>

        <button
          id="btn-refresh-student-history"
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadHistory();
          }}
          className="p-2.5 text-neutral-400 hover:text-amber-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-2xl transition cursor-pointer backdrop-blur-sm shadow-sm active:scale-95"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Summary Stats Card */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] backdrop-blur-md shadow-lg flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                Total Pago Confirmado
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-emerald-400">
                {formatCurrency(totalPaid)}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] backdrop-blur-md shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                  Comprovantes Válidos
                </span>
                <p className="text-lg sm:text-xl font-black text-neutral-100 font-display">
                  {activePayments.length} {activePayments.length === 1 ? 'pagamento' : 'pagamentos'}
                </p>
              </div>
            </div>

            {reversedCount > 0 && (
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-500/30 text-rose-300 font-bold">
                {reversedCount} revertido
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline de Pagamentos */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#111317]/80 border border-white/[0.06] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          title="Nenhum pagamento registrado ainda"
          description="Quando um pagamento for registrado, ele aparecerá aqui."
          icon={History}
        />
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-amber-500/50 before:via-neutral-800 before:to-transparent">
          {payments.map((item) => {
            const isReversed = item.status === 'reversed';

            return (
              <div
                key={item.id}
                id={`payment-item-${item.id}`}
                className={`relative p-4 sm:p-5 rounded-2xl bg-[#111317]/85 border transition-all space-y-3 shadow-lg backdrop-blur-md ${
                  isReversed
                    ? 'border-rose-900/40 opacity-75'
                    : 'border-white/[0.06] hover:border-amber-500/30'
                }`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-6 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0d0e12] border-2 flex items-center justify-center shadow-sm ${
                    isReversed
                      ? 'border-rose-500/70 shadow-rose-950/40'
                      : 'border-amber-400 shadow-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isReversed ? 'bg-rose-400' : 'bg-amber-400'
                    }`}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                        isReversed
                          ? 'bg-rose-950/40 border-rose-500/30 text-rose-400'
                          : item.payment_type === 'product'
                          ? 'bg-sky-950/40 border-sky-500/30 text-sky-400'
                          : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {isReversed ? (
                        <AlertOctagon className="w-4 h-4" />
                      ) : item.payment_type === 'product' ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isReversed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-500/40">
                            PAGAMENTO REVERTIDO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Pagamento registrado
                          </span>
                        )}

                        {item.payment_method && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-white/[0.04] text-neutral-300 border border-white/[0.08] flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-amber-400" />
                            {item.payment_method}
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-sm sm:text-base font-bold font-display ${
                          isReversed ? 'text-neutral-400 line-through' : 'text-neutral-100'
                        }`}
                      >
                        {item.title}
                      </h4>

                      <p className="text-[11px] text-neutral-400 font-mono">
                        {formatPaymentDateTime(item.paid_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.04]">
                    <span
                      className={`text-base sm:text-lg font-black font-mono ${
                        isReversed
                          ? 'text-neutral-500 line-through'
                          : 'text-emerald-400'
                      }`}
                    >
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>

                {/* Notas / Observações */}
                {item.notes && (
                  <p className="text-xs text-neutral-400 italic bg-black/40 p-2.5 rounded-xl border border-white/[0.06]">
                    Obs: {item.notes}
                  </p>
                )}

                {/* Motivo da Reversão */}
                {isReversed && item.reversal_reason && (
                  <p className="text-xs text-rose-300 bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/20">
                    Motivo da reversão: {item.reversal_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
