import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types/database';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { CreditCard, Search, RefreshCw, Calendar, ShoppingBag } from 'lucide-react';

export function AdminPayments() {
  const [payments, setPayments] = useState<(Payment & { student?: { full_name: string; nickname?: string } })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          student:profiles!payments_student_id_fkey(full_name, nickname)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = payments.filter((p) => {
    const studentName = (p.student?.full_name || '').toLowerCase();
    const nickname = (p.student?.nickname || '').toLowerCase();
    const method = (p.payment_method || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    return studentName.includes(query) || nickname.includes(query) || method.includes(query);
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
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141619] hover:bg-[#1f2227] border border-[#25282f] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition w-fit"
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-100">{p.student?.full_name}</span>
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
                  <span>{formatDateTime(p.created_at)}</span>
                  <span>•</span>
                  <span>Registrado por: {p.registered_by_email || 'Administrador'}</span>
                </div>

                {p.notes && <p className="text-[11px] text-neutral-500 italic">Obs: {p.notes}</p>}
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-800">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-[#1b1e23] border border-neutral-700 text-neutral-300">
                  {p.payment_method.toUpperCase()}
                </span>

                <span className="text-base font-mono font-black text-emerald-400">
                  + {formatCurrency(p.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
