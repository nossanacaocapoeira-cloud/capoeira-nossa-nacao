import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  dbService,
  AnnualGridStudentRow,
  GridMonthCell,
  GridFeeChange,
  GridFeeStatus,
  StudentWithBalance,
} from '../../lib/dbService';
import { getSaoPauloDate, formatCurrency, normalizeSearch } from '../../lib/utils';
import { StudentActionsModal } from './modals/StudentActionsModal';
import { BatchGenerateFeesModal } from './modals/BatchGenerateFeesModal';
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  SlidersHorizontal,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';

export function AdminFees() {
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  // Ano atual em São Paulo como padrão
  const currentSpDate = useMemo(() => getSaoPauloDate(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentSpDate.year);

  // Dados da grade anual
  const [gridRows, setGridRows] = useState<AnnualGridStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Busca de alunos (não perde alterações)
  const [searchTerm, setSearchTerm] = useState('');

  // Mapa de alterações pendentes locais (chave: studentId_referenceMonth)
  const [pendingChanges, setPendingChanges] = useState<Map<string, GridFeeChange>>(new Map());

  // Modal de Ações do Aluno
  const [selectedStudentForActions, setSelectedStudentForActions] = useState<StudentWithBalance | null>(null);

  // Modal de Confirmação de Lançamento em Lote
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  // Modal de Geração de Mensalidades do Mês
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Modal de Aviso ao tentar trocar de ano com alterações pendentes
  const [pendingYearSwitch, setPendingYearSwitch] = useState<number | null>(null);

  // Modal de Reset Limpo dos Lançamentos Financeiros de Teste
  const [showResetModal, setShowResetModal] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  const handleExecuteReset = async () => {
    setResettingData(true);
    try {
      const res = await dbService.resetFinancialTransactions();
      success(res.message || 'Lançamentos financeiros resetados com sucesso!');
      setPendingChanges(new Map());
      setShowResetModal(false);
      await loadGridData(selectedYear);
    } catch (err: any) {
      console.error('Erro ao executar reset financeiro:', err);
      toastError(`Falha ao resetar lançamentos: ${err?.message || 'Tente novamente'}`);
    } finally {
      setResettingData(false);
    }
  };

  // Carrega os dados da grade anual
  const loadGridData = useCallback(async (year: number) => {
    try {
      setLoading(true);
      const rows = await dbService.getAnnualFeesGrid(year);
      setGridRows(rows);
    } catch (err: any) {
      console.error('Erro ao carregar grade anual de mensalidades:', err);
      toastError('Não foi possível carregar a grade anual de mensalidades.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadGridData(selectedYear);
  }, [selectedYear, loadGridData]);

  // Proteção contra saída acidental da página se houver alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = 'Existem alterações de mensalidade ainda não lançadas.';
        return 'Existem alterações de mensalidade ainda não lançadas.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingChanges.size]);

  // Filtragem de alunos (busca por nome, apelido, responsável, WhatsApp)
  // Preserva integralmente as alterações locais pendentes
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return gridRows;

    const term = normalizeSearch(searchTerm);
    return gridRows.filter((row) => {
      const s = row.student;
      const fullName = normalizeSearch(s.full_name);
      const nickname = normalizeSearch(s.nickname);
      const guardian = normalizeSearch(s.guardian_name);
      const whatsapp = normalizeSearch(s.whatsapp);
      const cleanPhone = normalizeSearch(s.whatsapp_normalized);
      return (
        fullName.includes(term) ||
        nickname.includes(term) ||
        guardian.includes(term) ||
        whatsapp.includes(term) ||
        cleanPhone.includes(term)
      );
    });
  }, [gridRows, searchTerm]);

  // Alterna o status da célula ao clicar
  const handleCellClick = (student: StudentWithBalance, cell: GridMonthCell) => {
    // 1. PRÉ é estritamente bloqueado (não editável, não altera status)
    if (cell.isPre || cell.status === 'PRE' || cell.status === 'PRÉ') {
      return;
    }

    // 2. Bolsistas não geram cobrança de mensalidade
    if (cell.isScholarship) {
      toastError(`O aluno ${student.nickname || student.full_name} é bolsista (sem mensalidade).`);
      return;
    }

    // 3. Pagamento Parcial existente não deve ser destruído por clique simples
    if (cell.status === 'PARCIAL') {
      toastError('Esta mensalidade possui pagamento parcial. Use "Ações" ou o perfil do aluno para gerenciar.');
      return;
    }

    const key = `${student.id}_${cell.referenceMonth}`;
    const existingChange = pendingChanges.get(key);

    // Determina o status visual atual da célula (considerando qualquer alteração pendente)
    let currentVisualStatus: GridFeeStatus = cell.status;
    if (existingChange) {
      currentVisualStatus = existingChange.targetStatus;
    }

    let nextTargetStatus: 'PAGO' | 'NÃO PAGO' | 'SEM MENSALIDADE';

    // Ciclo inteligente:
    // - Se no banco era SEM MENSALIDADE: SEM MENSALIDADE -> PAGO -> NÃO PAGO -> SEM MENSALIDADE
    // - Se no banco era PAGO: PAGO -> SEM MENSALIDADE -> NÃO PAGO -> PAGO
    // - Se no banco era NÃO PAGO / ATRASO: NÃO PAGO -> PAGO -> SEM MENSALIDADE -> NÃO PAGO
    if (cell.status === 'SEM MENSALIDADE') {
      if (currentVisualStatus === 'SEM MENSALIDADE') {
        nextTargetStatus = 'PAGO';
      } else if (currentVisualStatus === 'PAGO') {
        nextTargetStatus = 'NÃO PAGO';
      } else {
        nextTargetStatus = 'SEM MENSALIDADE';
      }
    } else if (cell.status === 'PAGO') {
      if (currentVisualStatus === 'PAGO') {
        nextTargetStatus = 'SEM MENSALIDADE';
      } else if (currentVisualStatus === 'SEM MENSALIDADE') {
        nextTargetStatus = 'NÃO PAGO';
      } else {
        nextTargetStatus = 'PAGO';
      }
    } else {
      // cell.status === 'NÃO PAGO' ou 'ATRASO'
      if (currentVisualStatus === 'NÃO PAGO' || currentVisualStatus === 'ATRASO') {
        nextTargetStatus = 'PAGO';
      } else if (currentVisualStatus === 'PAGO') {
        nextTargetStatus = 'SEM MENSALIDADE';
      } else {
        nextTargetStatus = 'NÃO PAGO';
      }
    }

    const isScholarship = Boolean(student.is_scholarship || student.isScholarship);
    const configuredFee = isScholarship ? 0 : (Number(student.monthly_fee_amount) || 0);
    const configuredDueDay = Number(student.due_day) || 10;

    // Se aluno é PAGANTE e possui monthly_fee_amount = 0: não permitir lançar PAGO ou NÃO PAGO sem valor
    if ((nextTargetStatus === 'PAGO' || nextTargetStatus === 'NÃO PAGO') && !isScholarship) {
      if (configuredFee <= 0 && (!cell.amount || cell.amount <= 0)) {
        toastError('Configure o valor mensal deste aluno primeiro.');
        setSelectedStudentForActions(student);
        return;
      }
    }

    // Se o próximo estado for idêntico ao estado original do banco, remove das pendências
    const isBackToOriginal =
      (cell.status === 'PAGO' && nextTargetStatus === 'PAGO') ||
      ((cell.status === 'NÃO PAGO' || cell.status === 'ATRASO') && nextTargetStatus === 'NÃO PAGO') ||
      (cell.status === 'SEM MENSALIDADE' && nextTargetStatus === 'SEM MENSALIDADE');

    setPendingChanges((prev) => {
      const updated = new Map(prev);
      if (isBackToOriginal) {
        updated.delete(key);
      } else {
        updated.set(key, {
          studentId: student.id,
          studentName: student.nickname || student.full_name,
          referenceMonth: cell.referenceMonth,
          monthLabel: cell.monthLabel,
          targetStatus: nextTargetStatus,
          currentStatus: cell.status,
          feeId: cell.feeId,
          feeAmount: isScholarship ? 0 : (configuredFee > 0 ? configuredFee : (Number(cell.amount) || 0)),
          dueDay: configuredDueDay,
        });
      }
      return updated;
    });
  };

  // Descartar alterações locais
  const handleDiscardChanges = () => {
    if (pendingChanges.size === 0) return;
    setPendingChanges(new Map());
    success('Alterações descartadas. Dados restaurados para a versão do banco.');
  };

  // Troca de ano com validação de alterações pendentes
  const handleSelectYear = (newYear: number) => {
    if (newYear === selectedYear) return;

    if (pendingChanges.size > 0) {
      setPendingYearSwitch(newYear);
    } else {
      setSelectedYear(newYear);
    }
  };

  // Confirmar troca de ano descartando pendências
  const handleConfirmYearSwitch = () => {
    if (pendingYearSwitch !== null) {
      setPendingChanges(new Map());
      setSelectedYear(pendingYearSwitch);
      setPendingYearSwitch(null);
    }
  };

  // Executar Lançamento em Lote
  const handleExecuteBatch = async () => {
    if (pendingChanges.size === 0) return;

    setSavingBatch(true);
    const changesArray = Array.from(pendingChanges.values());

    try {
      const result = await dbService.batchApplyGridFees(
        changesArray,
        user?.id,
        user?.email || undefined
      );

      if (result.success) {
        // Atualização imediata do estado visual em memória
        setGridRows((prevRows) =>
          prevRows.map((row) => {
            const updatedMonths = row.months.map((m) => {
              const change = pendingChanges.get(`${row.student.id}_${m.referenceMonth}`);
              if (!change) return m;
              const isTargetPaid = change.targetStatus === 'PAGO';
              const isTargetSemMens = change.targetStatus === 'SEM MENSALIDADE';
              return {
                ...m,
                status: change.targetStatus,
                feeId: isTargetSemMens ? null : m.feeId,
                amount: isTargetSemMens ? 0 : (change.feeAmount || 0),
                amountPaid: isTargetPaid ? (change.feeAmount || 0) : 0,
                remainingAmount: isTargetPaid || isTargetSemMens ? 0 : (change.feeAmount || 0),
                isOverdue: false,
              };
            });
            return { ...row, months: updatedMonths };
          })
        );

        success(result.message || `${changesArray.length} alterações lançadas com sucesso.`);
        setPendingChanges(new Map());
        setShowConfirmModal(false);
        // Sincroniza a grade com a confirmação definitiva do banco de dados
        await loadGridData(selectedYear);
      } else {
        toastError(result.message || 'Não foi possível lançar as alterações.');
      }
    } catch (err: any) {
      console.error('Erro ao lançar alterações de mensalidade:', err);
      toastError(`Não foi possível lançar as alterações: ${err?.message || 'Tente novamente'}`);
    } finally {
      setSavingBatch(false);
    }
  };

  const availableYears = [selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1];
  const uniqueAvailableYears = Array.from(new Set(availableYears)).sort();

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#25282f] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
              Controle Anual
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
              {gridRows.length} Alunos Cadastrados
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100 flex items-center gap-2">
            Mensalidades
          </h2>
        </div>

        {/* Controles de Topo: Ano, Atualizar e Gerar Lote */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1 bg-[#141619] border border-[#25282f] p-1 rounded-xl">
            <span className="text-xs font-mono font-bold text-neutral-400 pl-2 pr-1">ANO:</span>
            {uniqueAvailableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => handleSelectYear(yr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  selectedYear === yr
                    ? 'bg-amber-500 text-neutral-950 shadow'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Botão Atualizar */}
          <button
            onClick={() => {
              setRefreshing(true);
              loadGridData(selectedYear);
            }}
            disabled={refreshing}
            className="p-2 text-neutral-400 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl transition cursor-pointer"
            title="Atualizar dados da grade"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Botão Reset Financeiro */}
          <button
            id="btn-reset-financial-data"
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 hover:border-rose-500/50 rounded-xl transition text-xs font-bold cursor-pointer"
            title="Limpar lançamentos financeiros de teste e reiniciar do zero"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Financeiro</span>
          </button>

          {/* Botão Gerar Mensalidades do Mês */}
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold rounded-xl border border-neutral-700 transition"
            title="Gerar mensalidades recorrentes do mês"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Gerar Mês</span>
          </button>
        </div>
      </div>

      {/* Barra de Ações & Barra de Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sticky top-0 z-30 bg-[#0e1013]/95 backdrop-blur-md p-2.5 rounded-2xl border border-[#25282f] shadow-lg">
        {/* Campo de Busca */}
        <div className="relative flex-1 max-w-md">
          <input
            id="input-search-student-grid"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar aluno por nome, apelido ou responsável..."
            className="w-full px-4 py-2 pl-9 bg-[#141619] border border-[#25282f] rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:border-amber-500 outline-none transition"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Seção de Lançamento / Contador de Alterações */}
        <div className="flex items-center gap-3">
          {pendingChanges.size > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>{pendingChanges.size} alteraç{pendingChanges.size === 1 ? 'ão pendente' : 'ões pendentes'}</span>
              </div>

              <button
                onClick={handleDiscardChanges}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-rose-400 bg-[#141619] border border-[#25282f] hover:border-rose-500/30 transition"
                title="Descartar todas as alterações não salvas"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>
            </>
          )}

          {/* Botão LANÇAR ALTERAÇÕES */}
          <button
            id="btn-launch-grid-changes"
            disabled={pendingChanges.size === 0 || savingBatch}
            onClick={() => setShowConfirmModal(true)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition shadow-lg ${
              pendingChanges.size > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20 cursor-pointer active:scale-95'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700/50 cursor-not-allowed opacity-60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>LANÇAR ALTERAÇÕES</span>
          </button>
        </div>
      </div>

      {/* Grade Anual de Mensalidades */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-[#141619] border border-[#25282f] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-12 text-center bg-[#141619] border border-[#25282f] rounded-2xl">
          <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-200">Nenhum aluno encontrado</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Nenhum aluno corresponde à busca "${searchTerm}".`
              : 'Nenhum aluno cadastrado no sistema.'}
          </p>
        </div>
      ) : (
        <div className="relative border border-[#25282f] rounded-2xl bg-[#141619] shadow-2xl overflow-hidden">
          {/* Tabela ampla e legível sem necessidade de rolagem horizontal */}
          <div className="overflow-x-hidden max-h-[80vh] overflow-y-auto">
            <table className="w-full table-fixed text-left border-collapse">
              {/* Cabeçalho da Tabela */}
              <thead className="bg-[#0c0d0f] sticky top-0 z-20 border-b border-[#25282f]">
                <tr>
                  {/* Coluna Aluno */}
                  <th className="py-3 px-3 text-xs font-mono font-extrabold uppercase tracking-wider text-neutral-200 w-[180px] lg:w-[205px] border-r border-[#25282f]">
                    Aluno
                  </th>

                  {/* Coluna Ações */}
                  <th className="py-3 px-1.5 text-xs font-mono font-extrabold uppercase tracking-wider text-neutral-200 text-center w-[62px] border-r border-[#25282f]">
                    Ações
                  </th>

                  {/* Colunas dos Meses (JAN a DEZ) */}
                  {[
                    { m: 1, label: 'JAN' },
                    { m: 2, label: 'FEV' },
                    { m: 3, label: 'MAR' },
                    { m: 4, label: 'ABR' },
                    { m: 5, label: 'MAI' },
                    { m: 6, label: 'JUN' },
                    { m: 7, label: 'JUL' },
                    { m: 8, label: 'AGO' },
                    { m: 9, label: 'SET' },
                    { m: 10, label: 'OUT' },
                    { m: 11, label: 'NOV' },
                    { m: 12, label: 'DEZ' },
                  ].map(({ m, label }) => {
                    const isCurrent =
                      selectedYear === currentSpDate.year && m === currentSpDate.month;
                    return (
                      <th
                        key={label}
                        className={`py-2.5 px-1 text-center text-xs font-mono font-extrabold tracking-tight transition ${
                          isCurrent
                            ? 'bg-amber-500/15 text-amber-400 border-b-2 border-b-amber-500'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span>{label}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-sans font-bold text-amber-400 -mt-0.5">
                              Atual
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Corpo da Tabela (Alunos em ordem alfabética) */}
              <tbody className="divide-y divide-[#1f2228] text-xs">
                {filteredRows.map((row) => {
                  const s = row.student;
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-neutral-800/40 transition-colors group"
                    >
                      {/* Célula do Aluno */}
                      <td className="bg-[#141619] group-hover:bg-[#1a1d22] py-2 px-3 border-r border-[#25282f] transition-colors">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs sm:text-[13px] leading-snug text-neutral-100 truncate" title={s.full_name}>
                            {s.full_name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            {s.nickname ? (
                              <span className="text-[11px] leading-tight text-amber-400 font-semibold truncate">
                                "{s.nickname}"
                              </span>
                            ) : null}
                            {s.is_scholarship && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                BOLSISTA
                              </span>
                            )}
                            {!s.active && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                                INATIVO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Célula de Ações */}
                      <td className="bg-[#141619] group-hover:bg-[#1a1d22] py-2 px-1.5 text-center border-r border-[#25282f] transition-colors">
                        <button
                          onClick={() => setSelectedStudentForActions(s)}
                          className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 border border-neutral-700 hover:border-amber-400 transition w-full cursor-pointer"
                          title="Abrir dados cadastrais e configuração financeira"
                        >
                          Ações
                        </button>
                      </td>

                      {/* Células dos Meses (JAN a DEZ) */}
                      {row.months.map((cell) => {
                        const key = `${s.id}_${cell.referenceMonth}`;
                        const pendingChange = pendingChanges.get(key);
                        const isPending = Boolean(pendingChange);

                        // Status visual atual
                        let visualStatus: GridFeeStatus = cell.status;
                        if (pendingChange) {
                          visualStatus = pendingChange.targetStatus;
                        }

                        // Estilização conforme regras estritas
                        let cellClass = '';
                        let labelText: string = visualStatus;

                        if (visualStatus === 'PRE' || visualStatus === 'PRÉ') {
                          // PRÉ: cinza neutro, bloqueado
                          cellClass = 'bg-[#181a1f] text-neutral-600 border-neutral-800/80 cursor-not-allowed select-none opacity-50';
                          labelText = 'PRÉ';
                        } else if (visualStatus === 'PAGO') {
                          // PAGO: verde
                          cellClass = 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-300 border-emerald-500/50 cursor-pointer active:scale-95';
                          labelText = 'PAGO';
                        } else if (visualStatus === 'ATRASO') {
                          // ATRASO: vermelho
                          cellClass = 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-300 border-rose-500/50 cursor-pointer active:scale-95';
                          labelText = 'ATRASO';
                        } else if (visualStatus === 'NÃO PAGO') {
                          // NÃO PAGO: laranja/âmbar
                          cellClass = 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 cursor-pointer active:scale-95';
                          labelText = 'NÃO PAGO';
                        } else if (visualStatus === 'PARCIAL') {
                          // PARCIAL: azul
                          cellClass = 'bg-sky-500/25 text-sky-200 border-sky-500/50 cursor-pointer hover:bg-sky-500/35';
                          labelText = 'PARCIAL';
                        } else if (visualStatus === 'BOLSISTA') {
                          // BOLSISTA: índigo
                          cellClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 cursor-not-allowed select-none';
                          labelText = 'BOLSISTA';
                        } else if (visualStatus === 'SEM MENSALIDADE') {
                          // SEM MENSALIDADE: cinza neutro sutil, clicável para lançar pagamento
                          cellClass = 'bg-neutral-800/45 hover:bg-neutral-700/60 text-neutral-300 border-neutral-700/60 cursor-pointer active:scale-95';
                          labelText = 'SEM MENSALIDADE';
                        }

                        return (
                          <td key={cell.referenceMonth} className="p-1 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleCellClick(s, cell)}
                              disabled={cell.isScholarship || cell.isPre || visualStatus === 'PRE' || visualStatus === 'PRÉ'}
                              className={`relative w-full min-h-[36px] py-1.5 px-1 text-[10px] sm:text-[10.5px] leading-[1.05] tracking-tight font-black rounded-lg border transition-all flex items-center justify-center text-center ${cellClass} ${
                                isPending ? 'ring-2 ring-amber-400 shadow-md scale-[1.02]' : ''
                              }`}
                              title={
                                visualStatus === 'PRE' || visualStatus === 'PRÉ'
                                  ? 'Aluno ainda não estava matriculado neste período'
                                  : visualStatus === 'BOLSISTA'
                                  ? 'Aluno bolsista (isento de mensalidade)'
                                  : visualStatus === 'SEM MENSALIDADE'
                                  ? `Sem mensalidade lançada para este mês (${formatCurrency(Number(s.monthly_fee_amount) || 0)} configurado). Clique para lançar como PAGO`
                                  : visualStatus === 'PARCIAL'
                                  ? `Pago: ${formatCurrency(cell.amountPaid)} / Restante: ${formatCurrency(cell.remainingAmount)}`
                                  : visualStatus === 'PAGO'
                                  ? `Mensalidade PAGA (${formatCurrency(cell.amount || Number(s.monthly_fee_amount) || 0)}). Clique para reverter para SEM MENSALIDADE`
                                  : `Mensalidade NÃO PAGA. Clique para alternar`
                              }
                            >
                              <span className="block w-full">
                                {visualStatus === 'SEM MENSALIDADE' ? (
                                  <span className="flex flex-col items-center leading-[1.05]">
                                    <span className="text-[9.5px] sm:text-[10px] font-black">SEM</span>
                                    <span className="text-[8px] sm:text-[8.5px] font-extrabold opacity-90">MENSAL.</span>
                                  </span>
                                ) : visualStatus === 'NÃO PAGO' ? (
                                  <span className="flex flex-col items-center leading-[1.05]">
                                    <span className="text-[9.5px] sm:text-[10px] font-black">NÃO</span>
                                    <span className="text-[9px] sm:text-[9.5px] font-black">PAGO</span>
                                  </span>
                                ) : (
                                  labelText
                                )}
                              </span>

                              {/* Indicador de Alteração Não Salva */}
                              {isPending && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-[#141619] rounded-full animate-ping" />
                              )}
                              {isPending && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border-2 border-[#141619] rounded-full" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legenda de Status no Rodapé */}
          <div className="p-3 bg-[#0c0d0f] border-t border-[#25282f] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[11px] font-mono font-bold uppercase text-neutral-400">
                Legenda:
              </span>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50 inline-block" />
                <span className="text-neutral-300 font-semibold text-[11px]">PAGO (Quitado)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50 inline-block" />
                <span className="text-neutral-300 font-semibold text-[11px]">NÃO PAGO (A vencer)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/50 inline-block" />
                <span className="text-neutral-300 font-semibold text-[11px]">ATRASO (Vencido)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#181a1f] border border-neutral-700 inline-block" />
                <span className="text-neutral-400 text-[11px]">PRÉ (Anterior à matrícula)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-500/30 border border-sky-500/50 inline-block" />
                <span className="text-neutral-300 font-semibold text-[11px]">PARCIAL</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-500/30 border border-indigo-500/50 inline-block" />
                <span className="text-neutral-300 font-semibold text-[11px]">BOLSISTA</span>
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 italic">
              Clique nos meses para alternar entre PAGO e NÃO PAGO
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ações do Aluno */}
      {selectedStudentForActions && (
        <StudentActionsModal
          student={selectedStudentForActions}
          isOpen={Boolean(selectedStudentForActions)}
          onClose={() => setSelectedStudentForActions(null)}
          onSuccess={(updatedStudent) => {
            if (updatedStudent && selectedStudentForActions) {
              setGridRows((prevRows) =>
                prevRows.map((r) => {
                  if (r.student.id === selectedStudentForActions.id) {
                    const newFeeAmount = Number(updatedStudent.monthly_fee_amount) || 0;
                    const newDueDay = Number(updatedStudent.due_day) || 10;
                    const newIsScholarship = Boolean(updatedStudent.is_scholarship);
                    return {
                      ...r,
                      student: {
                        ...r.student,
                        monthly_fee_amount: newFeeAmount,
                        due_day: newDueDay,
                        is_scholarship: newIsScholarship,
                      },
                      months: r.months.map((m) => ({
                        ...m,
                        isScholarship: newIsScholarship,
                        status: newIsScholarship ? 'BOLSISTA' : m.status === 'BOLSISTA' ? 'NÃO PAGO' : m.status,
                      })),
                    };
                  }
                  return r;
                })
              );
            }
            loadGridData(selectedYear);
          }}
          onOpenDetails={(id) => navigate(`/admin/alunos/${id}`)}
        />
      )}

      {/* Modal de Confirmação de Lançamento em Lote */}
      {showConfirmModal && (
        <div
          id="confirm-batch-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            id="confirm-batch-modal"
            className="w-full max-w-md rounded-2xl bg-[#141619] border border-[#25282f] p-6 shadow-2xl text-neutral-100 animate-fade-in"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white">Confirmar Lançamento</h3>
            <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
              Você está prestes a lançar <strong>{pendingChanges.size} alteraç{pendingChanges.size === 1 ? 'ão' : 'ões'}</strong> de mensalidade no banco de dados.
            </p>

            {/* Resumo das alterações */}
            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-[#0c0d0f] border border-[#1f2228] p-3 text-xs space-y-2">
              {Array.from(pendingChanges.values()).map((c) => (
                <div key={`${c.studentId}_${c.referenceMonth}`} className="flex items-center justify-between border-b border-neutral-800/50 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-semibold text-neutral-200 truncate max-w-[180px]">
                    {c.studentName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-neutral-400">{c.monthLabel}</span>
                    <span className="text-neutral-500">→</span>
                    <span className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                      c.targetStatus === 'PAGO'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.targetStatus === 'SEM MENSALIDADE'
                        ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {c.targetStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-neutral-400 mt-3">
              Todos os pagamentos e históricos serão registrados e o Dashboard será atualizado.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#25282f] pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={savingBatch}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={savingBatch}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow transition disabled:opacity-50"
              >
                {savingBatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Lançando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Lançamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Troca de Ano com Alterações Pendentes */}
      {pendingYearSwitch !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#141619] border border-[#25282f] p-6 shadow-2xl text-neutral-100">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white">Alterações não lançadas</h3>
            <p className="text-xs text-neutral-300 mt-2">
              Existem alterações de mensalidade ainda não lançadas no ano de {selectedYear}. Ao trocar de ano sem lançar, essas alterações serão descartadas.
            </p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setPendingYearSwitch(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl"
              >
                Continuar editando
              </button>

              <button
                onClick={handleConfirmYearSwitch}
                className="px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl"
              >
                Descartar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Geração em Lote Recorrente */}
      <BatchGenerateFeesModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onSuccess={() => {
          loadGridData(selectedYear);
        }}
      />

      {/* Modal de Confirmação de Reset Financeiro de Teste */}
      {showResetModal && (
        <div
          id="modal-financial-reset-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-[#141619] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Reset Financeiro (Zerar Testes)</h3>
                <p className="text-xs text-neutral-400">Limpeza dos lançamentos para reinício limpo</p>
              </div>
            </div>

            <div className="bg-[#181a1f] border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-300 space-y-2.5">
              <div>
                <p className="font-bold text-emerald-400">O que será 100% PRESERVADO:</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-300 mt-1">
                  <li>Todos os cadastros de alunos, nomes e telefones</li>
                  <li>Valores individuais configurados de mensalidade (ex: Rafael R$ 50)</li>
                  <li>Dias de vencimento base (ex: dia 22)</li>
                  <li>Configurações de bolsista / pagante</li>
                  <li>Catálogo de produtos</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-rose-400">O que será LIMPO:</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-300 mt-1">
                  <li>Mensalidades registradas (monthly_fees)</li>
                  <li>Pagamentos (payments)</li>
                  <li>Movimentações financeiras de histórico</li>
                </ul>
              </div>

              <p className="text-[11px] text-amber-300/90 italic pt-1 border-t border-neutral-800">
                Após a limpeza, todos os alunos exibirão &quot;SEM MENSALIDADE&quot; até que você lance as competências na grade.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resettingData}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-financial-reset"
                onClick={handleExecuteReset}
                disabled={resettingData}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
              >
                {resettingData ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Limpando dados...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmar e Limpar Lançamentos</span>
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
