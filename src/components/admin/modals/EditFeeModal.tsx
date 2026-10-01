import React, { useState, useEffect } from 'react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { MonthlyFee } from '../../../types/database';
import { formatReferenceDisplay } from '../../../lib/utils';
import { Edit3 } from 'lucide-react';

interface EditFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: MonthlyFee | null;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}

export function EditFeeModal({
  isOpen,
  onClose,
  fee,
  studentId,
  studentName,
  onSuccess,
}: EditFeeModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [amount, setAmount] = useState<number | string>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'overdue'>('pending');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && fee) {
      setAmount(Number(fee.amount) || 0);
      setDueDate(fee.due_date ? fee.due_date.substring(0, 10) : '');
      const s = fee.status;
      setStatus(s === 'paid' ? 'paid' : s === 'overdue' ? 'overdue' : 'pending');
      setNotes(fee.notes || '');
      setLoading(false);
    }
  }, [isOpen, fee]);

  if (!fee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dueDate) {
      error('Data de vencimento é obrigatória.');
      return;
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    if (numAmount < 0) {
      error('O valor da mensalidade não pode ser negativo.');
      return;
    }

    setLoading(true);
    try {
      await dbService.updateMonthlyFee({
        feeId: fee.id,
        studentId,
        amount: numAmount,
        dueDate: dueDate.trim(),
        status,
        notes: notes.trim() || undefined,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success('Mensalidade atualizada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao atualizar mensalidade: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Mensalidade • ${formatReferenceDisplay(fee.reference_month)}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-[#16181c] border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-400">Aluno</p>
            <p className="text-sm font-bold text-neutral-100 uppercase">{studentName}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-neutral-400">Competência</p>
            <p className="text-sm font-mono font-bold text-amber-400">
              {formatReferenceDisplay(fee.reference_month)}
            </p>
          </div>
        </div>

        {/* VALOR */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Valor Total (R$) <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono font-bold text-sm">
              R$
            </span>
            <input
              id="input-edit-fee-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full pl-11 pr-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-sm text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none transition"
            />
          </div>
        </div>

        {/* DATA DE VENCIMENTO */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Data de Vencimento <span className="text-amber-400">*</span>
          </label>
          <input
            id="input-edit-fee-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-sm text-neutral-100 font-mono focus:border-amber-500 outline-none transition"
          />
        </div>

        {/* STATUS */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Status da Mensalidade <span className="text-amber-400">*</span>
          </label>
          <select
            id="select-edit-fee-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3.5 py-2.5 bg-[#111214] border border-[#2b2e35] rounded-xl text-neutral-100 focus:border-amber-500 outline-none text-xs font-semibold"
          >
            <option value="pending">Pendente (Em aberto)</option>
            <option value="paid">Paga (Quitada integralmente)</option>
            <option value="overdue">Vencida (Atrasada)</option>
          </select>
        </div>

        {/* OBSERVAÇÃO */}
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
            Observações
          </label>
          <input
            id="input-edit-fee-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Desconto autorizado, prorrogação de prazo..."
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
            id="btn-confirm-edit-fee"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition text-xs flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
