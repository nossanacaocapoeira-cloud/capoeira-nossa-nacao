import React, { useState } from 'react';
import { Modal } from '../../common/Modal';
import { ConfirmationModal } from '../../common/ConfirmationModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { PaymentMethod } from '../../../types/database';
import { formatCurrency } from '../../../lib/utils';
import { CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  paymentType: 'monthly_fee' | 'product';
  itemTitle: string;
  monthlyFeeId?: string | null;
  productDebtId?: string | null;
  openBalance: number;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  paymentType,
  itemTitle,
  monthlyFeeId,
  productDebtId,
  openBalance,
  onSuccess,
}: RecordPaymentModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [amount, setAmount] = useState<number>(openBalance);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Keep amount synchronized when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setAmount(openBalance);
      setNotes('');
      setShowConfirm(false);
    }
  }, [isOpen, openBalance]);

  const newBalanceAfter = Math.max(0, Number((openBalance - (amount || 0)).toFixed(2)));
  const isCompletePayoff = newBalanceAfter === 0;

  const handleValidateAndOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      error('O valor do pagamento deve ser maior que zero.');
      return;
    }
    if (amount > openBalance + 0.001) {
      error('O valor informado é maior que o saldo em aberto.');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      const result = await dbService.recordPayment({
        studentId,
        paymentType,
        monthlyFeeId: paymentType === 'monthly_fee' ? monthlyFeeId : null,
        productDebtId: paymentType === 'product' ? productDebtId : null,
        amount,
        paymentMethod,
        notes: notes.trim() || undefined,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      if (result?.nextFeeCreated) {
        success(`Pagamento registrado! Próxima mensalidade (${result.nextFeeCreated.reference_month}) gerada automaticamente.`);
      } else {
        success('Pagamento registrado com sucesso!');
      }
      onSuccess();
      setShowConfirm(false);
      onClose();
    } catch (err: any) {
      error(`Erro ao registrar pagamento: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !showConfirm} onClose={onClose} title={`Dar Baixa / Registrar Pagamento`} maxWidth="md">
        <form onSubmit={handleValidateAndOpenConfirm} className="space-y-4 text-xs">
          {/* Target Item summary */}
          <div className="p-3.5 bg-[#111214] border border-[#25282e] rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              Aluno: {studentName}
            </span>
            <h4 className="text-sm font-bold text-neutral-100">{itemTitle}</h4>
            <div className="flex items-center justify-between pt-1">
              <span className="text-neutral-400">Saldo em aberto atual:</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {formatCurrency(openBalance)}
              </span>
            </div>
          </div>

          {/* Amount to pay */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider">
                Valor Recebido (R$) <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmount(openBalance)}
                className="text-[11px] text-amber-400 hover:underline font-semibold"
              >
                Pagar valor total ({formatCurrency(openBalance)})
              </button>
            </div>
            <input
              id="input-payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={openBalance}
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
              className="w-full px-3.5 py-2.5 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono text-base font-bold focus:border-amber-500 outline-none"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Forma de Pagamento <span className="text-amber-400">*</span>
            </label>
            <select
              id="select-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-medium focus:border-amber-500 outline-none"
            >
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão de Débito/Crédito</option>
              <option value="transferencia">Transferência Bancária</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Observação (Opcional)
            </label>
            <input
              id="input-payment-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Comprovante enviado no WhatsApp, pago em dinheiro no treino, etc."
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Live Preview Before Confirmation */}
          <div className="p-3.5 bg-[#16181c] border border-[#2a2d34] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Valor em aberto:</span>
              <span className="font-mono font-medium">{formatCurrency(openBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-200">
              <span>Pagamento informado:</span>
              <span className="font-mono font-bold text-emerald-400">
                - {formatCurrency(amount || 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="font-bold text-neutral-100">Saldo depois:</span>
              <span
                className={`font-mono text-sm font-black ${
                  isCompletePayoff ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {formatCurrency(newBalanceAfter)} {isCompletePayoff ? '(Quitado)' : '(Parcial)'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23252b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              id="btn-preview-confirm-payment"
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl shadow transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar Pagamento
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Step */}
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmPayment}
        title="Confirmar Recebimento de Valor"
        message={`Deseja registrar o pagamento de ${formatCurrency(amount)} via ${paymentMethod.toUpperCase()} para o aluno ${studentName}? O saldo restante será de ${formatCurrency(newBalanceAfter)}.`}
        confirmLabel="Sim, Registrar Pagamento"
        isLoading={loading}
      />
    </>
  );
}
