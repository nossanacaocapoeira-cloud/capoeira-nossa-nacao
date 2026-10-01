import React, { useState, useMemo, useEffect } from 'react';
import { dbService, StudentWithBalance } from '../../../lib/dbService';
import { calculateAge, formatDate } from '../../../lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import {
  DollarSign,
  Award,
  Clock,
  X,
  Save,
  ExternalLink,
} from 'lucide-react';

interface StudentActionsModalProps {
  student: StudentWithBalance;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedStudent?: any) => void;
  onOpenDetails?: (studentId: string) => void;
}

export const StudentActionsModal: React.FC<StudentActionsModalProps> = ({
  student,
  isOpen,
  onClose,
  onSuccess,
  onOpenDetails,
}) => {
  const { success, error: toastError } = useToast();

  // Estados dos campos configuráveis
  const initialFee = Number(student.monthly_fee_amount) || 0;

  const [feeAmount, setFeeAmount] = useState<number | string>(initialFee);
  const [dueDay, setDueDay] = useState<number | string>(student.due_day ?? 10);
  const [isScholarship, setIsScholarship] = useState<boolean>(
    Boolean(student.is_scholarship || (student as any).isScholarship)
  );

  const [saving, setSaving] = useState(false);

  // Sincroniza os dados quando o modal abre ou quando o aluno selecionado muda
  useEffect(() => {
    if (isOpen && student) {
      const currentFee = Number(student.monthly_fee_amount) || 0;
      setFeeAmount(currentFee);
      setDueDay(student.due_day ?? 10);
      setIsScholarship(Boolean(student.is_scholarship || (student as any).isScholarship));
    }
  }, [
    isOpen,
    student.id,
    student.monthly_fee_amount,
    student.due_day,
    student.is_scholarship,
    (student as any).isScholarship,
  ]);

  const age = useMemo(() => {
    if (!student.date_of_birth) return null;
    return calculateAge(student.date_of_birth);
  }, [student.date_of_birth]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const parsedFee =
        typeof feeAmount === 'string' ? parseFloat(feeAmount) : feeAmount;
      const parsedDueDay =
        typeof dueDay === 'string'
          ? dueDay ? parseInt(dueDay, 10) : null
          : dueDay;

      if (parsedDueDay && (parsedDueDay < 1 || parsedDueDay > 31)) {
        toastError('O dia de vencimento deve ser entre 1 e 31.');
        setSaving(false);
        return;
      }

      const finalFee = isScholarship ? 0 : (!isNaN(parsedFee) && parsedFee >= 0 ? parsedFee : 0);
      const finalDueDay = parsedDueDay && !isNaN(parsedDueDay) ? parsedDueDay : 10;

      const updatedStudent = await dbService.updateStudent(student.id, {
        fullName: student.full_name,
        nickname: student.nickname || undefined,
        dateOfBirth: student.date_of_birth,
        address: student.address || '',
        whatsapp: student.whatsapp || undefined,
        guardianName: student.guardian_name || undefined,
        guardianPhone: student.guardian_phone || undefined,
        active: student.active ?? true,
        isScholarship,
        dueDay: finalDueDay,
        feeAmount: finalFee,
      });

      // Atualiza o objeto em memória para refletir imediatamente sem esperar reload
      student.monthly_fee_amount = finalFee;
      student.due_day = finalDueDay;
      student.is_scholarship = isScholarship;

      success('Configurações da mensalidade salvas com sucesso!');
      onSuccess(updatedStudent);
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar configurações do aluno:', err);
      toastError(`Não foi possível salvar a configuração financeira: ${err?.message || 'Tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="student-actions-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto animate-fade-in"
    >
      <div
        id="student-actions-modal"
        className="my-6 w-full max-w-xl rounded-2xl bg-[#141619] border border-[#25282f] p-6 shadow-2xl text-neutral-100 transition-all"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#25282f] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black">
              {student.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  {student.full_name}
                </h3>
                {student.nickname && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    "{student.nickname}"
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Ações e Configuração Financeira do Aluno
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações Cadastrais */}
        <div className="mt-4 p-4 rounded-xl bg-[#0c0d0f] border border-[#1f2228] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-neutral-400 block font-medium">WhatsApp:</span>
            <span className="text-neutral-200 font-semibold">
              {student.whatsapp || 'Não informado'}
            </span>
          </div>

          <div>
            <span className="text-neutral-400 block font-medium">Nascimento / Idade:</span>
            <span className="text-neutral-200 font-semibold">
              {student.date_of_birth ? formatDate(student.date_of_birth) : 'Não informada'}
              {age !== null ? ` (${age} anos)` : ''}
            </span>
          </div>

          {student.guardian_name && (
            <div>
              <span className="text-neutral-400 block font-medium">Responsável:</span>
              <span className="text-neutral-200 font-semibold">
                {student.guardian_name} {student.guardian_phone ? `(${student.guardian_phone})` : ''}
              </span>
            </div>
          )}

          <div>
            <span className="text-neutral-400 block font-medium">Data de Cadastro:</span>
            <span className="text-neutral-200 font-semibold">
              {student.created_at ? formatDate(student.created_at) : '—'}
            </span>
          </div>
        </div>

        {/* Formulário de Configuração Financeira */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="border-t border-[#25282f] pt-4 space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Configuração da Mensalidade
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Valor Mensal Individual */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Valor mensal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    disabled={isScholarship}
                    className={`w-full pl-9 pr-3 py-2 bg-[#0c0d0f] border border-[#25282f] rounded-xl text-sm font-bold text-white focus:border-amber-500 outline-none transition ${
                      isScholarship ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''
                    }`}
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  {isScholarship ? 'Bolsista: mensalidade zerada' : 'Valor mensal do aluno'}
                </p>
              </div>

              {/* Dia de Vencimento Base */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Dia de vencimento
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0c0d0f] border border-[#25282f] rounded-xl text-sm font-bold text-white focus:border-amber-500 outline-none transition"
                    placeholder="10"
                    required
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Dia-base permanente (1 a 31)
                </p>
              </div>
            </div>

            {/* Situação: PAGANTE / BOLSISTA */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Situação
              </label>
              <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                <button
                  type="button"
                  onClick={() => setIsScholarship(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    !isScholarship
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow'
                      : 'bg-[#0c0d0f] text-neutral-400 border-[#25282f] hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  PAGANTE
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsScholarship(true);
                    setFeeAmount(0);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    isScholarship
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-[#0c0d0f] text-neutral-400 border-[#25282f] hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  BOLSISTA
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                {isScholarship ? 'Bolsista: não gera cobrança nem inadimplência de mensalidade' : 'Pagante: mensalidade gerada com o valor configurado'}
              </p>
            </div>
          </div>

          {/* Rodapé / Ações */}
          <div className="border-t border-[#25282f] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {onOpenDetails && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDetails(student.id);
                }}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver Perfil Financeiro Completo
              </button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
