import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { formatCurrency } from '../../../lib/utils';
import { MonthlyFee } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';
import { AlertCircle, Ban, X } from 'lucide-react';

interface CancelMonthlyFeeModalProps {
  fee: MonthlyFee;
  studentName?: string;
  onClose: () => void;
  onSuccess: () => void;
  isOpen?: boolean;
}

export const CancelMonthlyFeeModal: React.FC<CancelMonthlyFeeModalProps> = ({
  fee,
  studentName,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!reason.trim()) {
      error('Informe o motivo do cancelamento.');
      return;
    }

    setLoading(true);
    try {
      await dbService.cancelMonthlyFee({
        feeId: fee.id,
        reason: reason.trim(),
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success('Mensalidade cancelada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao cancelar mensalidade: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="cancel-fee-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div
        id="cancel-fee-modal"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 text-red-600">
            <Ban className="h-5 w-5" />
            <h3 className="font-bold text-gray-900">Cancelar Mensalidade</h3>
          </div>
          <button
            id="cancel-fee-modal-close-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
            {studentName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Aluno:</span>
                <span className="font-semibold text-gray-900">{studentName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Referência:</span>
              <span className="font-semibold text-gray-900">{fee.reference_month}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Valor:</span>
              <span className="font-bold text-gray-900">{formatCurrency(fee.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vencimento:</span>
              <span className="text-gray-700">{fee.due_date}</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              A mensalidade será marcada como <strong>CANCELADA</strong> e seu valor sairá do saldo a receber do aluno.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Motivo do Cancelamento <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cancel-fee-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Mensalidade lançada em duplicidade ou valor incorreto..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              required
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-gray-100 pt-4">
          <button
            id="cancel-fee-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            id="cancel-fee-confirm-btn"
            type="button"
            onClick={handleCancel}
            disabled={loading || !reason.trim()}
            className="flex items-center space-x-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            <span>{loading ? 'Cancelando...' : 'Confirmar Cancelamento'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
