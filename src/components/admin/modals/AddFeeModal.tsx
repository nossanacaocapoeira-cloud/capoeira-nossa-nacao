import React, { useState, useEffect } from 'react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import {
  getTodayLocalDateString,
  calculateNextMonthDueDate,
  deriveReferenceMonth,
} from '../../../lib/utils';
import { ShieldCheck } from 'lucide-react';

interface AddFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  defaultAmount?: number;
  defaultDueDay?: number;
  isScholarshipDefault?: boolean;
  onSuccess: () => void;
}

export function AddFeeModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  defaultAmount,
  defaultDueDay,
  isScholarshipDefault,
  onSuccess,
}: AddFeeModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [referenceDate, setReferenceDate] = useState<string>('');
  const [amount, setAmount] = useState<number | string>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [isScholarship, setIsScholarship] = useState<boolean>(false);
  const [initialStatus, setInitialStatus] = useState<'pending' | 'paid'>('pending');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Inicializar com a data atual e dados financeiros reais do aluno
  useEffect(() => {
    if (isOpen) {
      const today = getTodayLocalDateString();
      const currentYear = today.substring(0, 4);
      const currentMonth = today.substring(5, 7);

      setReferenceDate(today);
      setIsScholarship(Boolean(isScholarshipDefault));
      setInitialStatus('pending');
      setNotes('');
      setLoading(false);

      const setupFromStudent = async () => {
        let stdAmount = defaultAmount;
        let stdDueDay = defaultDueDay;
        let stdScholarship = isScholarshipDefault;

        if (stdAmount === undefined || stdDueDay === undefined || stdScholarship === undefined) {
          try {
            const profile = await dbService.getStudentById(studentId);
            if (profile) {
              if (stdAmount === undefined) {
                stdAmount = Number(profile.monthly_fee_amount) || 0;
              }
              if (stdDueDay === undefined) {
                stdDueDay = Number(profile.due_day) || 10;
              }
              if (stdScholarship === undefined) {
                stdScholarship = Boolean(profile.is_scholarship);
              }
            }
          } catch (e) {
            console.warn('[AddFeeModal] Aviso ao carregar perfil do aluno:', e);
          }
        }

        const effectiveScholarship = Boolean(stdScholarship);
        setIsScholarship(effectiveScholarship);
        setAmount(effectiveScholarship ? 0 : (stdAmount ?? 0));

        const dayPadded = String(Math.min(Math.max(stdDueDay || 10, 1), 31)).padStart(2, '0');
        setDueDate(`${currentYear}-${currentMonth}-${dayPadded}`);
      };

      setupFromStudent();
    }
  }, [isOpen, studentId, defaultAmount, defaultDueDay, isScholarshipDefault]);

  // Se o Admin alterar a Data de Referência: recalcular o vencimento preservando o dia base
  const handleReferenceDateChange = (newRefDate: string) => {
    setReferenceDate(newRefDate);
    if (newRefDate && newRefDate.length >= 7) {
      const ym = newRefDate.substring(0, 7);
      const curDueDay = dueDate && dueDate.length === 10 ? dueDate.substring(8, 10) : '10';
      setDueDate(`${ym}-${curDueDay}`);
    }
  };

  // Se for marcado Bolsista: zerar valor e desabilitar
  const handleToggleScholarship = (checked: boolean) => {
    setIsScholarship(checked);
    if (checked) {
      setAmount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referenceDate) {
      error('Informe a data de referência.');
      return;
    }
    if (!dueDate) {
      error('Informe a data de vencimento.');
      return;
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;

    if (!isScholarship && numAmount <= 0) {
      error('O valor da mensalidade deve ser maior que zero (ou marque como Bolsista).');
      return;
    }

    setLoading(true);
    try {
      const cleanRefDate = referenceDate.trim();
      const monthLabel = deriveReferenceMonth(cleanRefDate);
      const cleanDueDate = dueDate.trim();

      await dbService.addMonthlyFee({
        studentId,
        referenceMonth: cleanRefDate,
        description: isScholarship ? `Mensalidade ${monthLabel} (Bolsista)` : `Mensalidade ${monthLabel}`,
        amount: isScholarship ? 0 : numAmount,
        dueDate: cleanDueDate,
        isScholarship,
        status: isScholarship ? 'scholarship' : initialStatus,
        notes: notes.trim() || undefined,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success(isScholarship ? 'Mensalidade isenta (Bolsista) cadastrada!' : 'Mensalidade adicionada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao adicionar mensalidade: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adicionar Mensalidade • ${studentName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* DATA DE REFERÊNCIA */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Data de Referência <span className="text-amber-400">*</span>
          </label>
          <input
            id="input-fee-ref-date"
            type="date"
            value={referenceDate}
            onChange={(e) => handleReferenceDateChange(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-sm text-neutral-100 font-mono focus:border-amber-500 outline-none transition"
          />
        </div>

        {/* VALOR */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Valor (R$) <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono font-bold text-sm">
              R$
            </span>
            <input
              id="input-fee-amount"
              type="number"
              step="0.01"
              min="0"
              disabled={isScholarship}
              value={isScholarship ? 0 : amount}
              onChange={(e) => setAmount(e.target.value)}
              required={!isScholarship}
              placeholder="0,00"
              className={`w-full pl-11 pr-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-sm text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none transition ${
                isScholarship ? 'opacity-50 cursor-not-allowed bg-neutral-900 text-neutral-500' : ''
              }`}
            />
          </div>
        </div>

        {/* DATA DE VENCIMENTO */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Data de Vencimento <span className="text-amber-400">*</span>
          </label>
          <input
            id="input-fee-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-sm text-neutral-100 font-mono focus:border-amber-500 outline-none transition"
          />
        </div>

        {/* BOLSISTA CHECKBOX */}
        <div className="p-3 bg-[#16181c] border border-purple-500/30 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              id="checkbox-fee-scholarship"
              type="checkbox"
              checked={isScholarship}
              onChange={(e) => handleToggleScholarship(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-purple-600 focus:ring-purple-500 bg-neutral-900 cursor-pointer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold text-neutral-200 uppercase tracking-wider">
                  Bolsista
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Aluno isento de mensalidade (valor R$ 0,00).
              </p>
            </div>
          </label>
        </div>

        {/* STATUS INICIAL */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Status Inicial <span className="text-amber-400">*</span>
          </label>
          {isScholarship ? (
            <div className="w-full px-3.5 py-2.5 bg-[#111214] border border-purple-500/40 rounded-xl text-purple-300 font-semibold text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Bolsista (Isento da cobrança)</span>
            </div>
          ) : (
            <select
              id="select-fee-initial-status"
              value={initialStatus}
              onChange={(e) => setInitialStatus(e.target.value as 'pending' | 'paid')}
              className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-neutral-100 focus:border-amber-500 outline-none text-xs font-semibold"
            >
              <option value="pending">Pendente (Aguardando pagamento)</option>
              <option value="paid">Paga (Registrar já como liquidada)</option>
            </select>
          )}
        </div>

        {/* OBSERVAÇÃO (OPCIONAL) */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Observação <span className="text-neutral-500 font-normal">(Opcional)</span>
          </label>
          <input
            id="input-fee-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Desconto de irmão, bolsa de incentivo, etc."
            className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-neutral-100 placeholder-neutral-500 focus:border-amber-500 outline-none text-xs"
          />
        </div>

        {/* BOTÕES */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#23252b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white rounded-xl transition text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-add-fee"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition text-xs"
          >
            {loading ? 'Salvando...' : 'Adicionar Mensalidade'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
