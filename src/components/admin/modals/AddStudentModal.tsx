import React, { useState, useMemo } from 'react';
import { dbService } from '../../../lib/dbService';
import { calculateAge, formatWhatsAppForDisplay } from '../../../lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { UserPlus, Calendar, Phone, MapPin, User, ShieldCheck, X } from 'lucide-react';

interface AddStudentModalProps {
  onClose: () => void;
  onSuccess: (newStudentId?: string) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ onClose, onSuccess }) => {
  const { success, error } = useToast();

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [isScholarship, setIsScholarship] = useState(false);
  const [dueDay, setDueDay] = useState<number | string>('');
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

    if (isMinor && !guardianName.trim() && !guardianPhone.trim()) {
      // Aviso ou validação amigável
    }

    setLoading(true);
    try {
      const parsedDueDay =
        typeof dueDay === 'string'
          ? dueDay ? parseInt(dueDay, 10) : null
          : dueDay;

      const created = await dbService.addStudent({
        fullName: fullName.trim(),
        nickname: nickname.trim() || undefined,
        dateOfBirth,
        address: address.trim(),
        whatsapp: whatsapp.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        registrationType: 'admin_created',
        isScholarship,
        dueDay: parsedDueDay && !isNaN(parsedDueDay) ? parsedDueDay : null,
      });

      success(`Aluno ${created.full_name} cadastrado com sucesso!`);
      onSuccess(created.id);
      onClose();
    } catch (err: any) {
      error(`Erro ao cadastrar aluno: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="add-student-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="add-student-modal"
        className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 text-red-600">
            <UserPlus className="h-5 w-5" />
            <h3 className="font-bold text-gray-900">Novo Aluno (Cadastro Manual)</h3>
          </div>
          <button
            id="add-student-close-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-blue-50/70 p-3.5 text-xs text-blue-900 border border-blue-100">
            <p className="font-semibold">Cadastro Direto sem Necessidade de E-mail</p>
            <p className="mt-0.5 text-blue-800">
              Ideal para crianças ou alunos que não acessam o aplicativo. Nenhum e-mail ou senha fictícia é criada.
            </p>
          </div>

          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="student-fullname-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome completo do aluno"
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
                id="student-nickname-input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Cascavel, Pantera..."
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
                  id="student-dob-input"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                  required
                />
              </div>
              {calculatedAge !== null && (
                <div className="mt-1 flex items-center space-x-1.5">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ${
                      isMinor ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {calculatedAge} {calculatedAge === 1 ? 'ano' : 'anos'} {isMinor ? '(Menor de idade)' : ''}
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
                id="student-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
          </div>

          {/* WhatsApp do Aluno */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              WhatsApp do Aluno (se tiver)
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="student-whatsapp-input"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 98888-8888"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Seção do Responsável (Crianças / Menores) */}
          <div
            className={`rounded-2xl p-4 border transition-all ${
              isMinor
                ? 'bg-amber-50/70 border-amber-200 ring-2 ring-amber-400/20'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-gray-800 mb-3">
              <ShieldCheck className={`h-4 w-4 ${isMinor ? 'text-amber-600' : 'text-gray-500'}`} />
              <span>Dados do Responsável {isMinor ? '(Recomendado para Menores)' : '(Opcional)'}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome do Pai / Mãe ou Responsável <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="student-guardian-name-input"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ex: Maria da Silva"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Telefone / WhatsApp do Responsável
                </label>
                <input
                  id="student-guardian-phone-input"
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>
          </div>

          {/* Opções Financeiras: Bolsista e Vencimento */}
          <div className="rounded-2xl p-4 border border-purple-200 bg-purple-50/50 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-900">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              <span>Condições de Mensalidade</span>
            </div>

            <div className="flex items-center space-x-2.5">
              <input
                id="add-student-is-scholarship"
                type="checkbox"
                checked={isScholarship}
                onChange={(e) => setIsScholarship(e.target.checked)}
                className="h-4 w-4 rounded-sm border-purple-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="add-student-is-scholarship" className="text-xs font-bold text-purple-950 cursor-pointer">
                Aluno Bolsista (Isento de cobrança de mensalidade)
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Dia Base de Vencimento Padrão (1 a 31) <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="add-student-due-day"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ex: 10, 15, 20..."
                className="w-full sm:w-48 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Dia fixo do mês em que as mensalidades recorrentes deverão vencer.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-3 border-t border-gray-100 pt-4">
            <button
              id="add-student-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="add-student-submit-btn"
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-700 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? 'Cadastrando...' : 'Cadastrar Aluno'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
