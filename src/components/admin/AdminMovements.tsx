import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { FinancialMovement } from '../../types/database';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { History, Search, RefreshCw, Calendar, ShoppingBag, Sliders, ArrowDownLeft } from 'lucide-react';

export function AdminMovements() {
  const [movements, setMovements] = useState<
    (FinancialMovement & { student?: { full_name: string; nickname?: string } })[]
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMovements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('financial_movements')
        .select(`
          *,
          student:profiles!financial_movements_student_id_fkey(full_name, nickname)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const filtered = movements.filter((m) => {
    const studentName = (m.student?.full_name || '').toLowerCase();
    const nickname = (m.student?.nickname || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = studentName.includes(query) || nickname.includes(query) || desc.includes(query);
    if (!matchesSearch) return false;

    if (typeFilter !== 'all' && m.type !== typeFilter) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Trilha de Auditoria
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            Movimentações Financeiras
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Registro imutável de todas as cobranças, baixas e ajustes do sistema
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadMovements();
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#141619] hover:bg-[#1f2227] border border-[#25282f] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por aluno, apelido ou descrição..."
            className="w-full px-4 py-2.5 pl-10 bg-[#141619] border border-[#25282f] rounded-xl text-xs text-neutral-100 focus:border-amber-500 outline-none"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#141619] border border-[#25282f] rounded-xl text-xs text-neutral-100 focus:border-amber-500 outline-none"
        >
          <option value="all">Todos os tipos</option>
          <option value="PAYMENT">Pagamentos</option>
          <option value="MONTHLY_FEE_CREATED">Mensalidades Criadas</option>
          <option value="PRODUCT_DEBT_CREATED">Produtos em Débito</option>
          <option value="ADJUSTMENT">Ajustes</option>
        </select>
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
          title="Nenhuma movimentação encontrada"
          description="Nenhum registro coincide com os filtros atuais."
          icon={History}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-100">{m.student?.full_name}</span>
                  {m.student?.nickname && (
                    <span className="text-xs text-amber-400 font-semibold">
                      ({m.student?.nickname})
                    </span>
                  )}
                  <span className="text-neutral-600">•</span>
                  <span className="text-xs text-neutral-300 font-medium">{m.description}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 font-mono">
                  <span>{formatDateTime(m.created_at)}</span>
                  <span>•</span>
                  <span>Por: {m.created_by_email || 'Sistema'}</span>
                </div>

                {m.notes && <p className="text-[11px] text-neutral-500 italic">Obs: {m.notes}</p>}
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-800">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-[#1b1e23] border border-neutral-700 text-neutral-300">
                  {m.type}
                </span>

                <span
                  className={`text-base font-mono font-black ${
                    m.type === 'PAYMENT' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {m.type === 'PAYMENT' ? '-' : '+'}
                  {formatCurrency(m.movement_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
