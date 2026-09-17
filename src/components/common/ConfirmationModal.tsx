import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = false,
  isLoading = false,
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-xl flex-shrink-0 ${
            isDestructive ? 'bg-rose-950/80 text-rose-400' : 'bg-amber-950/80 text-amber-400'
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed pt-1">{message}</p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#25272b]">
        <button
          id="btn-cancel-confirmation"
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          id="btn-confirm-action"
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition shadow-md disabled:opacity-50 flex items-center gap-2 ${
            isDestructive
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
              : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold shadow-amber-900/20'
          }`}
        >
          {isLoading ? 'Processando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
