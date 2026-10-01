import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { supabase } from '../../lib/supabase';
import { formatDate, getWhatsAppLink, normalizeSearch } from '../../lib/utils';
import { EmptyState } from '../common/EmptyState';
import { Search, UserPlus, MessageCircle, ArrowRight, RefreshCw, Users } from 'lucide-react';
import { AddStudentModal } from './modals/AddStudentModal';

export interface StudentCadastral {
  id: string;
  full_name: string;
  nickname?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  whatsapp_normalized?: string | null;
  date_of_birth?: string | null;
  created_at: string;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  role?: string;
  active?: boolean;
}

export function AdminStudents() {
  const { navigate } = useNavigation();
  const [students, setStudents] = useState<StudentCadastral[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const loadStudents = useCallback(async () => {
    try {
      // Carrega exclusivamente dados cadastrais dos alunos, SEM cálculo financeiro
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('full_name');

      if (error) {
        console.error('Erro ao buscar lista de alunos:', error);
        return;
      }

      const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
      const sorted = (data || []).sort((a, b) => collator.compare(a.full_name || '', b.full_name || ''));
      setStudents(sorted);
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    const onFocus = () => loadStudents();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStudents]);

  // Filtragem por termo de busca (nome, apelido, e-mail, WhatsApp)
  const displayedStudents = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return students;

    return students.filter((student) => {
      const fullName = normalizeSearch(student.full_name);
      const nickname = normalizeSearch(student.nickname);
      const email = normalizeSearch(student.email);
      const guardian = normalizeSearch(student.guardian_name);
      const whatsapp = normalizeSearch(student.whatsapp);
      const cleanPhone = normalizeSearch(student.whatsapp_normalized);

      return (
        fullName.includes(term) ||
        nickname.includes(term) ||
        email.includes(term) ||
        guardian.includes(term) ||
        whatsapp.includes(term) ||
        cleanPhone.includes(term)
      );
    });
  }, [students, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Gestão Cadastral
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100 flex items-center gap-2.5">
            <span>Alunos Cadastrados</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold">
              {students.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Cadastros gerais e dados de contato dos alunos
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-students-list"
            onClick={() => {
              setRefreshing(true);
              loadStudents();
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16181b] hover:bg-[#202328] border border-[#2b2e35] text-xs font-semibold rounded-xl text-neutral-300 hover:text-white transition w-fit cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            id="btn-open-add-student-modal"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Aluno</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="input-search-students"
          type="text"
          placeholder="Buscar por nome, apelido, e-mail ou WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141619] border border-[#27292f] rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-400/50 transition shadow-inner"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-300 transition"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Listagem de Alunos */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-[#141619] border border-[#25282f] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : displayedStudents.length === 0 ? (
        <EmptyState
          title="Nenhum aluno encontrado"
          description={
            search
              ? 'Tente outro termo de busca para localizar o aluno cadastrado.'
              : 'Clique em "Novo Aluno" para cadastrar o primeiro aluno.'
          }
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {displayedStudents.map((student) => {
            const initials = student.nickname
              ? student.nickname.substring(0, 2).toUpperCase()
              : (student.full_name ? student.full_name.substring(0, 2).toUpperCase() : 'AL');

            return (
              <div
                key={student.id}
                id={`student-row-${student.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-[#141619] border border-[#25282f] hover:border-neutral-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                {/* Informações do Aluno */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1e2025] text-amber-400 border border-[#2a2c32] font-black text-base flex items-center justify-center shrink-0">
                    {initials}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-neutral-100">{student.full_name}</h3>
                      {student.nickname && (
                        <span className="text-xs font-semibold text-amber-400">
                          ({student.nickname})
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
                            href={getWhatsAppLink(
                              student.whatsapp,
                              `Olá, ${student.nickname || student.full_name}! Aqui é da Capoeira Nossa Nação.`
                            )}
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

                      {student.created_at && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-neutral-500">
                            Cadastro: {formatDate(student.created_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ação: Botão Gerenciar Aluno */}
                <div className="flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800 shrink-0">
                  <button
                    id={`btn-manage-student-${student.id}`}
                    onClick={() => navigate(`/admin/alunos/${student.id}`)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
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
