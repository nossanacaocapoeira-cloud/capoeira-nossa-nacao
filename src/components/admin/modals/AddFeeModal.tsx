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

interface AddFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  defaultAmount?: number;
  onSuccess: () => void;
}

export function AddFeeModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  defaultAmount = 120,
  onSuccess,
}: AddFeeModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [referenceDate, setReferenceDate] = useState<string>('');
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Sempre recalcular com base na data local atual ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      const today = getTodayLocalDateString();
      const autoDue = calculateNextMonthDueDate(today);
      setReferenceDate(today);
      setDueDate(autoDue);
      setAmount(defaultAmount);
      setNotes('');
    }
  }, [isOpen, defaultAmount]);

  // Se o Admin alterar a Data de Referência antes de salvar: recalcular automaticamente o vencimento (+1 mês)
  const handleReferenceDateChange = (newRefDate: string) => {
    setReferenceDate(newRefDate);
    if (newRefDate) {
      const autoDue = calculateNextMonthDueDate(newRefDate);
      if (autoDue) {
        setDueDate(autoDue);
      }
    }
  };

  // Se o Admin alterar apenas o vencimento, aceitar a alteração manual sem alterar a referência
  const handleDueDateChange = (newDueDate: string) => {
    setDueDate(newDueDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referenceDate) {
      error('Informe a data de referência.');
      return;
    }
    if (amount <= 0) {
      error('O valor da mensalidade deve ser maior que zero.');
      return;
    }
    if (!dueDate) {
      error('Informe a data de vencimento.');
      return;
    }

    setLoading(true);
    try {
      // Garantir formato ISO YYYY-MM-DD para a coluna reference_month do PostgreSQL (tipo date)
      const cleanRefDate = referenceDate.trim();
      const monthLabel = deriveReferenceMonth(cleanRefDate);

      await dbService.addMonthlyFee({
        studentId,
        referenceMonth: cleanRefDate, // Envia estritamente YYYY-MM-DD (ex: "2026-09-16")
        description: `Mensalidade ${monthLabel}`,
        amount,
        dueDate: dueDate.trim(), // Envia estritamente YYYY-MM-DD (ex: "2026-10-16")
        notes: notes.trim() || undefined,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success('Mensalidade adicionada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao adicionar mensalidade: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  const derivedMonthLabel = referenceDate ? deriveReferenceMonth(referenceDate) : '';

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
          <div className="flex items-center justify-between mb-1">
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider">
              Data de Referência <span className="text-amber-400">*</span>
            </label>
            {derivedMonthLabel && (
              <span className="text-[11px] font-mono text-amber-400/90 font-medium">
                Mês: {derivedMonthLabel}
              </span>
            )}
          </div>
          <input
            id="input-fee-ref-date"
            type="date"
            value={referenceDate}
            onChange={(e) => handleReferenceDateChange(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono focus:border-amber-500 outline-none"
          />
        </div>

        {/* VALOR */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Valor (R$) <span className="text-amber-400">*</span>
          </label>
          <input
            id="input-fee-amount"
            type="number"
            step="0.01"
            min="1"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
          />
        </div>

        {/* DATA DE VENCIMENTO */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider">
              Data de Vencimento <span className="text-amber-400">*</span>
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">
              +1 mês da referência (editável)
            </span>
          </div>
          <input
            id="input-fee-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono focus:border-amber-500 outline-none"
          />
        </div>

        {/* OBSERVAÇÃO (OPCIONAL) */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Observação (Opcional)
          </label>
          <input
            id="input-fee-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Desconto de irmão, bolsa parcial, etc."
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
          />
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
            id="btn-confirm-add-fee"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition"
          >
            {loading ? 'Salvando...' : 'Adicionar Mensalidade'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
