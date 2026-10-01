import React, { useEffect, useState } from 'react';
import { Modal } from '../../common/Modal';
import { ConfirmationModal } from '../../common/ConfirmationModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/utils';
import { Users, Calendar, AlertCircle } from 'lucide-react';

interface BatchGenerateFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchGenerateFeesModal({ isOpen, onClose, onSuccess }: BatchGenerateFeesModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const now = new Date();
  const ptMonths = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const currentMonthName = `${ptMonths[now.getMonth()]}/${now.getFullYear()}`;

  const [referenceMonth, setReferenceMonth] = useState(currentMonthName);
  const [defaultAmount, setDefaultAmount] = useState<number>(50);
  const [dueDay, setDueDay] = useState<number>(10);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [alreadyBilledCount, setAlreadyBilledCount] = useState<number>(0);
  const [loadingCheck, setLoadingCheck] = useState<boolean>(true);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      checkCounts();
    }
  }, [isOpen, referenceMonth]);

  const checkCounts = async () => {
    setLoadingCheck(true);
    try {
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .eq('active', true);

      const totalActive = students?.length || 0;
      setActiveCount(totalActive);

      const { data: existing } = await supabase
        .from('monthly_fees')
        .select('student_id')
        .eq('reference_month', referenceMonth.trim());

      setAlreadyBilledCount(existing?.length || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCheck(false);
    }
  };

  const eligibleCount = Math.max(0, activeCount - alreadyBilledCount);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceMonth.trim()) {
      error('Informe o mês de referência.');
      return;
    }
    if (defaultAmount <= 0) {
      error('O valor deve ser maior que zero.');
      return;
    }
    if (eligibleCount === 0) {
      error('Todos os alunos ativos já possuem mensalidade gerada para este mês.');
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteBatch = async () => {
    setLoadingSubmit(true);
    try {
      const result = await dbService.generateMonthlyFeesBatch({
        referenceMonth: referenceMonth.trim(),
        defaultAmount,
        dueDay,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success(
        `Geradas ${result.createdCount} mensalidades com sucesso! (${result.skippedCount} já existiam).`
      );
      onSuccess();
      setShowConfirm(false);
      onClose();
    } catch (err: any) {
      error(`Erro ao gerar mensalidades em lote: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !showConfirm} onClose={onClose} title="Gerar Mensalidades do Mês em Lote" maxWidth="md">
        <form onSubmit={handleOpenConfirm} className="space-y-4 text-xs">
          <p className="text-neutral-400 leading-relaxed">
            Esta ferramenta cria automaticamente a cobrança de mensalidade para todos os alunos matriculados ativos,
            sem duplicar cobranças já existentes para o mês.
          </p>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Mês de Referência <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-batch-ref-month"
              type="text"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              required
              placeholder="Ex: Setembro/2026"
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-bold focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Valor Padrão (R$) <span className="text-amber-400">*</span>
              </label>
              <input
                id="input-batch-amount"
                type="number"
                step="0.01"
                min="1"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Dia de Vencimento <span className="text-amber-400">*</span>
              </label>
              <input
                id="input-batch-due-day"
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value) || 10)}
                required
                className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Pre-Execution Stats Box */}
          <div className="p-4 bg-[#141619] border border-[#27292f] rounded-xl space-y-2">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">
              Resumo da Operação
            </span>

            {loadingCheck ? (
              <div className="h-10 bg-neutral-800 rounded animate-pulse" />
            ) : (
              <div className="space-y-1 text-neutral-300">
                <div className="flex justify-between">
                  <span>Alunos ativos cadastrados:</span>
                  <span className="font-bold text-neutral-100">{activeCount}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Já possuem mensalidade de {referenceMonth}:</span>
                  <span className="font-bold text-amber-400">{alreadyBilledCount}</span>
                </div>
                <div className="pt-2 border-t border-neutral-800 flex justify-between font-bold text-emerald-400 text-sm">
                  <span>Novas mensalidades a gerar:</span>
                  <span>{eligibleCount} alunos</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23252b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              id="btn-preview-batch-generate"
              type="submit"
              disabled={loadingCheck || eligibleCount === 0}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition"
            >
              Avançar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleExecuteBatch}
        title="Confirmar Geração em Lote"
        message={`Deseja gerar a cobrança de ${referenceMonth} no valor de ${formatCurrency(defaultAmount)} para ${eligibleCount} alunos ativos?`}
        confirmLabel="Sim, Gerar Mensalidades"
        isLoading={loadingSubmit}
      />
    </>
  );
}
