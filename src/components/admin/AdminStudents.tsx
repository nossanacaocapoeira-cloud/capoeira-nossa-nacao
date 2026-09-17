import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, StudentWithBalance } from '../../lib/dbService';
import { formatCurrency, formatDate, getWhatsAppLink, calculateAge } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { Search, UserPlus, MessageCircle, ArrowRight, RefreshCw, Users, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { AddStudentModal } from './modals/AddStudentModal';

export function AdminStudents() {
  const { navigate, getParam } = useNavigation();
  const [students, setStudents] = useState<StudentWithBalance[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'up_to_date' | 'no_fee' | 'inactive'>(() => {
    const urlFilter = getParam('filter');
    if (urlFilter === 'pending') return 'pending';
    if (urlFilter === 'up_to_date') return 'up_to_date';
    if (urlFilter === 'no_fee') return 'no_fee';
    if (urlFilter === 'inactive') return 'inactive';
    return 'all';
  });

  // Sync with URL parameter
  useEffect(() => {
    const urlFilter = getParam('filter');
    if (urlFilter === 'pending') setStatusFilter('pending');
    else if (urlFilter === 'up_to_date') setStatusFilter('up_to_date');
    else if (urlFilter === 'no_fee') setStatusFilter('no_fee');
    else if (urlFilter === 'inactive') setStatusFilter('inactive');
    else if (urlFilter === 'all') setStatusFilter('all');
  }, [getParam]);

  const loadStudents = useCallback(async () => {
    try {
      const data = await dbService.getAllStudents(search);
      setStudents(data);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Counts for tabs
  const counts = useMemo(() => {
    let all = 0;
    let pending = 0;
    let up_to_date = 0;
    let no_fee = 0;
    let inactive = 0;

    students.forEach((s) => {
      if (s.financialStatus === 'INATIVO' || !s.active) {
        inactive++;
      } else {
        all++;
        if (s.financialStatus === 'PENDENTE' || s.financialStatus === 'EM ATRASO' || s.totalOpen > 0) {
          pending++;
        } else if (s.financialStatus === 'EM DIA') {
          up_to_date++;
        } else if (s.financialStatus === 'SEM MENSALIDADE') {
          no_fee++;
        }
      }
    });

    return { all, pending, up_to_date, no_fee, inactive };
  }, [students]);

  // Filtered by status
  const displayedStudents = useMemo(() => {
    return students.filter((student) => {
      if (statusFilter === 'pending') {
        return (
          student.financialStatus === 'PENDENTE' ||
          student.financialStatus === 'EM ATRASO' ||
          student.totalOpen > 0
        );
      }
      if (statusFilter === 'up_to_date') {
        return student.financialStatus === 'EM DIA' && student.totalOpen === 0;
      }
      if (statusFilter === 'no_fee') {
        return student.financialStatus === 'SEM MENSALIDADE';
      }
      if (statusFilter === 'inactive') {
        return student.financialStatus === 'INATIVO' || !student.active;
      }
      // 'all': todos os ativos
      return student.financialStatus !== 'INATIVO' && student.active !== false;
    });
  }, [students, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Gestão de Alunos
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            Alunos Cadastrados
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Gerencie matrículas, cobranças e cadastro direto de novos alunos e crianças
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-students-list"
            onClick={() => {
              setRefreshing(true);
              loadStudents();
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16181b] hover:bg-[#202328] border border-[#2b2e35] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            id="btn-add-student-manual"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Aluno</span>
          </button>
        </div>
      </div>

      {/* Search Input & Filter Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <input
            id="input-search-student"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, apelido, responsável, WhatsApp ou e-mail..."
            className="w-full px-4 py-3 pl-10 bg-[#141619] border border-[#27292f] rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 outline-none transition"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            id="tab-filter-students-all"
            onClick={() => {
              setStatusFilter('all');
              navigate('/admin/alunos?filter=all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'bg-[#141619] text-neutral-400 hover:text-white border border-[#27292f]'
            }`}
          >
            <span>Todos</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'all' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>
              {counts.all}
            </span>
          </button>

          <button
            id="tab-filter-students-pending"
            onClick={() => {
              setStatusFilter('pending');
              navigate('/admin/alunos?filter=pending');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'bg-[#141619] text-neutral-400 hover:text-amber-400 border border-[#27292f]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Com Pendências</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'pending' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-amber-500/20 text-amber-400'}`}>
              {counts.pending}
            </span>
          </button>

          <button
            id="tab-filter-students-uptodate"
            onClick={() => {
              setStatusFilter('up_to_date');
              navigate('/admin/alunos?filter=up_to_date');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'up_to_date'
                ? 'bg-emerald-500 text-neutral-950 shadow-md'
                : 'bg-[#141619] text-neutral-400 hover:text-emerald-400 border border-[#27292f]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Em Dia</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'up_to_date' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {counts.up_to_date}
            </span>
          </button>

          <button
            id="tab-filter-students-nofee"
            onClick={() => {
              setStatusFilter('no_fee');
              navigate('/admin/alunos?filter=no_fee');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'no_fee'
                ? 'bg-neutral-300 text-neutral-950 shadow-md'
                : 'bg-[#141619] text-neutral-400 hover:text-neutral-200 border border-[#27292f]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Sem Mensalidade</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${statusFilter === 'no_fee' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>
              {counts.no_fee}
            </span>
          </button>

          {counts.inactive > 0 && (
            <button
              id="tab-filter-students-inactive"
              onClick={() => {
                setStatusFilter('inactive');
                navigate('/admin/alunos?filter=inactive');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'inactive'
                  ? 'bg-neutral-700 text-white shadow-md'
                  : 'bg-[#141619] text-neutral-400 hover:text-neutral-200 border border-[#27292f]'
              }`}
            >
              <span>Inativos</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-neutral-800 text-neutral-400">
                {counts.inactive}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[#141619] border border-[#25282f] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayedStudents.length === 0 ? (
        <EmptyState
          title={
            statusFilter === 'pending'
              ? 'Nenhum aluno com pendência'
              : statusFilter === 'up_to_date'
              ? 'Nenhum aluno em dia com histórico'
              : statusFilter === 'no_fee'
              ? 'Nenhum aluno sem mensalidade'
              : 'Nenhum aluno encontrado'
          }
          description={
            search
              ? 'Tente outro termo de busca para localizar o aluno desejado.'
              : statusFilter === 'pending'
              ? 'Excelente! Nenhum aluno cadastrado possui mensalidades ou débitos em aberto.'
              : 'Clique em "Novo Aluno" para cadastrar um aluno ou ajuste os filtros acima.'
          }
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {displayedStudents.map((student) => {
            const hasPending = student.financialStatus === 'PENDENTE' || student.financialStatus === 'EM ATRASO' || student.totalOpen > 0;
            const isInactive = student.financialStatus === 'INATIVO' || !student.active;
            const age = student.date_of_birth ? calculateAge(student.date_of_birth) : null;
            const isMinor = age !== null && age < 18;

            return (
              <div
                key={student.id}
                id={`student-row-${student.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-neutral-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                {/* Left: Info */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1e2025] text-amber-400 border border-[#2a2c32] font-black text-base flex items-center justify-center flex-shrink-0">
                    {student.nickname ? student.nickname.substring(0, 2).toUpperCase() : 'AL'}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-neutral-100">{student.full_name}</h3>
                      {student.nickname && (
                        <span className="text-xs font-semibold text-amber-400">
                          ({student.nickname})
                        </span>
                      )}
                      {isMinor && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {age} {age === 1 ? 'ano' : 'anos'}
                        </span>
                      )}
                      {student.registration_type === 'admin_created' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                          Manual
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                      {student.email ? (
                        <span>{student.email}</span>
                      ) : (
                        <span className="text-neutral-500 italic">Sem e-mail</span>
                      )}

                      {student.whatsapp && (
                        <>
                          <span>•</span>
                          <a
                            href={getWhatsAppLink(student.whatsapp, `Olá, ${student.nickname || student.full_name}! Aqui é da Capoeira Nossa Nação.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {student.whatsapp}
                          </a>
                        </>
                      )}

                      {/* Se houver responsável */}
                      {student.guardian_name && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-amber-200/90">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            Resp: <strong className="text-neutral-200">{student.guardian_name}</strong>
                            {student.guardian_phone && (
                              <a
                                href={getWhatsAppLink(student.guardian_phone, `Olá, responsável por ${student.full_name}! Aqui é da Capoeira Nossa Nação.`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:underline ml-1 font-mono"
                                onClick={(e) => e.stopPropagation()}
                              >
                                ({student.guardian_phone})
                              </a>
                            )}
                          </span>
                        </>
                      )}

                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline text-neutral-500">
                        Cadastro: {formatDate(student.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Financial Status & Action */}
                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                  <div className="text-left sm:text-right">
                    <div>
                      {isInactive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-400">
                          Inativo
                        </span>
                      ) : student.financialStatus === 'EM ATRASO' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-950/80 border border-rose-500/40 text-rose-300">
                          Em Atraso
                        </span>
                      ) : student.financialStatus === 'PENDENTE' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-950/80 border border-amber-500/40 text-amber-300">
                          Pendente
                        </span>
                      ) : student.financialStatus === 'EM DIA' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          Em Dia
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-800/80 border border-neutral-700 text-neutral-300">
                          Sem Mensalidade
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-bold font-mono mt-0.5 block ${hasPending ? (student.financialStatus === 'EM ATRASO' ? 'text-rose-400' : 'text-amber-400') : 'text-neutral-400'}`}>
                      {hasPending ? formatCurrency(student.totalOpen) : (student.financialStatus === 'SEM MENSALIDADE' ? '-' : 'R$ 0,00')}
                    </span>
                  </div>

                  <button
                    id={`btn-manage-student-${student.id}`}
                    onClick={() => navigate(`/admin/alunos/${student.id}`)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>Gerenciar Aluno</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newId) => {
            loadStudents();
            if (newId) {
              navigate(`/admin/alunos/${newId}`);
            }
          }}
        />
      )}
    </div>
  );
}
