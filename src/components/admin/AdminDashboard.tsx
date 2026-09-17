import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, AdminDashboardData } from '../../lib/dbService';
import { formatCurrency, formatDateTime, getWhatsAppLink } from '../../lib/utils';
import {
  Users,
  AlertTriangle,
  Clock,
  DollarSign,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  RefreshCw,
  Calendar,
  History,
  Cake,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

export function AdminDashboard() {
  const { navigate } = useNavigation();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const result = await dbService.getAdminDashboardMetrics();
      setData(result);
    } catch (err) {
      console.error('Erro ao carregar métricas do dashboard admin:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Painel Geral
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100">
            Visão Geral da Academia
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gestão financeira em tempo real • Capoeira Nossa Nação
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-refresh-admin-dashboard"
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            className="flex items-center gap-2 px-3 py-2 bg-[#16181b] hover:bg-[#202328] border border-[#2b2e35] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            id="btn-quick-birthdays"
            onClick={() => navigate('/admin/aniversariantes')}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#1b1e24] hover:bg-[#242830] border border-[#2e323b] text-neutral-200 hover:text-white text-xs font-bold rounded-xl transition"
          >
            <Cake className="w-3.5 h-3.5 text-amber-400" />
            <span>Aniversariantes</span>
          </button>

          <button
            id="btn-quick-manage-students"
            onClick={() => navigate('/admin/alunos')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow-md transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Ver Alunos</span>
          </button>
        </div>
      </div>

      {/* Destaque: Aniversariantes de Hoje (se houver) */}
      {data?.todayBirthdays && data.todayBirthdays.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#151917] to-[#141619] border-2 border-emerald-500/60 shadow-xl shadow-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-neutral-950 flex items-center justify-center flex-shrink-0 font-bold shadow-lg shadow-emerald-500/20">
              <Cake className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950">
                  Hoje é Aniversário!
                </span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Parabéns!
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-neutral-100">
                {data.todayBirthdays.map((b, idx) => (
                  <span key={b.id}>
                    {idx > 0 && ', '}
                    {b.full_name}
                    {b.nickname ? ` (${b.nickname})` : ''}
                    {b.turningAge !== null ? ` • Completa ${b.turningAge} anos` : ''}
                  </span>
                ))}
              </h3>
              <p className="text-xs text-neutral-400">
                Deseje parabéns em nome da família Capoeira Nossa Nação!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {data.todayBirthdays[0]?.contactPhone && (
              <button
                id="btn-today-birthday-whatsapp"
                onClick={() => {
                  const b = data.todayBirthdays![0];
                  const name = b.nickname || b.full_name;
                  const link = getWhatsAppLink(
                    b.contactPhone!,
                    `Olá! A Capoeira Nossa Nação deseja um feliz aniversário ao ${name}! 🥳`
                  );
                  window.open(link, '_blank', 'noopener,noreferrer');
                }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {data.todayBirthdays[0].isGuardianContact
                    ? 'Falar com Responsável'
                    : 'Enviar Mensagem'}
                </span>
              </button>
            )}
            <button
              id="btn-today-birthday-view"
              onClick={() => navigate('/admin/aniversariantes')}
              className="px-4 py-2.5 bg-[#1e2229] hover:bg-[#282d36] text-neutral-200 hover:text-white border border-[#2d323c] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>Ver Aniversariantes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Grid (All Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* 1. Total de Alunos */}
        <div
          id="kpi-total-students"
          onClick={() => navigate('/admin/alunos?filter=all')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-amber-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Total de Alunos
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-neutral-100 font-mono">
              {loading ? '-' : data?.totalStudents ?? 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Alunos ativos cadastrados</p>
          </div>
        </div>

        {/* 2. Alunos com Pendências */}
        <div
          id="kpi-students-pending"
          onClick={() => navigate('/admin/alunos?filter=pending')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-amber-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Alunos com Pendências
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:scale-105 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-400 font-mono">
              {loading ? '-' : data?.studentsWithPending ?? 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Possuem mensalidade ou débito aberto</p>
          </div>
        </div>

        {/* 3. Mensalidades Vencidas */}
        <div
          id="kpi-overdue-fees"
          onClick={() => navigate('/admin/mensalidades?filter=overdue')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-rose-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Mensalidades Vencidas
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 group-hover:scale-105 transition">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-rose-400 font-mono">
              {loading ? '-' : data?.overdueFeesCount ?? 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Data de vencimento ultrapassada</p>
          </div>
        </div>

        {/* 4. Total a Receber */}
        <div
          id="kpi-total-to-receive"
          onClick={() => navigate('/admin/mensalidades?filter=pending')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-amber-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Total a Receber
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {loading ? '-' : formatCurrency(data?.totalToReceive ?? 0)}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Mensalidades + Produtos em aberto</p>
          </div>
        </div>

        {/* 5. Produtos em Débito */}
        <div
          id="kpi-open-product-debts"
          onClick={() => navigate('/admin/produtos?tab=debts')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-sky-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Produtos em Débito
            </span>
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 group-hover:scale-105 transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-neutral-100 font-mono">
              {loading ? '-' : data?.openProductDebtsCount ?? 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Itens entregues pendentes de quitação</p>
          </div>
        </div>

        {/* 6. Pagamentos do Mês */}
        <div
          id="kpi-month-payments"
          onClick={() => navigate('/admin/pagamentos')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-emerald-500/40 transition cursor-pointer group space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Pagamentos do Mês
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {loading ? '-' : formatCurrency(data?.monthPaymentsTotal ?? 0)}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Total recebido no mês corrente</p>
          </div>
        </div>

        {/* 7. Aniversariantes do Mês (Card Oficial) */}
        <div
          id="kpi-birthdays"
          onClick={() => navigate('/admin/aniversariantes')}
          className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-amber-500/40 transition cursor-pointer group space-y-3 shadow-md sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              Aniversariantes do Mês
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:scale-105 transition">
              <Cake className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-neutral-100 font-mono flex items-baseline gap-2">
              <span>{loading ? '-' : data?.monthBirthdaysCount ?? 0}</span>
              <span className="text-xs font-normal text-neutral-400">neste mês</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 truncate">
              {data?.nextBirthday ? (
                <span>
                  Próximo:{' '}
                  <strong className="text-amber-400 font-bold">
                    {data.nextBirthday.nickname || data.nextBirthday.full_name}
                  </strong>{' '}
                  ({data.nextBirthday.day < 10 ? `0${data.nextBirthday.day}` : data.nextBirthday.day}/
                  {data.nextBirthday.month < 10 ? `0${data.nextBirthday.month}` : data.nextBirthday.month})
                </span>
              ) : (
                'Ver lista de aniversariantes'
              )}
            </p>
          </div>
          <div className="pt-2 border-t border-[#22242a] flex items-center justify-between text-[11px] text-amber-400 font-semibold group-hover:text-amber-300">
            <span>Ver aniversariantes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>

      {/* Latest Movements Timeline (Dados Reais) */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-neutral-100">Últimas Movimentações</h3>
          </div>

          <button
            onClick={() => navigate('/admin/movimentacoes')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#181a1d] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.recentMovements || data.recentMovements.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            Nenhuma movimentação financeira registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-[#22242a]">
            {data.recentMovements.map((m) => (
              <div key={m.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-200">
                      {m.student?.nickname || m.student?.full_name || 'Aluno'}
                    </span>
                    <span className="text-xs text-neutral-400">• {m.description}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {formatDateTime(m.created_at)}
                  </p>
                </div>

                <div className="text-right font-mono font-bold text-sm">
                  <span className={m.type === 'PAYMENT' ? 'text-emerald-400' : 'text-amber-400'}>
                    {m.type === 'PAYMENT' ? '-' : '+'}
                    {formatCurrency(m.movement_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
