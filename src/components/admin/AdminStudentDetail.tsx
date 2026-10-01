import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { dbService, StudentFinancialSummary } from '../../lib/dbService';
import { Profile, Student, MonthlyFee, ProductDebt, Payment, FinancialMovement, InternalNote } from '../../types/database';
import { formatCurrency, formatDate, formatDateTime, getWhatsAppLink, isOverdue, calculateAge, formatReferenceDisplay, filterAdministrativeMovements } from '../../lib/utils';
import { AddFeeModal } from './modals/AddFeeModal';
import { EditFeeModal } from './modals/EditFeeModal';
import { AddProductDebtModal } from './modals/AddProductDebtModal';
import { RecordPaymentModal } from './modals/RecordPaymentModal';
import { AdjustmentModal } from './modals/AdjustmentModal';
import { RevertPaymentModal } from './modals/RevertPaymentModal';
import { CancelMonthlyFeeModal } from './modals/CancelMonthlyFeeModal';
import { CancelProductDebtModal } from './modals/CancelProductDebtModal';
import { EditStudentModal } from './modals/EditStudentModal';
import { EmptyState } from '../common/EmptyState';
import {
  ArrowLeft,
  Calendar,
  ShoppingBag,
  CreditCard,
  History,
  FileText,
  MessageCircle,
  Plus,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Edit2,
  RotateCcw,
  Ban,
  ShieldCheck,
  User,
  Eye,
  Trash2,
} from 'lucide-react';

interface AdminStudentDetailProps {
  studentId: string;
}

export function AdminStudentDetail({ studentId }: AdminStudentDetailProps) {
  const { navigate, setPreviewStudent } = useNavigation();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [student, setStudent] = useState<(Student & Profile) | null>(null);
  const [summary, setSummary] = useState<StudentFinancialSummary | null>(null);
  const [fees, setFees] = useState<{ open: MonthlyFee[]; paid: MonthlyFee[] }>({ open: [], paid: [] });
  const [debts, setDebts] = useState<{ open: ProductDebt[]; paid: ProductDebt[] }>({ open: [], paid: [] });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<FinancialMovement[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Active tab in student profile
  const [activeTab, setActiveTab] = useState<'fees' | 'products' | 'payments' | 'history' | 'notes'>('fees');

  // New internal note state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Modals state
  const [showAddFee, setShowAddFee] = useState(false);
  const [editFeeItem, setEditFeeItem] = useState<MonthlyFee | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [revertPaymentItem, setRevertPaymentItem] = useState<Payment | null>(null);
  const [deletePaymentItem, setDeletePaymentItem] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [cancelFeeItem, setCancelFeeItem] = useState<MonthlyFee | null>(null);
  const [cancelDebtItem, setCancelDebtItem] = useState<ProductDebt | null>(null);

  const studentAge = useMemo(() => {
    if (!student?.date_of_birth) return null;
    return calculateAge(student.date_of_birth);
  }, [student?.date_of_birth]);

  const isMinor = studentAge !== null && studentAge < 18;
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    paymentType: 'monthly_fee' | 'product';
    itemTitle: string;
    monthlyFeeId?: string | null;
    productDebtId?: string | null;
    openBalance: number;
  }>({
    isOpen: false,
    paymentType: 'monthly_fee',
    itemTitle: '',
    openBalance: 0,
  });

  const [adjustmentModalData, setAdjustmentModalData] = useState<{
    isOpen: boolean;
    itemType: 'monthly_fee' | 'product_debt';
    itemId: string;
    itemTitle: string;
    currentAmount: number;
    amountPaid: number;
  }>({
    isOpen: false,
    itemType: 'monthly_fee',
    itemId: '',
    itemTitle: '',
    currentAmount: 0,
    amountPaid: 0,
  });

  const loadAllStudentData = useCallback(async () => {
    try {
      setLoading(true);
      const profileData = await dbService.getStudentById(studentId);
      const canonicalId = profileData?.id || studentId;

      const [summaryData, feesData, debtsData, paymentsData, historyData, notesData] =
        await Promise.all([
          dbService.getStudentSummary(canonicalId),
          dbService.getStudentMonthlyFees(canonicalId),
          dbService.getStudentProductDebts(canonicalId),
          dbService.getStudentPayments(canonicalId),
          dbService.getStudentHistory(canonicalId),
          dbService.getInternalNotes(canonicalId),
        ]);

      setStudent(profileData);
      setSummary(summaryData);
      setFees(feesData || { open: [], paid: [] });
      setDebts(debtsData || { open: [], paid: [] });
      setPayments(paymentsData || []);
      setHistory(historyData || []);
      setNotes(notesData || []);
    } catch (err) {
      console.error('Erro ao carregar dados detalhados do aluno:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadAllStudentData();

    const onFinancialUpdated = (e: any) => {
      const detail = e?.detail;
      const canonicalId = student?.id || studentId;
      if (!detail?.studentId || detail.studentId === canonicalId || detail.studentId === studentId) {
        loadAllStudentData();
      }
    };

    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    return () => {
      window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
    };
  }, [loadAllStudentData, studentId, student?.id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setSavingNote(true);
    try {
      const canonicalId = student?.id || studentId;
      await dbService.addInternalNote({
        studentId: canonicalId,
        note: newNoteContent.trim(),
        authorId: user?.id,
        authorEmail: user?.email || undefined,
      });
      setNewNoteContent('');
      success('Observação interna adicionada com sucesso!');
      const updatedNotes = await dbService.getInternalNotes(canonicalId);
      setNotes(updatedNotes || []);
    } catch (err: any) {
      error(`Erro ao adicionar observação: ${err?.message || 'Tente novamente'}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentItem) return;
    setDeletingPayment(true);
    try {
      const res = await dbService.deletePayment(deletePaymentItem.id);
      success(res.message || 'Pagamento excluído com sucesso!');
      setDeletePaymentItem(null);
      await loadAllStudentData();
    } catch (err: any) {
      error(err?.message || 'Não foi possível excluir o pagamento.');
    } finally {
      setDeletingPayment(false);
    }
  };

  const studentDisplayName = student?.nickname || student?.full_name || 'Aluno';

  const openFees = fees?.open || [];
  const paidFees = fees?.paid || [];
  const openDebts = debts?.open || [];
  const paidDebts = debts?.paid || [];
  const paymentsList = payments || [];
  const historyList = useMemo(() => {
    return filterAdministrativeMovements(history || []);
  }, [history]);
  const notesList = notes || [];

  if (loading && !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-neutral-400">Carregando dados do aluno...</p>
      </div>
    );
  }

  if (!loading && !student) {
    return (
      <div className="p-8 rounded-2xl bg-[#141619] border border-[#25282f] text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-neutral-100">Aluno não encontrado</h3>
        <p className="text-xs text-neutral-400">
          Não foi possível localizar as informações cadastrais para este aluno.
        </p>
        <button
          onClick={() => navigate('/admin/alunos')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-neutral-950 text-xs font-bold rounded-xl shadow hover:bg-amber-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Alunos</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Back */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-to-students"
          onClick={() => navigate('/admin/alunos')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white bg-[#141619] hover:bg-[#1c1f24] px-3 py-2 rounded-xl border border-[#262930] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Lista de Alunos</span>
        </button>

        <button
          onClick={loadAllStudentData}
          className="p-2 text-neutral-400 hover:text-white bg-[#141619] border border-[#262930] rounded-xl transition"
          title="Atualizar dados"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Student Personal Info Card */}
      <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] space-y-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500 text-neutral-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
              {student?.nickname ? student.nickname.substring(0, 2).toUpperCase() : 'AL'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-neutral-100">{student?.full_name}</h2>
                {student?.nickname && (
                  <span className="text-amber-400 text-base font-bold">({student.nickname})</span>
                )}
                {isMinor && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {studentAge} {studentAge === 1 ? 'ano' : 'anos'} (Menor)
                  </span>
                )}
                {student?.registration_type === 'admin_created' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Cadastro Manual
                  </span>
                )}
                {summary?.financialStatus === 'SCHOLARSHIP' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    Bolsista (Isento)
                  </span>
                )}
                {summary?.financialStatus === 'NO_MONTHLY_FEE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Sem mensalidade cadastrada
                  </span>
                )}
                {summary?.financialStatus === 'UP_TO_DATE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Mensalidades em dia
                  </span>
                )}
                {summary?.financialStatus === 'OVERDUE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    Em atraso ({summary.overdueCount})
                  </span>
                )}
                {summary?.financialStatus === 'PENDING' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    A vencer
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Matrícula desde {formatDate(student?.created_at)} •{' '}
                <span className={student?.active ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                  {student?.active ? 'Ativo' : 'Inativo'}
                </span>
                {student?.due_day && (
                  <span className="text-neutral-400 ml-2">
                    • Vencimento base: <strong>Dia {student.due_day}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-preview-student-mode"
              onClick={() => {
                if (student) {
                  setPreviewStudent({
                    id: student.id,
                    name: student.nickname || student.full_name,
                  });
                  navigate('/app');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
              title="Visualizar a tela como este aluno veria no app"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver como Aluno</span>
            </button>

            <button
              id="btn-edit-student"
              onClick={() => setShowEditStudent(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1f24] hover:bg-[#252a32] text-neutral-200 border border-[#2b2f37] text-xs font-semibold transition"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Editar Dados</span>
            </button>

            {student?.whatsapp && (
              <a
                id="btn-student-whatsapp-direct"
                href={getWhatsAppLink(student.whatsapp, `Olá, ${studentDisplayName}! Mensagem da Capoeira Nossa Nação:`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a1d22] hover:bg-emerald-950/40 text-emerald-400 border border-[#2c3038] hover:border-emerald-500/40 text-xs font-semibold transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Aluno</span>
              </a>
            )}

            <button
              id="btn-open-add-fee"
              onClick={() => setShowAddFee(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Mensalidade</span>
            </button>

            <button
              id="btn-open-add-product"
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#202329] hover:bg-[#2b2f37] text-neutral-200 border border-[#30343d] text-xs font-bold transition"
            >
              <Plus className="w-4 h-4" />
              <span>Produto</span>
            </button>
          </div>
        </div>

        {/* Informações do Responsável (se houver ou se for menor) */}
        {student?.guardian_name && (
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <span className="text-neutral-400">Responsável pelo Aluno: </span>
                <strong className="text-amber-200 font-bold">{student.guardian_name}</strong>
                {student.guardian_phone && (
                  <span className="text-neutral-400 ml-2 font-mono">({student.guardian_phone})</span>
                )}
              </div>
            </div>

            {student.guardian_phone && (
              <a
                id="btn-guardian-whatsapp-direct"
                href={getWhatsAppLink(
                  student.guardian_phone,
                  `Olá, responsável por ${student.full_name}! Mensagem da Capoeira Nossa Nação:`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-semibold rounded-lg text-xs transition w-fit"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Responsável</span>
              </a>
            )}
          </div>
        )}

        {/* Contact details mini-grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-4 border-t border-neutral-800/80">
          <div className="flex items-center gap-2 text-neutral-400">
            <Mail className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">{student?.email || 'Sem e-mail'}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <Phone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>{student?.whatsapp || 'Sem WhatsApp'}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              Nasc: {formatDate(student?.date_of_birth)}{' '}
              {studentAge !== null && `(${studentAge} ${studentAge === 1 ? 'ano' : 'anos'})`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">{student?.address || 'Sem endereço'}</span>
          </div>
        </div>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            Total em Aberto
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {formatCurrency(summary?.totalOpen ?? 0)}
          </div>
          <p className="text-[11px] text-neutral-500">Saldo devedor acumulado</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            Mensalidades Abertas
          </span>
          <div className="text-xl sm:text-2xl font-black text-neutral-100 font-mono">
            {summary?.openFeesCount ?? 0}
          </div>
          <p className="text-[11px] text-neutral-500">
            {summary?.overdueCount ? `${summary.overdueCount} vencida(s)` : 'Nenhuma vencida'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            Produtos em Débito
          </span>
          <div className="text-xl sm:text-2xl font-black text-neutral-100 font-mono">
            {summary?.openDebtsCount ?? 0}
          </div>
          <p className="text-[11px] text-neutral-500">Materiais não quitados</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            Último Pagamento
          </span>
          <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
            {summary?.lastPaymentDate ? formatDate(summary.lastPaymentDate) : 'Nenhum'}
          </div>
          <p className="text-[11px] text-neutral-500">
            {summary?.lastPaymentAmount ? formatCurrency(summary.lastPaymentAmount) : '-'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#25282f] space-x-1 sm:space-x-4 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('fees')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
            activeTab === 'fees'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Mensalidades ({openFees.length + paidFees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
            activeTab === 'products'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Produtos ({openDebts.length + paidDebts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
            activeTab === 'payments'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Pagamentos ({paymentsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
            activeTab === 'history'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Histórico Auditável</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition ${
            activeTab === 'notes'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Observações Internas ({notesList.length})</span>
        </button>
      </div>

      {/* Tab 1: Mensalidades */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          {/* Em Aberto */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>Mensalidades em Aberto</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                {openFees.length}
              </span>
            </h3>

            {openFees.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] text-center text-xs text-neutral-400">
                Nenhuma mensalidade em aberto para este aluno.
              </div>
            ) : (
              openFees.map((fee) => {
                const isScholarshipFee = Boolean(
                  fee.is_scholarship ||
                  fee.status === 'scholarship' ||
                  (fee.notes && fee.notes.includes('[BOLSISTA]'))
                );
                const overdue = !isScholarshipFee && isOverdue(fee.due_date, fee.remaining_amount);
                return (
                  <div
                    key={fee.id}
                    className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-neutral-100 uppercase">
                          {formatReferenceDisplay(fee.reference_month)}
                        </h4>
                        {isScholarshipFee ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-purple-400" />
                            Bolsista (Isento)
                          </span>
                        ) : overdue ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-500/40">
                            Vencida ({formatDate(fee.due_date)})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-500/40">
                            Vence em {formatDate(fee.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                        <span>Total: {formatCurrency(fee.amount)}</span>
                        <span>Pago: {formatCurrency(fee.amount_paid)}</span>
                        <span className="text-amber-400 font-bold">
                          Saldo: {formatCurrency(fee.remaining_amount)}
                        </span>
                      </div>
                      {fee.notes && <p className="text-[11px] text-neutral-500 italic">{fee.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-edit-fee-${fee.id}`}
                        onClick={() => setEditFeeItem(fee)}
                        className="p-2 text-neutral-400 hover:text-amber-400 bg-[#1e2025] hover:bg-amber-950/30 rounded-xl border border-neutral-800 hover:border-amber-500/40 transition"
                        title="Editar Mensalidade (Valor, Vencimento, Status)"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {Number(fee.amount_paid) === 0 && (
                        <button
                          id={`btn-cancel-fee-${fee.id}`}
                          onClick={() => setCancelFeeItem(fee)}
                          className="p-2 text-neutral-400 hover:text-rose-400 bg-[#1e2025] hover:bg-rose-950/40 rounded-xl border border-neutral-800 hover:border-rose-500/40 transition"
                          title="Cancelar Mensalidade (Sem pagamentos)"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setAdjustmentModalData({
                            isOpen: true,
                            itemType: 'monthly_fee',
                            itemId: fee.id,
                            itemTitle: `Mensalidade ${fee.reference_month}`,
                            currentAmount: Number(fee.amount),
                            amountPaid: Number(fee.amount_paid),
                          })
                        }
                        className="p-2 text-neutral-400 hover:text-amber-400 bg-[#1e2025] rounded-xl border border-neutral-800 transition"
                        title="Fazer Ajuste de Valor"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>

                      <button
                        id={`btn-payoff-fee-${fee.id}`}
                        onClick={() =>
                          setPaymentModalData({
                            isOpen: true,
                            paymentType: 'monthly_fee',
                            itemTitle: `Mensalidade de ${fee.reference_month}`,
                            monthlyFeeId: fee.id,
                            openBalance: Number(fee.remaining_amount),
                          })
                        }
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl shadow transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Dar Baixa</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagas */}
          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
              Mensalidades Pagas ({paidFees.length})
            </h3>
            {paidFees.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Nenhum pagamento concluído ainda.</p>
            ) : (
              paidFees.map((fee) => (
                <div
                  key={fee.id}
                  className="p-3.5 rounded-xl bg-[#111214] border border-[#222429] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-neutral-200 uppercase">{formatReferenceDisplay(fee.reference_month)}</span>
                    <span className="text-neutral-500 block text-[11px]">
                      Quitada em {formatDate(fee.paid_at || fee.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(fee.amount)}
                    </span>
                    <button
                      onClick={() => setEditFeeItem(fee)}
                      className="p-1.5 text-neutral-400 hover:text-amber-400 bg-[#1e2025] hover:bg-amber-950/30 rounded-lg border border-neutral-800 hover:border-amber-500/40 transition"
                      title="Editar Mensalidade"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Produtos */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>Produtos em Débito</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                {openDebts.length}
              </span>
            </h3>

            {openDebts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#141619] border border-[#25282f] text-center text-xs text-neutral-400">
                Nenhum débito de produtos em aberto para este aluno.
              </div>
            ) : (
              openDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-base text-neutral-100">
                      {debt.product_name_snapshot}
                    </h4>
                    <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                      <span>Qtd: {debt.quantity}</span>
                      <span>Total: {formatCurrency(debt.total_amount)}</span>
                      <span>Pago: {formatCurrency(debt.amount_paid)}</span>
                      <span className="text-amber-400 font-bold">
                        Saldo: {formatCurrency(debt.remaining_amount)}
                      </span>
                    </div>
                    {debt.notes && <p className="text-[11px] text-neutral-500 italic">{debt.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {Number(debt.amount_paid) === 0 && (
                      <button
                        id={`btn-cancel-debt-${debt.id}`}
                        onClick={() => setCancelDebtItem(debt)}
                        className="p-2 text-neutral-400 hover:text-rose-400 bg-[#1e2025] hover:bg-rose-950/40 rounded-xl border border-neutral-800 hover:border-rose-500/40 transition"
                        title="Cancelar Débito de Produto (Sem pagamentos)"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setAdjustmentModalData({
                          isOpen: true,
                          itemType: 'product_debt',
                          itemId: debt.id,
                          itemTitle: `Produto: ${debt.product_name_snapshot}`,
                          currentAmount: Number(debt.total_amount),
                          amountPaid: Number(debt.amount_paid),
                        })
                      }
                      className="p-2 text-neutral-400 hover:text-amber-400 bg-[#1e2025] rounded-xl border border-neutral-800 transition"
                      title="Fazer Ajuste de Valor"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-payoff-debt-${debt.id}`}
                      onClick={() =>
                        setPaymentModalData({
                          isOpen: true,
                          paymentType: 'product',
                          itemTitle: `Produto: ${debt.product_name_snapshot}`,
                          productDebtId: debt.id,
                          openBalance: Number(debt.remaining_amount),
                        })
                      }
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Dar Baixa</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quitados */}
          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
              Produtos Quitados ({paidDebts.length})
            </h3>
            {paidDebts.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Nenhum produto quitado ainda.</p>
            ) : (
              paidDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="p-3.5 rounded-xl bg-[#111214] border border-[#222429] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-neutral-200">{debt.product_name_snapshot}</span>
                    <span className="text-neutral-500 block text-[11px]">
                      Quitado em {formatDate(debt.paid_at || debt.updated_at)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(debt.total_amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Pagamentos */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {paymentsList.length === 0 ? (
            <EmptyState
              title="Nenhum pagamento registrado"
              description="Quando você der baixa em uma mensalidade ou produto, os comprovantes constarão aqui."
              icon={CreditCard}
            />
          ) : (
            paymentsList.map((p) => {
              const isReversed = p.status === 'reversed';
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                    isReversed
                      ? 'bg-[#151214] border-rose-900/40 text-neutral-400 opacity-90'
                      : 'bg-[#141619] border-[#25282f]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {isReversed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-500/40">
                          PAGAMENTO REVERTIDO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {p.payment_method?.toUpperCase()}
                        </span>
                      )}
                      <span className={`font-bold ${isReversed ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                        {p.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 font-mono">
                      {formatDateTime(p.paid_at || p.created_at)} • Registrado por: {p.recorded_by_email || (p as any).registered_by_email || 'Admin'}
                    </p>

                    {isReversed && (
                      <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 space-y-0.5">
                        <p className="font-semibold">
                          Revertido em {formatDateTime(p.reversed_at)} {p.reversed_by_email ? `por ${p.reversed_by_email}` : ''}
                        </p>
                        {p.reversal_reason && (
                          <p className="italic text-rose-200">Motivo: {p.reversal_reason}</p>
                        )}
                      </div>
                    )}

                    {p.notes && !isReversed && <p className="text-[11px] text-neutral-500 italic">Obs: {p.notes}</p>}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                    <div className="text-right">
                      <span
                        className={`font-mono font-black text-sm block ${
                          isReversed ? 'text-neutral-500 line-through' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrency(p.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isReversed && (
                        <button
                          id={`btn-revert-payment-${p.id}`}
                          onClick={() => setRevertPaymentItem(p)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2025] hover:bg-amber-950/40 text-neutral-300 hover:text-amber-300 border border-[#2d3038] hover:border-amber-500/40 text-xs font-semibold rounded-xl transition cursor-pointer"
                          title="Reverter este pagamento"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          <span>Reverter</span>
                        </button>
                      )}

                      <button
                        id={`btn-delete-payment-${p.id}`}
                        onClick={() => setDeletePaymentItem(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition cursor-pointer"
                        title="Excluir este pagamento permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 4: Histórico Auditável */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyList.length === 0 ? (
            <EmptyState
              title="Sem movimentações no histórico"
              description="Todas as ações de criação de cobranças, baixas e ajustes são mantidas aqui."
              icon={History}
            />
          ) : (
            <div className="divide-y divide-neutral-800 bg-[#141619] border border-[#25282f] rounded-2xl p-4">
              {historyList.map((h) => {
                const isReversal = h.type === 'REVERSAL';
                const isCancellation = h.type === 'CANCELLATION';
                const isPayment = h.type === 'PAYMENT';
                return (
                  <div key={h.id} className="py-3 flex items-start justify-between text-xs gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {isReversal && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-500/40">
                            REVERSÃO
                          </span>
                        )}
                        {isCancellation && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
                            CANCELAMENTO
                          </span>
                        )}
                        <p className="font-bold text-neutral-200">{h.description}</p>
                      </div>
                      <p className="text-[11px] text-neutral-500 font-mono">
                        {formatDateTime(h.created_at)} • Por: {h.created_by_email || 'Sistema'}
                      </p>
                      {h.notes && (
                        <p className="text-[11px] text-neutral-400 italic bg-[#0f1012] p-1.5 rounded mt-1">
                          {h.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right font-mono font-bold">
                      <span
                        className={
                          isPayment
                            ? 'text-emerald-400'
                            : isReversal
                            ? 'text-rose-400'
                            : isCancellation
                            ? 'text-neutral-400 line-through'
                            : 'text-amber-400'
                        }
                      >
                        {isPayment ? '-' : isReversal ? '+' : isCancellation ? '' : '+'}
                        {formatCurrency(h.movement_amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Observações Internas */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                Adicionar Observação Administrativa (Privada)
              </h4>
            </div>
            <textarea
              rows={2}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Escreva uma anotação visível apenas para os administradores (ex: Aluno avisou que viajou e paga dia 20)..."
              className="w-full px-3 py-2 bg-[#101113] border border-neutral-700 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:border-amber-500 outline-none resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNote || !newNoteContent.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Salvar Anotação</span>
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="space-y-3">
            {notesList.length === 0 ? (
              <p className="text-xs text-neutral-500 italic text-center py-4">
                Nenhuma anotação interna gravada para este aluno.
              </p>
            ) : (
              notesList.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-xl bg-[#141619] border border-[#25282f] space-y-1 text-xs"
                >
                  <p className="text-neutral-200 leading-relaxed">{n.text}</p>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-1">
                    <span>Autor: {n.created_by_email || 'Admin'}</span>
                    <span>{formatDateTime(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddFeeModal
        isOpen={showAddFee}
        onClose={() => setShowAddFee(false)}
        studentId={student?.id || studentId}
        studentName={studentDisplayName}
        defaultAmount={Number(student?.monthly_fee_amount) || undefined}
        defaultDueDay={Number(student?.due_day) || undefined}
        isScholarshipDefault={Boolean(student?.is_scholarship)}
        onSuccess={loadAllStudentData}
      />

      <EditFeeModal
        isOpen={Boolean(editFeeItem)}
        onClose={() => setEditFeeItem(null)}
        fee={editFeeItem}
        studentId={student?.id || studentId}
        studentName={studentDisplayName}
        onSuccess={loadAllStudentData}
      />

      <AddProductDebtModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        studentId={student?.id || studentId}
        studentName={studentDisplayName}
        onSuccess={loadAllStudentData}
      />

      <RecordPaymentModal
        isOpen={paymentModalData.isOpen}
        onClose={() => setPaymentModalData((prev) => ({ ...prev, isOpen: false }))}
        studentId={student?.id || studentId}
        studentName={studentDisplayName}
        paymentType={paymentModalData.paymentType}
        itemTitle={paymentModalData.itemTitle}
        monthlyFeeId={paymentModalData.monthlyFeeId}
        productDebtId={paymentModalData.productDebtId}
        openBalance={paymentModalData.openBalance}
        onSuccess={loadAllStudentData}
      />

      <AdjustmentModal
        isOpen={adjustmentModalData.isOpen}
        onClose={() => setAdjustmentModalData((prev) => ({ ...prev, isOpen: false }))}
        studentId={student?.id || studentId}
        studentName={studentDisplayName}
        itemType={adjustmentModalData.itemType}
        itemId={adjustmentModalData.itemId}
        itemTitle={adjustmentModalData.itemTitle}
        currentAmount={adjustmentModalData.currentAmount}
        amountPaid={adjustmentModalData.amountPaid}
        onSuccess={loadAllStudentData}
      />

      {/* Reversão de Pagamento */}
      {revertPaymentItem && (
        <RevertPaymentModal
          isOpen={Boolean(revertPaymentItem)}
          onClose={() => setRevertPaymentItem(null)}
          payment={revertPaymentItem}
          studentName={studentDisplayName}
          onSuccess={loadAllStudentData}
        />
      )}

      {/* Exclusão Definitiva de Pagamento */}
      {deletePaymentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#141619] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Excluir Pagamento</h3>
                <p className="text-xs text-neutral-400">Remover lançamento incorreto</p>
              </div>
            </div>

            <div className="bg-[#181a1f] border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Aluno:</span>
                <strong className="text-white">{studentDisplayName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Tipo:</span>
                <strong className="text-neutral-200">
                  {deletePaymentItem.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Valor:</span>
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(deletePaymentItem.amount)}
                </strong>
              </div>
              <p className="text-[11px] text-amber-300/90 pt-2 border-t border-neutral-800">
                Ao confirmar, este pagamento será excluído e a mensalidade/produto vinculado e o Dashboard serão atualizados automaticamente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletePaymentItem(null)}
                disabled={deletingPayment}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={deletingPayment}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
              >
                {deletingPayment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelamento de Mensalidade */}
      {cancelFeeItem && (
        <CancelMonthlyFeeModal
          isOpen={Boolean(cancelFeeItem)}
          onClose={() => setCancelFeeItem(null)}
          fee={cancelFeeItem}
          studentName={studentDisplayName}
          onSuccess={loadAllStudentData}
        />
      )}

      {/* Cancelamento de Débito de Produto */}
      {cancelDebtItem && (
        <CancelProductDebtModal
          isOpen={Boolean(cancelDebtItem)}
          onClose={() => setCancelDebtItem(null)}
          debt={cancelDebtItem}
          studentName={studentDisplayName}
          onSuccess={loadAllStudentData}
        />
      )}

      {/* Edição Cadastral do Aluno */}
      {showEditStudent && student && (
        <EditStudentModal
          isOpen={showEditStudent}
          onClose={() => setShowEditStudent(false)}
          student={student}
          onSuccess={loadAllStudentData}
        />
      )}
    </div>
  );
}
