import React, { useState, useMemo } from 'react';
import { dbService } from '../../../lib/dbService';
import { calculateAge } from '../../../lib/utils';
import { Student } from '../../../types/database';
import { useToast } from '../../../contexts/ToastContext';
import { Edit2, Calendar, Phone, MapPin, User, ShieldCheck, X } from 'lucide-react';

interface EditStudentModalProps {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
  isOpen?: boolean;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  onClose,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [fullName, setFullName] = useState(student.full_name || '');
  const [nickname, setNickname] = useState(student.nickname || '');
  const [dateOfBirth, setDateOfBirth] = useState(student.date_of_birth || '');
  const [address, setAddress] = useState(student.address || '');
  const [whatsapp, setWhatsapp] = useState(student.whatsapp || '');
  const [guardianName, setGuardianName] = useState(student.guardian_name || '');
  const [guardianPhone, setGuardianPhone] = useState(student.guardian_phone || '');
  const [active, setActive] = useState(student.active ?? true);
  const [loading, setLoading] = useState(false);

  const calculatedAge = useMemo(() => {
    if (!dateOfBirth) return null;
    return calculateAge(dateOfBirth);
  }, [dateOfBirth]);

  const isMinor = calculatedAge !== null && calculatedAge < 18;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      error('O nome completo do aluno é obrigatório.');
      return;
    }
    if (!dateOfBirth) {
      error('A data de nascimento é obrigatória.');
      return;
    }
    if (!address.trim()) {
      error('O endereço é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      await dbService.updateStudent(student.id, {
        fullName: fullName.trim(),
        nickname: nickname.trim() || undefined,
        dateOfBirth,
        address: address.trim(),
        whatsapp: whatsapp.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        active,
      });

      success('Dados do aluno atualizados com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao atualizar aluno: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="edit-student-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="edit-student-modal"
        className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 text-red-600">
            <Edit2 className="h-5 w-5" />
            <h3 className="font-bold text-gray-900">Editar Dados do Aluno</h3>
          </div>
          <button
            id="edit-student-close-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="edit-student-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Apelido */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Apelido na Capoeira
              </label>
              <input
                id="edit-student-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            {/* Data de Nascimento */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Data de Nascimento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="edit-student-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                  required
                />
              </div>
              {calculatedAge !== null && (
                <div className="mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ${
                      isMinor ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {calculatedAge} {calculatedAge === 1 ? 'ano' : 'anos'} {isMinor ? '(Menor)' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Endereço Completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="edit-student-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
          </div>

          {/* WhatsApp do Aluno */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              WhatsApp do Aluno
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="edit-student-whatsapp"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Seção do Responsável */}
          <div
            className={`rounded-2xl p-4 border transition-all ${
              isMinor
                ? 'bg-amber-50/70 border-amber-200 ring-2 ring-amber-400/20'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-gray-800 mb-3">
              <ShieldCheck className={`h-4 w-4 ${isMinor ? 'text-amber-600' : 'text-gray-500'}`} />
              <span>Dados do Responsável {isMinor ? '(Menor de idade)' : '(Opcional)'}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome do Pai, Mãe ou Responsável
                </label>
                <input
                  id="edit-student-guardian-name"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Telefone / WhatsApp do Responsável
                </label>
                <input
                  id="edit-student-guardian-phone"
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>
          </div>

          {/* Status Ativo */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              id="edit-student-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="edit-student-active" className="text-sm font-medium text-gray-700">
              Aluno com matrícula ativa na escola
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-3 border-t border-gray-100 pt-4">
            <button
              id="edit-student-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="edit-student-submit-btn"
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
            >
              <Edit2 className="h-4 w-4" />
              <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
