import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService } from '../../lib/dbService';
import { supabase } from '../../lib/supabase';
import { MonthlyFee } from '../../types/database';
import { formatCurrency, formatDate, formatReferenceDisplay, isOverdue } from '../../lib/utils';
import { BatchGenerateFeesModal } from './modals/BatchGenerateFeesModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';
import { EmptyState } from '../common/EmptyState';
import { Calendar, Plus, Search, CheckCircle2, Clock, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export function AdminFees() {
  const { navigate, getParam } = useNavigation();
  const [fees, setFees] = useState<(MonthlyFee & { student?: { full_name: string; nickname?: string } })[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>(() => {
    const urlFilter = getParam('filter');
    if (urlFilter === 'overdue' || urlFilter === 'paid' || urlFilter === 'all' || urlFilter === 'pending') {
      return urlFilter;
    }
    return 'pending';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync with URL parameter
  useEffect(() => {
    const urlFilter = getParam('filter');
    if (urlFilter === 'overdue' || urlFilter === 'paid' || urlFilter === 'all' || urlFilter === 'pending') {
      setFilter(urlFilter);
    }
  }, [getParam]);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    monthlyFeeId: string;
    itemTitle: string;
    openBalance: number;
  }>({
    isOpen: false,
    studentId: '',
    studentName: '',
    monthlyFeeId: '',
    itemTitle: '',
    openBalance: 0,
  });

  const loadFees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_fees')
        .select(`
          *,
          student:profiles!monthly_fees_student_id_fkey(full_name, nickname)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFees(data || []);
    } catch (err) {
      console.error('Erro ao carregar mensalidades:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  const filteredFees = fees.filter((fee) => {
    const studentName = (fee.student?.full_name || '').toLowerCase();
    const nickname = (fee.student?.nickname || '').toLowerCase();
    const ref = (fee.reference_month || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = studentName.includes(query) || nickname.includes(query) || ref.includes(query);
    if (!matchesSearch) return false;

    const overdue = isOverdue(fee.due_date, fee.remaining_amount);

    if (filter === 'pending') return fee.status !== 'paid' && !overdue;
    if (filter === 'overdue') return overdue;
    if (filter === 'paid') return fee.status === 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Cobranças Recorrentes
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            Gestão de Mensalidades
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Geração em lote, acompanhamento de vencimentos e baixa de pagamentos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadFees();
            }}
            className="p-2 text-neutral-400 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl transition"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            id="btn-open-batch-generate-fees"
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition"
          >
            <Zap className="w-4 h-4" />
            <span>Gerar Mensalidades do Mês</span>
          </button>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            id="input-search-fee"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por aluno, apelido ou mês de referência..."
            className="w-full px-4 py-2.5 pl-10 bg-[#141619] border border-[#25282f] rounded-xl text-xs text-neutral-100 focus:border-amber-500 outline-none"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter Tabs */}
        <div className="flex p-1 bg-[#141619] border border-[#25282f] rounded-xl text-xs">
          <button
            id="tab-fees-all"
            onClick={() => {
              setFilter('all');
              navigate('/admin/mensalidades?filter=all');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === 'all' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            id="tab-fees-pending"
            onClick={() => {
              setFilter('pending');
              navigate('/admin/mensalidades?filter=pending');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === 'pending' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            A Vencer
          </button>
          <button
            id="tab-fees-overdue"
            onClick={() => {
              setFilter('overdue');
              navigate('/admin/mensalidades?filter=overdue');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === 'overdue' ? 'bg-rose-500 text-white font-bold' : 'text-neutral-400 hover:text-rose-400'
            }`}
          >
            Vencidas
          </button>
          <button
            id="tab-fees-paid"
            onClick={() => {
              setFilter('paid');
              navigate('/admin/mensalidades?filter=paid');
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === 'paid' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Pagas
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#141619] border border-[#25282f] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredFees.length === 0 ? (
        <EmptyState
          title="Nenhuma mensalidade encontrada"
          description={
            filter === 'overdue'
              ? 'Nenhuma mensalidade vencida no momento. Tudo em ordem!'
              : filter === 'pending'
              ? 'Nenhuma mensalidade a vencer no momento.'
              : 'Nenhuma mensalidade coincide com os filtros aplicados.'
          }
          icon={Calendar}
        />
      ) : (
        <div className="space-y-3">
          {filteredFees.map((fee) => {
            const overdue = isOverdue(fee.due_date, fee.remaining_amount);
            const studentName = fee.student?.nickname || fee.student?.full_name || 'Aluno';

            return (
              <div
                key={fee.id}
                className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-100">{fee.student?.full_name}</span>
                    {fee.student?.nickname && (
                      <span className="text-xs text-amber-400 font-semibold">
                        ({fee.student?.nickname})
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">•</span>
                    <span className="text-xs font-mono font-bold uppercase text-neutral-300">
                      {formatReferenceDisplay(fee.reference_month)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                    <span>Total: {formatCurrency(fee.amount)}</span>
                    <span className="text-emerald-400">Pago: {formatCurrency(fee.amount_paid)}</span>
                    <span className="text-amber-400 font-bold">
                      Saldo: {formatCurrency(fee.remaining_amount)}
                    </span>
                    <span className="text-neutral-500">Venc: {formatDate(fee.due_date)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div>
                    {fee.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3" />
                        Paga
                      </span>
                    ) : overdue ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-500/40">
                        <AlertCircle className="w-3 h-3" />
                        Vencida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-500/40">
                        <Clock className="w-3 h-3" />
                        Pendente
                      </span>
                    )}
                  </div>

                  {fee.remaining_amount > 0 && (
                    <button
                      onClick={() =>
                        setPaymentModalData({
                          isOpen: true,
                          studentId: fee.student_id,
                          studentName,
                          monthlyFeeId: fee.id,
                          itemTitle: `Mensalidade de ${fee.reference_month}`,
                          openBalance: Number(fee.remaining_amount),
                        })
                      }
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Dar Baixa</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Generator Modal */}
      <BatchGenerateFeesModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onSuccess={loadFees}
      />

      {/* Payoff Modal */}
      <RecordPaymentModal
        isOpen={paymentModalData.isOpen}
        onClose={() => setPaymentModalData((prev) => ({ ...prev, isOpen: false }))}
        studentId={paymentModalData.studentId}
        studentName={paymentModalData.studentName}
        paymentType="monthly_fee"
        itemTitle={paymentModalData.itemTitle}
        monthlyFeeId={paymentModalData.monthlyFeeId}
        openBalance={paymentModalData.openBalance}
        onSuccess={loadFees}
      />
    </div>
  );
}
