import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, BirthdayStudent, BirthdaysResult } from '../../lib/dbService';
import {
  PT_MONTHS,
  getSaoPauloDate,
  formatBirthdayDisplay,
  getWhatsAppLink,
  maskPhone,
  formatDate,
} from '../../lib/utils';
import {
  Cake,
  Gift,
  Calendar,
  Search,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export function AdminBirthdays() {
  const { navigate } = useNavigation();
  const spNow = useMemo(() => getSaoPauloDate(), []);

  const [selectedMonth, setSelectedMonth] = useState<number>(() => spNow.month);
  const [data, setData] = useState<BirthdaysResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadBirthdays = useCallback(async (month: number) => {
    setError(null);
    try {
      const res = await dbService.getStudentsBirthdays(month);
      setData(res);
    } catch (err) {
      console.error('Erro ao carregar aniversariantes:', err);
      setError('Não foi possível carregar os aniversariantes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadBirthdays(selectedMonth);
  }, [selectedMonth, loadBirthdays]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBirthdays(selectedMonth);
  };

  const handleOpenWhatsApp = (student: BirthdayStudent) => {
    const studentName = student.nickname || student.full_name;
    const greeting = `Olá! A Capoeira Nossa Nação deseja um feliz aniversário ao ${studentName}! 🥳`;
    const targetPhone = student.contactPhone;

    if (!targetPhone) {
      alert('Nenhum telefone/WhatsApp cadastrado para este aluno ou responsável.');
      return;
    }

    const url = getWhatsAppLink(targetPhone, greeting);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filter students based on search term
  const filterList = useCallback(
    (list: BirthdayStudent[]) => {
      if (!searchTerm.trim()) return list;
      const term = searchTerm.toLowerCase().trim();
      return list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(term) ||
          (s.nickname || '').toLowerCase().includes(term) ||
          (s.guardian_name || '').toLowerCase().includes(term) ||
          (s.whatsapp || '').includes(term) ||
          (s.guardian_phone || '').includes(term)
      );
    },
    [searchTerm]
  );

  const filteredToday = useMemo(() => filterList(data?.today || []), [data?.today, filterList]);
  const filteredUpcoming = useMemo(() => filterList(data?.upcoming || []), [data?.upcoming, filterList]);
  const filteredPast = useMemo(() => filterList(data?.past || []), [data?.past, filterList]);
  const filteredAll = useMemo(() => filterList(data?.allForMonth || []), [data?.allForMonth, filterList]);

  const isCurrentSelectedMonth = selectedMonth === spNow.month;
  const currentMonthName = PT_MONTHS[selectedMonth - 1];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
              Gestão da Academia
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Admin
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100 flex items-center gap-3 mt-1">
            <Cake className="w-7 h-7 text-amber-400" />
            Aniversariantes de {currentMonthName}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Datas comemorativas, cálculo automático de idade e contato direto via WhatsApp • Capoeira Nossa Nação
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-birthdays"
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16181b] hover:bg-[#202328] border border-[#2b2e35] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Month Selector Bar */}
      <div className="p-3 bg-[#141619] border border-[#25282f] rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center justify-between px-2 text-xs font-semibold text-neutral-400">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-400">
            <Calendar className="w-3.5 h-3.5" />
            Selecione o Mês
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            {data ? `${data.totalInMonth} ${data.totalInMonth === 1 ? 'aluno' : 'alunos'} neste mês` : ''}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {PT_MONTHS.map((name, index) => {
            const monthNumber = index + 1;
            const isSelected = selectedMonth === monthNumber;
            const isCurrentCalendarMonth = spNow.month === monthNumber;

            return (
              <button
                key={name}
                id={`btn-select-month-${monthNumber}`}
                onClick={() => setSelectedMonth(monthNumber)}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium transition flex flex-col items-center justify-center relative ${
                  isSelected
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-[#181a1e] text-neutral-300 hover:bg-[#21242a] hover:text-white border border-[#262930]'
                }`}
              >
                <span>{name.slice(0, 3)}</span>
                {isCurrentCalendarMonth && (
                  <span
                    className={`text-[8px] font-mono uppercase tracking-tighter mt-0.5 ${
                      isSelected ? 'text-neutral-950 font-black' : 'text-amber-400 font-bold'
                    }`}
                  >
                    Atual
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input and Summary Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <input
            id="input-search-birthday"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar aluno por nome, apelido ou responsável..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#141619] border border-[#25282f] focus:border-amber-500 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none transition"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 text-xs font-mono">
          <span className="text-neutral-400">
            Total em {currentMonthName}:{' '}
            <strong className="text-neutral-100 font-bold text-sm">
              {loading ? '-' : data?.totalInMonth ?? 0}
            </strong>{' '}
            {data?.totalInMonth === 1 ? 'aluno' : 'alunos'}
          </span>
        </div>
      </div>

      {/* Content Canvas */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 bg-[#141619] rounded-2xl animate-pulse border border-[#25282f]" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-[#141619] rounded-2xl animate-pulse border border-[#25282f]" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h4 className="text-sm font-bold text-rose-200">{error}</h4>
          <p className="text-xs text-neutral-400">Verifique a conexão e tente novamente.</p>
          <button
            onClick={() => loadBirthdays(selectedMonth)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
          >
            Tentar Novamente
          </button>
        </div>
      ) : filteredAll.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#141619] border border-[#25282f] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <Gift className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-neutral-100">
            {searchTerm
              ? `Nenhum resultado encontrado para "${searchTerm}" em ${currentMonthName}`
              : `Nenhum aniversariante encontrado em ${currentMonthName}`}
          </h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            {searchTerm
              ? 'Tente pesquisar com outro termo ou selecione outro mês acima.'
              : 'Não há alunos ativos com data de nascimento registrada neste mês.'}
          </p>
        </div>
      ) : isCurrentSelectedMonth ? (
        // CURRENT MONTH VIEW (Sections: Today, Upcoming, Past)
        <div className="space-y-8">
          {/* 1. ANIVERSARIANTES DE HOJE */}
          {filteredToday.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Aniversariantes de Hoje!
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredToday.map((student) => (
                  <BirthdayCard
                    key={student.id}
                    student={student}
                    selectedMonth={selectedMonth}
                    isTodayHighlight={true}
                    onOpenWhatsApp={() => handleOpenWhatsApp(student)}
                    onViewProfile={() => navigate(`/admin/alunos/${student.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. PRÓXIMOS ANIVERSÁRIOS */}
          {filteredUpcoming.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Próximos Aniversários
                </h3>
                <span className="text-xs font-mono text-neutral-400">
                  {filteredUpcoming.length} {filteredUpcoming.length === 1 ? 'aluno' : 'alunos'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUpcoming.map((student) => (
                  <BirthdayCard
                    key={student.id}
                    student={student}
                    selectedMonth={selectedMonth}
                    onOpenWhatsApp={() => handleOpenWhatsApp(student)}
                    onViewProfile={() => navigate(`/admin/alunos/${student.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 3. ANIVERSÁRIOS QUE JÁ PASSARAM */}
          {filteredPast.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#22242b]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  Aniversários Que Já Passaram no Mês
                </h3>
                <span className="text-xs font-mono text-neutral-500">
                  {filteredPast.length} {filteredPast.length === 1 ? 'aluno' : 'alunos'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-85 hover:opacity-100 transition">
                {filteredPast.map((student) => (
                  <BirthdayCard
                    key={student.id}
                    student={student}
                    selectedMonth={selectedMonth}
                    isPastMode={true}
                    onOpenWhatsApp={() => handleOpenWhatsApp(student)}
                    onViewProfile={() => navigate(`/admin/alunos/${student.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // OTHER MONTH VIEW (Ordered by day 1 to 31)
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Todos os Aniversariantes de {currentMonthName}
            </h3>
            <span className="text-xs font-mono text-neutral-400">
              Ordenados pelo dia do aniversário
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAll.map((student) => (
              <BirthdayCard
                key={student.id}
                student={student}
                selectedMonth={selectedMonth}
                onOpenWhatsApp={() => handleOpenWhatsApp(student)}
                onViewProfile={() => navigate(`/admin/alunos/${student.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Birthday Card
// -------------------------------------------------------------
interface BirthdayCardProps {
  key?: React.Key;
  student: BirthdayStudent;
  selectedMonth: number;
  isTodayHighlight?: boolean;
  isPastMode?: boolean;
  onOpenWhatsApp: () => void;
  onViewProfile: () => void;
}

export const BirthdayCard: React.FC<BirthdayCardProps> = ({
  student,
  selectedMonth,
  isTodayHighlight = false,
  isPastMode = false,
  onOpenWhatsApp,
  onViewProfile,
}) => {
  const birthdayDayLabel = formatBirthdayDisplay(student.birthDay, selectedMonth);

  return (
    <div
      id={`birthday-card-${student.id}`}
      className={`p-5 rounded-2xl flex flex-col justify-between transition group relative ${
        isTodayHighlight
          ? 'bg-gradient-to-br from-[#1c1d22] to-[#16181d] border-2 border-emerald-500/60 shadow-xl shadow-emerald-500/10'
          : isPastMode
          ? 'bg-[#131518] border border-[#22242a] hover:border-neutral-700'
          : 'bg-[#141619] border border-[#25282f] hover:border-amber-500/40 shadow-sm'
      }`}
    >
      {/* Top Row: Date Badge & Age */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-mono font-black text-sm ${
              isTodayHighlight
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            {student.birthDay < 10 ? `0${student.birthDay}` : student.birthDay}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-200 capitalize">
                {birthdayDayLabel}
              </span>
              {isTodayHighlight && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-neutral-950 animate-pulse">
                  Hoje!
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
              {student.countdownLabel}
            </p>
          </div>
        </div>

        {/* Turning age badge */}
        {student.turningAge !== null && (
          <div className="text-right">
            <span
              className={`inline-block px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                isTodayHighlight
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#1f2228] text-amber-300 border border-[#2f333c]'
              }`}
            >
              Completa {student.turningAge} {student.turningAge === 1 ? 'ano' : 'anos'}
            </span>
          </div>
        )}
      </div>

      {/* Center: Student Identity */}
      <div className="mt-4 mb-4 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-base font-bold text-neutral-100 group-hover:text-amber-400 transition">
            {student.full_name}
          </h4>
          {student.nickname && (
            <span className="px-2 py-0.5 rounded-md bg-[#202329] border border-[#2c3038] text-[11px] font-mono font-bold text-amber-400">
              {student.nickname}
            </span>
          )}
        </div>

        <p className="text-[11px] text-neutral-500 font-mono">
          Nascido em: {formatDate(student.date_of_birth)}
        </p>

        {/* Guardian Info (if minor/has guardian) */}
        {student.hasGuardian ? (
          <div className="mt-3 p-2.5 rounded-xl bg-[#191b1f] border border-[#24272f] space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Responsável:</span>
              <span className="font-semibold text-neutral-200">
                {student.guardian_name}
              </span>
            </div>
            {student.guardian_phone && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Telefone:</span>
                <span className="font-mono text-neutral-300">
                  {maskPhone(student.guardian_phone)}
                </span>
              </div>
            )}
          </div>
        ) : student.whatsapp ? (
          <div className="mt-3 text-[11px] text-neutral-400 flex items-center gap-1.5">
            <span>WhatsApp:</span>
            <span className="font-mono text-neutral-300">
              {maskPhone(student.whatsapp)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Bottom Actions: WhatsApp & Manage Profile */}
      <div className="pt-3 border-t border-[#22242a] flex items-center gap-2">
        <button
          id={`btn-whatsapp-${student.id}`}
          onClick={onOpenWhatsApp}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
            isTodayHighlight
              ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black'
              : 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
          }`}
          title="Abrir WhatsApp com mensagem comemorativa pré-preenchida"
        >
          <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{student.isContactGuardian ? 'Falar com Responsável' : 'Enviar Mensagem'}</span>
        </button>

        <button
          id={`btn-view-profile-${student.id}`}
          onClick={onViewProfile}
          className="p-2.5 rounded-xl bg-[#1a1c21] hover:bg-[#23272e] text-neutral-300 hover:text-white border border-[#2a2d36] transition flex-shrink-0"
          title="Ver Ficha do Aluno"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
