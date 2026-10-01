import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService } from '../../lib/dbService';
import { MonthlyFee } from '../../types/database';
import { formatCurrency, formatDate, isOverdue, formatReferenceDisplay } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { Calendar, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { BackToHomeButton } from './BackToHomeButton';

export function StudentFees() {
  const { user } = useAuth();
  const { previewStudent } = useNavigation();
  const [activeTab, setActiveTab] = useState<'open' | 'paid'>('open');
  const [openFees, setOpenFees] = useState<MonthlyFee[]>([]);
  const [paidFees, setPaidFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const targetStudentId = previewStudent?.id || user?.id;

  const loadFees = useCallback(async () => {
    if (!targetStudentId) return;
    try {
      const data = await dbService.getStudentMonthlyFees(targetStudentId);
      setOpenFees(data.open);
      setPaidFees(data.paid);
    } catch (err) {
      console.error('Erro ao carregar mensalidades:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetStudentId]);

  useEffect(() => {
    loadFees();

    const onFinancialUpdated = () => {
      loadFees();
    };
    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    const onFocus = () => loadFees();
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadFees]);

  return (
    <div className="space-y-6">
      {/* Voltar ao início */}
      <BackToHomeButton id="btn-back-home-fees" />

      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100 font-display">
            Minhas Mensalidades
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            Consulte seus vencimentos e pagamentos registrados na Capoeira Nossa Nação
          </p>
        </div>

        <button
          id="btn-refresh-student-fees"
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadFees();
          }}
          className="p-2.5 text-neutral-400 hover:text-amber-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-500/30 rounded-2xl transition cursor-pointer backdrop-blur-sm shadow-sm active:scale-95"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[#111317]/90 border border-white/[0.08] rounded-2xl backdrop-blur-md">
        <button
          id="tab-open-fees"
          type="button"
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer font-display ${
            activeTab === 'open'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-950/30 font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Em Aberto ({openFees.length})
        </button>

        <button
          id="tab-paid-fees"
          type="button"
          onClick={() => setActiveTab('paid')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer font-display ${
            activeTab === 'paid'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-950/30 font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Pagas ({paidFees.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-[#111317]/80 border border-white/[0.06] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'open' ? (
        openFees.length === 0 ? (
          <EmptyState
            title="Nenhuma mensalidade em aberto!"
            description="Parabéns! Suas mensalidades com a Capoeira Nossa Nação estão rigorosamente em dia."
            icon={CheckCircle2}
          />
        ) : (
          <div className="space-y-3">
            {openFees.map((fee) => {
              const overdue = isOverdue(fee.due_date, fee.remaining_amount);
              const isPartial = fee.status === 'partial' || fee.amount_paid > 0;

              return (
                <div
                  key={fee.id}
                  id={`fee-item-${fee.id}`}
                  className="p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/30 transition-all space-y-3.5 shadow-lg backdrop-blur-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                        Referência
                      </span>
                      <h3 className="text-base font-bold text-neutral-100 uppercase font-display">
                        {formatReferenceDisplay(fee.reference_month)}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">{fee.description}</p>
                    </div>

                    <div>
                      {overdue ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-sm shadow-rose-950/30">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          Vencida
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-950/30">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-300">
                          <Clock className="w-3.5 h-3.5 text-neutral-400" />
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-center">
                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block font-mono">Valor Total</span>
                      <span className="text-xs font-semibold text-neutral-200">
                        {formatCurrency(fee.amount)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block font-mono">Já Pago</span>
                      <span className="text-xs font-semibold text-emerald-400">
                        {formatCurrency(fee.amount_paid)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 uppercase block font-mono">Saldo Devedor</span>
                      <span
                        className={`text-xs font-bold font-mono ${
                          overdue ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {formatCurrency(fee.remaining_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 text-neutral-400">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      Vencimento:{' '}
                      <strong className={overdue ? 'text-rose-400 font-bold' : 'text-neutral-200'}>
                        {formatDate(fee.due_date)}
                      </strong>
                    </span>
                    {fee.notes && <span className="text-[11px] text-neutral-400 italic">{fee.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : paidFees.length === 0 ? (
        <EmptyState
          title="Nenhuma mensalidade paga ainda."
          description="Quando um pagamento for registrado pelo Administrador, ele aparecerá aqui com comprovante."
          icon={Calendar}
        />
      ) : (
        <div className="space-y-3">
          {paidFees.map((fee) => (
            <div
              key={fee.id}
              id={`paid-fee-item-${fee.id}`}
              className="p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-emerald-500/30 transition-all space-y-3 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                    Referência
                  </span>
                  <h3 className="text-base font-bold text-neutral-100 uppercase font-display">
                    {formatReferenceDisplay(fee.reference_month)}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">{fee.description}</p>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-950/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Pago
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-mono">Valor Quitado</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">
                    {formatCurrency(fee.amount)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 block font-mono">Pago em</span>
                  <span className="font-medium text-neutral-300 font-mono">
                    {formatDate(fee.paid_at || fee.updated_at || fee.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
