import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Payment } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface RevertPaymentModalProps {
  payment: Payment;
  studentName?: string;
  onClose: () => void;
  onSuccess: () => void;
  isOpen?: boolean;
}

export const RevertPaymentModal: React.FC<RevertPaymentModalProps> = ({
  payment,
  studentName,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRevert = async () => {
    if (!reason.trim()) {
      error('Informe o motivo da reversão.');
      return;
    }

    setLoading(true);
    try {
      const res = await dbService.revertPayment({
        paymentId: payment.id,
        reason: reason.trim(),
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      if (res.nextFeeCancelled) {
        success('Pagamento revertido! A mensalidade seguinte gerada automaticamente foi cancelada.');
      } else if (res.nextFeeWarning) {
        warning(`Pagamento revertido. Aviso: ${res.nextFeeWarning}`);
      } else {
        success('Pagamento revertido com sucesso e registrado na auditoria.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao reverter pagamento: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="revert-payment-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div
        id="revert-payment-modal"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <RotateCcw className="h-5 w-5" />
            <h3 className="font-bold text-gray-900">Reverter Pagamento</h3>
          </div>
          <button
            id="revert-modal-close-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Ação de Auditoria e Integridade</p>
                <p className="mt-1 text-amber-800">
                  O pagamento não será excluído do banco. Ele será marcado como{' '}
                  <span className="font-bold">REVERTIDO</span>, o saldo do aluno será recalculado e uma entrada
                  de auditoria será gravada permanentemente.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
            {studentName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Aluno:</span>
                <span className="font-semibold text-gray-900">{studentName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Valor:</span>
              <span className="font-bold text-emerald-700">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo:</span>
              <span className="font-medium text-gray-800">
                {payment.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data do Pagamento:</span>
              <span className="text-gray-700">{formatDate(payment.paid_at)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Motivo da Reversão <span className="text-red-500">*</span>
            </label>
            <textarea
              id="revert-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Pagamento registrado para o aluno errado por engano..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              required
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-gray-100 pt-4">
          <button
            id="revert-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            id="revert-confirm-btn"
            type="button"
            onClick={handleRevert}
            disabled={loading || !reason.trim()}
            className="flex items-center space-x-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{loading ? 'Revertendo...' : 'Confirmar Reversão'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
