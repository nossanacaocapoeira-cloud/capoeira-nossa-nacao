import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService } from '../../lib/dbService';
import { ProductDebt } from '../../types/database';
import { formatCurrency, formatDate } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { ShoppingBag, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { BackToHomeButton } from './BackToHomeButton';

export function StudentProducts() {
  const { user } = useAuth();
  const { previewStudent } = useNavigation();
  const [activeTab, setActiveTab] = useState<'open' | 'paid'>('open');
  const [openDebts, setOpenDebts] = useState<ProductDebt[]>([]);
  const [paidDebts, setPaidDebts] = useState<ProductDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const targetStudentId = previewStudent?.id || user?.id;

  const loadDebts = useCallback(async () => {
    if (!targetStudentId) return;
    try {
      const data = await dbService.getStudentProductDebts(targetStudentId);
      setOpenDebts(data.open);
      setPaidDebts(data.paid);
    } catch (err) {
      console.error('Erro ao carregar produtos em débito:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetStudentId]);

  useEffect(() => {
    loadDebts();
    const onFinancialUpdated = () => loadDebts();
    const onFocus = () => loadDebts();
    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadDebts]);

  return (
    <div className="space-y-6">
      {/* Voltar ao início */}
      <BackToHomeButton id="btn-back-home-products" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100 font-display">
            Produtos & Materiais
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            Acompanhe produtos adquiridos na academia e saldos em aberto
          </p>
        </div>

        <button
          id="btn-refresh-student-products"
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadDebts();
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
          id="tab-open-products"
          type="button"
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer font-display ${
            activeTab === 'open'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-950/30 font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Em Aberto ({openDebts.length})
        </button>

        <button
          id="tab-paid-products"
          type="button"
          onClick={() => setActiveTab('paid')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer font-display ${
            activeTab === 'paid'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 shadow-md shadow-amber-950/30 font-black'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Quitados ({paidDebts.length})
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
        openDebts.length === 0 ? (
          <EmptyState
            title="Nenhum produto em débito."
            description="Você não possui débitos de produtos ou materiais no momento."
            icon={CheckCircle2}
          />
        ) : (
          <div className="space-y-3">
            {openDebts.map((debt) => (
              <div
                key={debt.id}
                id={`product-debt-item-${debt.id}`}
                className="p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/30 transition-all space-y-3.5 shadow-lg backdrop-blur-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                      Material / Uniforme
                    </span>
                    <h3 className="text-base font-bold text-neutral-100 font-display">
                      {debt.product_name_snapshot}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {debt.quantity} {debt.quantity > 1 ? 'unidades' : 'unidade'} • Preço unitário:{' '}
                      {formatCurrency(debt.unit_price)}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-950/30">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {debt.amount_paid > 0 ? 'Parcial' : 'Em Aberto'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-center">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Valor Total</span>
                    <span className="text-xs font-semibold text-neutral-200">
                      {formatCurrency(debt.total_amount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Pago</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {formatCurrency(debt.amount_paid)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Saldo Restante</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {formatCurrency(debt.remaining_amount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 text-neutral-400">
                  <span className="text-[11px]">Adicionado em: <strong className="text-neutral-300 font-mono">{formatDate(debt.created_at)}</strong></span>
                  {debt.notes && <span className="text-[11px] text-neutral-400 italic">{debt.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : paidDebts.length === 0 ? (
        <EmptyState
          title="Nenhum produto quitado ainda."
          description="Produtos que foram totalmente pagos pelo aluno aparecerão nesta lista."
          icon={ShoppingBag}
        />
      ) : (
        <div className="space-y-3">
          {paidDebts.map((debt) => (
            <div
              key={debt.id}
              id={`paid-product-item-${debt.id}`}
              className="p-5 rounded-2xl bg-[#111317]/85 border border-white/[0.06] hover:border-emerald-500/30 transition-all space-y-3 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                    Quitado
                  </span>
                  <h3 className="text-base font-bold text-neutral-100 font-display">
                    {debt.product_name_snapshot}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {debt.quantity} {debt.quantity > 1 ? 'unidades' : 'unidade'}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-950/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Quitado
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 block font-mono">Valor Quitado</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">
                    {formatCurrency(debt.total_amount)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 block font-mono">Quitado em</span>
                  <span className="font-medium text-neutral-300 font-mono">
                    {formatDate(debt.paid_at || debt.updated_at || debt.created_at)}
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
