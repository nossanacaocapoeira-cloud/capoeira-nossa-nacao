import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { dbService, getDeletedRecordsRegistry, isPaymentRecordActive } from '../../lib/dbService';
import { Payment } from '../../types/database';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { CreditCard, Search, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export function AdminPayments() {
  const { success, error: toastError } = useToast();
  const [payments, setPayments] = useState<(Payment & { student?: { full_name: string; nickname?: string } })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de confirmação para excluir pagamento
  const [paymentToDelete, setPaymentToDelete] = useState<(Payment & { student?: { full_name: string; nickname?: string } }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const [payRes, profRes, feesRes, debtsRes, deletedReg] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .order('paid_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*'),
        supabase
          .from('monthly_fees')
          .select('id, status'),
        supabase
          .from('product_debts')
          .select('id, status'),
        getDeletedRecordsRegistry(),
      ]);

      if (payRes.error) throw payRes.error;

      const profileMap = new Map<string, { full_name: string; nickname?: string }>();
      for (const p of profRes.data || []) {
        profileMap.set(p.id, { full_name: p.full_name, nickname: p.nickname });
      }

      const activeFeeIds = new Set<string>(
        (feesRes.data || [])
          .filter((f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id))
          .map((f: any) => f.id)
      );
      const activeDebtIds = new Set<string>(
        (debtsRes.data || [])
          .filter((d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id))
          .map((d: any) => d.id)
      );

      const validPayments = (payRes.data || [])
        .filter((p: any) => isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds))
        .map((p: any) => ({
          ...p,
          student: p.student || profileMap.get(p.student_id) || undefined,
        }));

      setPayments(validPayments);
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
    const onFinancialUpdated = () => loadPayments();
    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    return () => window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
  }, [loadPayments]);

  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return;
    const targetId = paymentToDelete.id;
    setDeleting(true);
    try {
      const res = await dbService.deletePayment(targetId);
      setPayments((prev) => prev.filter((p) => p.id !== targetId));
      setPaymentToDelete(null);
      success(res.message || 'Pagamento excluído com sucesso!');
      await loadPayments();
    } catch (err: any) {
      console.error('Erro ao excluir pagamento:', err);
      toastError(err?.message || 'Não foi possível excluir o pagamento.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = payments.filter((p) => {
    const studentName = (p.student?.full_name || '').toLowerCase();
    const nickname = (p.student?.nickname || '').toLowerCase();
    const method = (p.payment_method || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    return studentName.includes(query) || nickname.includes(query) || method.includes(query) || notes.includes(query);
  });

  const totalFiltered = filtered.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Registro de Recebimentos
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            Histórico de Pagamentos
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Todos os valores recebidos e baixados na administração
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadPayments();
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141619] hover:bg-[#1f2227] border border-[#25282f] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition w-fit cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por aluno, apelido ou forma de pagamento..."
            className="w-full px-4 py-2.5 pl-10 bg-[#141619] border border-[#25282f] rounded-xl text-xs text-neutral-100 focus:border-amber-500 outline-none"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="text-xs font-mono text-neutral-400 flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span>Total Selecionado:</span>
          <span className="text-base font-black text-emerald-400">{formatCurrency(totalFiltered)}</span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#141619] border border-[#25282f] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum pagamento registrado"
          description="Quando você der baixa em mensalidades ou produtos, o histórico detalhado aparecerá aqui."
          icon={CreditCard}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-neutral-100">
                    {p.student?.full_name || 'Aluno'}
                  </span>
                  {p.student?.nickname && (
                    <span className="text-xs text-amber-400 font-semibold">
                      ({p.student?.nickname})
                    </span>
                  )}
                  <span className="text-neutral-600">•</span>
                  <span className="text-xs text-neutral-400">
                    {p.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 font-mono">
                  <span>{formatDateTime(p.paid_at || p.created_at)}</span>
                  <span>•</span>
                  <span>Registrado por: {(p as any).recorded_by_email || p.registered_by_email || 'Administrador'}</span>
                </div>

                {p.notes && <p className="text-[11px] text-neutral-500 italic">Obs: {p.notes}</p>}
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-[#1b1e23] border border-neutral-700 text-neutral-300">
                    {(p.payment_method || 'DINHEIRO').toUpperCase()}
                  </span>

                  <span className="text-base font-mono font-black text-emerald-400">
                    + {formatCurrency(p.amount)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPaymentToDelete(p)}
                  title="Excluir este pagamento"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141619] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Excluir Pagamento</h3>
                <p className="text-xs text-neutral-400">Remover lançamento incorreto</p>
              </div>
            </div>

            <div className="bg-[#181a1f] border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Aluno:</span>
                <strong className="text-white">
                  {paymentToDelete.student?.full_name || 'Aluno'}
                  {paymentToDelete.student?.nickname ? ` (${paymentToDelete.student.nickname})` : ''}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Tipo:</span>
                <strong className="text-neutral-200">
                  {paymentToDelete.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Valor:</span>
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(paymentToDelete.amount)}
                </strong>
              </div>
              <p className="text-[11px] text-amber-300/90 pt-2 border-t border-neutral-800">
                Ao confirmar, este pagamento será excluído e a mensalidade/produto vinculado e o Dashboard serão atualizados automaticamente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
