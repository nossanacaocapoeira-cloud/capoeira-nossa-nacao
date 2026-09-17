import React, { useState } from 'react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { formatCurrency } from '../../../lib/utils';
import { Sliders, AlertTriangle } from 'lucide-react';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  itemType: 'monthly_fee' | 'product_debt';
  itemId: string;
  itemTitle: string;
  currentAmount: number;
  amountPaid: number;
  onSuccess: () => void;
}

export function AdjustmentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  itemType,
  itemId,
  itemTitle,
  currentAmount,
  amountPaid,
  onSuccess,
}: AdjustmentModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [newTotalAmount, setNewTotalAmount] = useState<number>(currentAmount);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setNewTotalAmount(currentAmount);
      setReason('');
    }
  }, [isOpen, currentAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      error('O motivo do ajuste é estritamente obrigatório para fins de auditoria.');
      return;
    }
    if (newTotalAmount < amountPaid) {
      error(`O novo valor não pode ser menor que o valor já pago (${formatCurrency(amountPaid)}).`);
      return;
    }

    setLoading(true);
    try {
      await dbService.recordAdjustment({
        studentId,
        itemType,
        itemId,
        newTotalAmount,
        reason: reason.trim(),
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success('Ajuste financeiro registrado com sucesso no histórico imutável.');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao registrar ajuste: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Fazer Ajuste de Valor • ${studentName}`} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            <span>Auditoria Financeira</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Todos os ajustes de valor são gravados no histórico financeiro de forma permanente, registrando o valor
            anterior, o novo valor, o usuário responsável e a justificativa.
          </p>
        </div>

        <div className="p-3 bg-[#111214] border border-[#25282e] rounded-xl space-y-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase">Item a Ajustar</span>
          <h4 className="font-bold text-sm text-neutral-100">{itemTitle}</h4>
          <div className="flex items-center justify-between text-neutral-400 pt-1">
            <span>Valor atual cadastrado:</span>
            <span className="font-mono font-bold text-neutral-200">{formatCurrency(currentAmount)}</span>
          </div>
          {amountPaid > 0 && (
            <div className="flex items-center justify-between text-emerald-400">
              <span>Valor já quitado:</span>
              <span className="font-mono font-bold">{formatCurrency(amountPaid)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Novo Valor Total (R$) <span className="text-amber-400">*</span>
          </label>
          <input
            id="input-adjustment-new-amount"
            type="number"
            step="0.01"
            min={amountPaid}
            value={newTotalAmount}
            onChange={(e) => setNewTotalAmount(parseFloat(e.target.value) || 0)}
            required
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold text-sm focus:border-amber-500 outline-none"
          />
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Diferença: {formatCurrency(newTotalAmount - currentAmount)}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Motivo do Ajuste (Obrigatório) <span className="text-amber-400">*</span>
          </label>
          <textarea
            id="input-adjustment-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Explique o motivo deste ajuste (ex: Concedido desconto especial de batizado autorizado pelo Mestre)..."
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none resize-none"
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
            id="btn-confirm-adjustment"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition"
          >
            {loading ? 'Gravando Ajuste...' : 'Confirmar Ajuste'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
