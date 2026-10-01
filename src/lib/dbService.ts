import { supabase } from './supabase';
import {
  Profile,
  Student,
  MonthlyFee,
  Product,
  ProductDebt,
  Payment,
  FinancialMovement,
  InternalNote,
  PaymentMethod,
} from '../types/database';
import {
  isOverdue,
  getNextMonthlyFeeDetails,
  normalizePhone,
  formatCurrency,
  getSaoPauloDate,
  calculateTurningAge,
  PT_MONTHS,
  getBirthdayCountdownLabel,
  formatBirthdayDisplay,
  toIsoDateString,
  deriveReferenceMonth,
  formatReferenceDisplay,
  getTodayLocalDateString,
  getSaoPauloDateString,
  getSaoPauloYearMonth,
  normalizeSearch,
  isUuid,
  toReferenceMonthIso,
  toReferenceYearMonth,
} from './utils';

export function notifyFinancialUpdated(detail?: any) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('capoeira:financial_updated', { detail }));
  }
}

export interface DeletedRecordsRegistry {
  paymentIds: Set<string>;
  feeIds: Set<string>;
  debtIds: Set<string>;
}

const DELETED_RECORDS_STORAGE_KEY = 'capoeira:deleted_records_v1';

function readLocalDeletedRecords(): { payment_ids: string[]; fee_ids: string[]; debt_ids: string[] } {
  if (typeof window === 'undefined') {
    return { payment_ids: [], fee_ids: [], debt_ids: [] };
  }
  try {
    const raw = window.localStorage.getItem(DELETED_RECORDS_STORAGE_KEY);
    if (!raw) return { payment_ids: [], fee_ids: [], debt_ids: [] };
    const parsed = JSON.parse(raw);
    return {
      payment_ids: Array.isArray(parsed?.payment_ids) ? parsed.payment_ids : [],
      fee_ids: Array.isArray(parsed?.fee_ids) ? parsed.fee_ids : [],
      debt_ids: Array.isArray(parsed?.debt_ids) ? parsed.debt_ids : [],
    };
  } catch {
    return { payment_ids: [], fee_ids: [], debt_ids: [] };
  }
}

function writeLocalDeletedRecords(data: { payment_ids: string[]; fee_ids: string[]; debt_ids: string[] }) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DELETED_RECORDS_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export async function getDeletedRecordsRegistry(): Promise<DeletedRecordsRegistry> {
  const local = readLocalDeletedRecords();
  const paymentIds = new Set<string>(local.payment_ids);
  const feeIds = new Set<string>(local.fee_ids);
  const debtIds = new Set<string>(local.debt_ids);

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'deleted_records')
      .maybeSingle();

    const val = data?.value as any;
    if (val) {
      if (Array.isArray(val.payment_ids)) val.payment_ids.forEach((id: string) => paymentIds.add(id));
      if (Array.isArray(val.fee_ids)) val.fee_ids.forEach((id: string) => feeIds.add(id));
      if (Array.isArray(val.debt_ids)) val.debt_ids.forEach((id: string) => debtIds.add(id));
    }
  } catch {}

  return { paymentIds, feeIds, debtIds };
}

export async function markRecordAsDeleted(params: {
  paymentIds?: (string | null | undefined)[];
  feeIds?: (string | null | undefined)[];
  debtIds?: (string | null | undefined)[];
}): Promise<void> {
  const reg = await getDeletedRecordsRegistry();
  for (const id of params.paymentIds || []) {
    if (id) reg.paymentIds.add(id);
  }
  for (const id of params.feeIds || []) {
    if (id) reg.feeIds.add(id);
  }
  for (const id of params.debtIds || []) {
    if (id) reg.debtIds.add(id);
  }

  const payload = {
    payment_ids: Array.from(reg.paymentIds),
    fee_ids: Array.from(reg.feeIds),
    debt_ids: Array.from(reg.debtIds),
  };

  writeLocalDeletedRecords(payload);

  try {
    await supabase.from('system_settings').upsert({
      key: 'deleted_records',
      value: payload,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export function isPaymentRecordActive(
  p: any,
  deletedReg: DeletedRecordsRegistry,
  activeFeeIds?: Set<string>,
  activeDebtIds?: Set<string>
): boolean {
  if (!p || !p.id) return false;
  if (p.deleted_at) return false;
  if (p.status === 'reversed' || p.status === 'cancelled') return false;
  if (p.notes === '[EXCLUIDO]' || p.reversal_reason === '[EXCLUIDO]') return false;
  if (deletedReg.paymentIds.has(p.id)) return false;

  if (p.payment_type === 'monthly_fee') {
    if (!p.monthly_fee_id) return false;
    if (deletedReg.feeIds.has(p.monthly_fee_id)) return false;
    if (activeFeeIds && !activeFeeIds.has(p.monthly_fee_id)) return false;
  } else if (p.payment_type === 'product') {
    if (!p.product_debt_id) return false;
    if (deletedReg.debtIds.has(p.product_debt_id)) return false;
    if (activeDebtIds && !activeDebtIds.has(p.product_debt_id)) return false;
  }

  return true;
}

export interface StudentFinancialSummary {
  status: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO' | 'BOLSISTA';
  financialStatus?: 'SCHOLARSHIP' | 'NO_MONTHLY_FEE' | 'UP_TO_DATE' | 'OVERDUE' | 'PENDING';
  totalOpen: number;
  totalMonthlyOpen: number;
  totalProductOpen: number;
  openFeesCount: number;
  openDebtsCount: number;
  nextDueDate: string | null;
  overdueCount: number;
  totalFeesEver: number;
  totalDebtsEver: number;
  monthlyStatus: 'SEM_MENSALIDADE' | 'EM_DIA' | 'PENDENTE' | 'EM_ATRASO' | 'BOLSISTA';
  productStatus: 'NENHUM_DEBITO' | 'PENDENTE';
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number | null;
  isScholarship?: boolean;
  dueDay?: number | null;
}

export interface AdminDashboardData {
  totalStudents: number;
  activeStudentsCount?: number;
  inactiveStudentsCount?: number;
  studentsWithPending: number;
  overdueFeesCount: number;
  totalToReceive: number;
  openProductDebtsCount: number;
  monthPaymentsTotal: number;
  recentMovements: FinancialMovement[];
  monthBirthdaysCount?: number;
  todayBirthdays?: Array<{
    id: string;
    full_name: string;
    nickname?: string | null;
    turningAge: number | null;
    contactPhone?: string | null;
    isGuardianContact?: boolean;
    guardian_name?: string | null;
  }>;
  nextBirthday?: {
    id: string;
    full_name: string;
    nickname?: string | null;
    day: number;
    month: number;
    turningAge: number | null;
    daysDiff: number;
  } | null;
}

export interface BirthdayStudent {
  id: string;
  full_name: string;
  nickname?: string | null;
  date_of_birth: string; // YYYY-MM-DD
  birthDay: number; // 1-31
  birthMonth: number; // 1-12
  birthYear: number;
  turningAge: number | null;
  isToday: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  daysDiff: number;
  countdownLabel: string;
  whatsapp?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  hasGuardian: boolean;
  contactPhone: string;
  isContactGuardian: boolean;
  active: boolean;
}

export interface BirthdaysResult {
  selectedMonth: number;
  selectedYear: number;
  monthName: string;
  isCurrentMonth: boolean;
  allForMonth: BirthdayStudent[];
  today: BirthdayStudent[];
  upcoming: BirthdayStudent[];
  past: BirthdayStudent[];
  totalInMonth: number;
}

export interface StudentWithBalance extends Student {
  totalOpen: number;
  totalMonthlyOpen?: number;
  totalProductOpen?: number;
  financialStatus: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO' | 'INATIVO' | 'BOLSISTA';
  lastPaymentDate?: string | null;
  role: 'student';
  is_scholarship?: boolean;
  isScholarship?: boolean;
  due_day?: number | null;
}

export interface StudentPaymentItem {
  id: string;
  student_id: string;
  payment_type: 'monthly_fee' | 'product' | 'adjustment';
  title: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  notes?: string | null;
  status: 'active' | 'reversed';
  reversed_at?: string | null;
  reversal_reason?: string | null;
}

export type GridFeeStatus = 'PRE' | 'PRÉ' | 'SEM MENSALIDADE' | 'NÃO PAGO' | 'ATRASO' | 'PAGO' | 'PARCIAL' | 'BOLSISTA';

export interface GridMonthCell {
  referenceMonth: string; // 'YYYY-MM'
  monthIndex: number; // 1 a 12
  monthLabel: string; // 'JAN', 'FEV', 'MAR', etc.
  status: GridFeeStatus;
  isPre: boolean;
  isEditable: boolean;
  isScholarship: boolean;
  isOverdue: boolean;
  feeId?: string | null;
  amount: number;
  amountPaid: number;
  remainingAmount: number;
  dueDate: string;
  paidAt?: string | null;
}

export interface AnnualGridStudentRow {
  student: StudentWithBalance;
  months: GridMonthCell[];
}

export interface GridFeeChange {
  studentId: string;
  studentName?: string;
  referenceMonth: string; // 'YYYY-MM'
  monthLabel: string;
  targetStatus: 'PAGO' | 'NÃO PAGO' | 'SEM MENSALIDADE';
  currentStatus: GridFeeStatus;
  feeId?: string | null;
  feeAmount?: number;
  dueDay?: number | null;
}

// =============================================================
// FUNÇÃO CENTRAL UNIFICADA: CÁLCULO DE STATUS FINANCEIRO DO ALUNO
// Fonte Única de Verdade para todo o sistema (Alunos, Grade, Perfil)
// =============================================================
export interface CalculatedStudentFinancialStatus {
  status: 'BOLSISTA' | 'SEM MENSALIDADE' | 'EM DIA' | 'EM ATRASO' | 'PENDENTE' | 'INATIVO';
  financialStatus: 'SCHOLARSHIP' | 'NO_MONTHLY_FEE' | 'UP_TO_DATE' | 'OVERDUE' | 'PENDING' | 'INACTIVE';
  totalMonthlyOpen: number;
  totalProductOpen: number;
  totalOpen: number;
  openFeesCount: number;
  overdueCount: number;
  openDebtsCount: number;
  nextDueDate: string | null;
  lastPaidFeeDate: string | null;
  lastPaidFeeAmount: number | null;
}

export function calculateStudentFinancialStatus(
  active: boolean,
  isScholarship: boolean,
  studentFees: Array<{
    id?: string;
    amount?: number | null;
    amount_paid?: number | null;
    remaining_amount?: number | null;
    status?: string | null;
    due_date?: string | null;
    reference_month?: string | null;
    notes?: string | null;
    paid_at?: string | null;
  }> = [],
  studentDebts: Array<{
    id?: string;
    remaining_amount?: number | null;
    status?: string | null;
  }> = [],
  todayStr: string = getSaoPauloDateString()
): CalculatedStudentFinancialStatus {
  if (!active) {
    return {
      status: 'INATIVO',
      financialStatus: 'INACTIVE',
      totalMonthlyOpen: 0,
      totalProductOpen: 0,
      totalOpen: 0,
      openFeesCount: 0,
      overdueCount: 0,
      openDebtsCount: 0,
      nextDueDate: null,
      lastPaidFeeDate: null,
      lastPaidFeeAmount: null,
    };
  }

  // 1. Aluno Bolsista
  if (isScholarship) {
    let totalProductOpen = 0;
    let openDebtsCount = 0;
    for (const d of studentDebts || []) {
      const rem = Number(d.remaining_amount) || 0;
      if (rem > 0 && d.status !== 'cancelled' && d.status !== 'paid') {
        totalProductOpen += rem;
        openDebtsCount++;
      }
    }
    return {
      status: 'BOLSISTA',
      financialStatus: 'SCHOLARSHIP',
      totalMonthlyOpen: 0,
      totalProductOpen,
      totalOpen: totalProductOpen,
      openFeesCount: 0,
      overdueCount: 0,
      openDebtsCount,
      nextDueDate: null,
      lastPaidFeeDate: null,
      lastPaidFeeAmount: null,
    };
  }

  // 2. Aluno Pagante: analisa estritamente monthly_fees
  const validFees = (studentFees || []).filter(
    (f) => f && f.status !== 'cancelled'
  );

  let totalMonthlyOpen = 0;
  let overdueCount = 0;
  let openFeesCount = 0;
  let nextDueDate: string | null = null;

  const openFees: typeof validFees = [];
  const paidFees: typeof validFees = [];

  for (const fee of validFees) {
    const rem = Number(fee.remaining_amount) || 0;
    const isPaid = fee.status === 'paid' || (rem === 0 && Number(fee.amount_paid) > 0);
    const dueDateStr = fee.due_date ? fee.due_date.substring(0, 10) : '';

    if (isPaid) {
      paidFees.push(fee);
    } else if (rem > 0 || fee.status === 'pending' || fee.status === 'overdue' || fee.status === 'partial') {
      openFees.push(fee);
      totalMonthlyOpen += rem;
      openFeesCount++;

      if (dueDateStr && dueDateStr < todayStr) {
        overdueCount++;
      }
      if (dueDateStr && (!nextDueDate || dueDateStr < nextDueDate)) {
        nextDueDate = dueDateStr;
      }
    }
  }

  let totalProductOpen = 0;
  let openDebtsCount = 0;
  for (const d of studentDebts || []) {
    const rem = Number(d.remaining_amount) || 0;
    if (rem > 0 && d.status !== 'cancelled' && d.status !== 'paid') {
      totalProductOpen += rem;
      openDebtsCount++;
    }
  }

  totalMonthlyOpen = Number(totalMonthlyOpen.toFixed(2));
  totalProductOpen = Number(totalProductOpen.toFixed(2));
  const totalOpen = Number((totalMonthlyOpen + totalProductOpen).toFixed(2));

  // Ordena mensalidades pagas da mais recente para a mais antiga
  paidFees.sort((a, b) => {
    const dateA = a.paid_at || a.due_date || '';
    const dateB = b.paid_at || b.due_date || '';
    return dateB.localeCompare(dateA);
  });
  const latestPaid = paidFees[0] || null;
  const lastPaidFeeDate = latestPaid?.paid_at || latestPaid?.due_date || null;
  const lastPaidFeeAmount = latestPaid ? (Number(latestPaid.amount_paid) || Number(latestPaid.amount) || null) : null;

  // REGRAS DEFINITIVAS DE STATUS:
  // Regra A: Se houver mensalidade em atraso (vencimento ultrapassado) -> EM ATRASO
  if (overdueCount > 0) {
    return {
      status: 'EM ATRASO',
      financialStatus: 'OVERDUE',
      totalMonthlyOpen,
      totalProductOpen,
      totalOpen,
      openFeesCount,
      overdueCount,
      openDebtsCount,
      nextDueDate,
      lastPaidFeeDate,
      lastPaidFeeAmount,
    };
  }

  // Regra B: Se houver mensalidade em aberto mas com vencimento ainda no futuro (due_date >= hoje) -> EM DIA até o vencimento
  if (openFeesCount > 0) {
    return {
      status: 'EM DIA',
      financialStatus: 'UP_TO_DATE',
      totalMonthlyOpen,
      totalProductOpen,
      totalOpen,
      openFeesCount,
      overdueCount: 0,
      openDebtsCount,
      nextDueDate,
      lastPaidFeeDate,
      lastPaidFeeAmount,
    };
  }

  // Regra C: Sem mensalidades em aberto (openFeesCount === 0).
  // Verifica se o aluno quitou mensalidade correspondente à competência atual (America/Sao_Paulo)
  const currentYearMonth = todayStr.substring(0, 7);
  const currentPaidFee = paidFees.find((f) => {
    const fYm = toReferenceYearMonth(f.reference_month) || (f.due_date ? f.due_date.substring(0, 7) : '');
    return fYm === currentYearMonth;
  });

  if (currentPaidFee) {
    return {
      status: 'EM DIA',
      financialStatus: 'UP_TO_DATE',
      totalMonthlyOpen: 0,
      totalProductOpen,
      totalOpen,
      openFeesCount: 0,
      overdueCount: 0,
      openDebtsCount,
      nextDueDate: null,
      lastPaidFeeDate,
      lastPaidFeeAmount,
    };
  }

  // Regra D: Não existe monthly_fee válida para a competência atual (nunca deduzir status através de pagamentos antigos)
  // Resultado: SEM MENSALIDADE
  return {
    status: 'SEM MENSALIDADE',
    financialStatus: 'NO_MONTHLY_FEE',
    totalMonthlyOpen: 0,
    totalProductOpen,
    totalOpen,
    openFeesCount: 0,
    overdueCount: 0,
    openDebtsCount,
    nextDueDate: null,
    lastPaidFeeDate,
    lastPaidFeeAmount,
  };
}

// In-memory cache de IDs canônicos para garantir máxima performance
export const dbService = {
  // -------------------------------------------------------------
  // ID CANÔNICO DO ALUNO (public.profiles.id é o ID oficial)
  // -------------------------------------------------------------
  async ensureStudentId(studentIdentifier: string): Promise<string> {
    if (!studentIdentifier || typeof studentIdentifier !== 'string') {
      return studentIdentifier;
    }
    return studentIdentifier.trim();
  },

  async resolveCanonicalStudentId(studentIdentifier: string): Promise<string> {
    return this.ensureStudentId(studentIdentifier);
  },

  // -------------------------------------------------------------
  // ALUNO: Resumo Financeiro (Fonte Única de Verdade)
  // -------------------------------------------------------------
  async getStudentSummary(studentId: string): Promise<StudentFinancialSummary> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      const spTodayStr = getSaoPauloDateString();

      // Consultas executadas em paralelo utilizando estritamente colunas válidas
      const [studentRes, feesRes, debtsRes, paymentRes, deletedReg] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', canonicalId)
          .maybeSingle(),
        supabase
          .from('monthly_fees')
          .select('id, remaining_amount, amount, amount_paid, due_date, status, reference_month, notes, paid_at')
          .eq('student_id', canonicalId)
          .neq('status', 'cancelled')
          .order('due_date', { ascending: false }),
        supabase
          .from('product_debts')
          .select('id, remaining_amount, status')
          .eq('student_id', canonicalId)
          .neq('status', 'cancelled'),
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', canonicalId)
          .order('paid_at', { ascending: false }),
        getDeletedRecordsRegistry(),
      ]);

      const studentData = studentRes.data;
      const allFees = ((feesRes.data || []) as MonthlyFee[]).filter(
        (f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
      );
      const allStudentDebts = (debtsRes.data || []).filter(
        (d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id)
      );
      const allDebts = allStudentDebts.filter((d: any) => d.status !== 'paid');
      const activeFeeIds = new Set<string>(allFees.map((f) => f.id));
      const activeDebtIds = new Set<string>(allStudentDebts.map((d: any) => d.id));
      const validPayments = (paymentRes.data || []).filter((p: any) =>
        isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds)
      );
      const latestPayment = validPayments[0] || null;

      // Identificar se o aluno é bolsista
      const isScholarship = Boolean(
        studentData?.is_scholarship ||
        allFees.some(
          (f: any) =>
            f.is_scholarship ||
            f.status === 'scholarship' ||
            (f.notes && f.notes.includes('[BOLSISTA]'))
        )
      );

      const statusCalc = calculateStudentFinancialStatus(
        studentData?.active !== false,
        isScholarship,
        allFees,
        allDebts,
        spTodayStr
      );

      let monthlyStatus: 'SEM_MENSALIDADE' | 'EM_DIA' | 'PENDENTE' | 'EM_ATRASO' | 'BOLSISTA';
      if (statusCalc.status === 'BOLSISTA') monthlyStatus = 'BOLSISTA';
      else if (statusCalc.status === 'SEM MENSALIDADE') monthlyStatus = 'SEM_MENSALIDADE';
      else if (statusCalc.status === 'EM ATRASO') monthlyStatus = 'EM_ATRASO';
      else if (statusCalc.status === 'EM DIA') monthlyStatus = 'EM_DIA';
      else monthlyStatus = 'PENDENTE';

      return {
        status: statusCalc.status as any,
        financialStatus: statusCalc.financialStatus as any,
        totalOpen: statusCalc.totalOpen,
        totalMonthlyOpen: statusCalc.totalMonthlyOpen,
        totalProductOpen: statusCalc.totalProductOpen,
        openFeesCount: statusCalc.openFeesCount,
        openDebtsCount: statusCalc.openDebtsCount,
        nextDueDate: statusCalc.nextDueDate,
        overdueCount: statusCalc.overdueCount,
        totalFeesEver: allFees.length,
        totalDebtsEver: allDebts.length,
        monthlyStatus,
        productStatus: statusCalc.totalProductOpen > 0 ? 'PENDENTE' : 'NENHUM_DEBITO',
        lastPaymentDate: latestPayment?.paid_at || statusCalc.lastPaidFeeDate,
        lastPaymentAmount: latestPayment?.amount ? Number(latestPayment.amount) : statusCalc.lastPaidFeeAmount,
        isScholarship,
        dueDay: studentData?.due_day || null,
      };
    } catch (err) {
      console.warn('Erro ao carregar resumo do aluno:', err);
      return {
        status: 'SEM MENSALIDADE',
        financialStatus: 'NO_MONTHLY_FEE',
        totalOpen: 0,
        totalMonthlyOpen: 0,
        totalProductOpen: 0,
        openFeesCount: 0,
        openDebtsCount: 0,
        nextDueDate: null,
        overdueCount: 0,
        totalFeesEver: 0,
        totalDebtsEver: 0,
        monthlyStatus: 'SEM_MENSALIDADE',
        productStatus: 'NENHUM_DEBITO',
        lastPaymentDate: null,
        lastPaymentAmount: null,
        isScholarship: false,
        dueDay: null,
      };
    }
  },

  async getStudentFinancialSummary(studentId: string): Promise<StudentFinancialSummary> {
    return this.getStudentSummary(studentId);
  },

  // -------------------------------------------------------------
  // ALUNO: Mensalidades
  // -------------------------------------------------------------
  async getStudentMonthlyFees(studentId: string): Promise<{
    open: MonthlyFee[];
    paid: MonthlyFee[];
  }> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      let { data, error } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('student_id', canonicalId)
        .order('due_date', { ascending: true });

      if ((!data || data.length === 0) && studentId !== canonicalId) {
        const { data: altData } = await supabase
          .from('monthly_fees')
          .select('*')
          .eq('student_id', studentId)
          .order('due_date', { ascending: true });
        if (altData && altData.length > 0) {
          data = altData;
        }
      }

      if (error && !data) throw error;

      const deletedReg = await getDeletedRecordsRegistry();
      const fees = ((data || []) as MonthlyFee[]).filter(
        (f: any) => f && !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
      );
      const open = fees.filter((f) => f && f.status !== 'paid' && f.status !== 'cancelled');
      const paid = fees.filter((f) => f && f.status === 'paid');

      // Sort paid by paid_at descending
      paid.sort((a, b) => {
        const timeA = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const timeB = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return timeB - timeA;
      });

      return { open, paid };
    } catch (err) {
      console.warn('Erro ao buscar mensalidades do aluno:', err);
      return { open: [], paid: [] };
    }
  },

  // -------------------------------------------------------------
  // ALUNO: Produtos em Débito
  // -------------------------------------------------------------
  async getStudentProductDebts(studentId: string): Promise<{
    open: ProductDebt[];
    paid: ProductDebt[];
  }> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      let { data, error } = await supabase
        .from('product_debts')
        .select('*')
        .eq('student_id', canonicalId)
        .order('created_at', { ascending: false });

      if ((!data || data.length === 0) && studentId !== canonicalId) {
        const { data: altData } = await supabase
          .from('product_debts')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        if (altData && altData.length > 0) {
          data = altData;
        }
      }

      if (error && !data) throw error;

      const deletedReg = await getDeletedRecordsRegistry();
      const debts = ((data || []) as ProductDebt[]).filter(
        (d: any) => d && !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id)
      );
      const open = debts.filter((d) => d && d.status !== 'paid' && d.status !== 'cancelled');
      const paid = debts.filter((d) => d && d.status === 'paid');

      return { open, paid };
    } catch (err) {
      console.warn('Erro ao carregar produtos em débito do aluno:', err);
      return { open: [], paid: [] };
    }
  },

  // -------------------------------------------------------------
  // ALUNO: Histórico Financeiro
  // -------------------------------------------------------------
  async getStudentHistory(studentId: string): Promise<FinancialMovement[]> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      let { data, error } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('student_id', canonicalId)
        .order('created_at', { ascending: false });

      if ((!data || data.length === 0) && studentId !== canonicalId) {
        const { data: altData } = await supabase
          .from('financial_movements')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        if (altData && altData.length > 0) {
          data = altData;
        }
      }

      if (error && !data) throw error;
      return (data || []) as FinancialMovement[];
    } catch (err) {
      console.warn('Erro ao carregar histórico do aluno:', err);
      return [];
    }
  },

  // -------------------------------------------------------------
  // ALUNO: Histórico de Pagamentos (Exclusivo para visão do Aluno)
  // Mostra apenas pagamentos do aluno autenticado / selecionado
  // NUNCA exibe ações administrativas (criação de mensalidade, débito de produto, etc.)
  // -------------------------------------------------------------
  async getStudentPaymentHistory(studentId: string): Promise<StudentPaymentItem[]> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      if (!canonicalId) {
        return [];
      }

      // 1. Buscar pagamentos na tabela payments ordenados por paid_at DESC
      let { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', canonicalId)
        .order('paid_at', { ascending: false });

      // Fallback com studentId original caso diferente do canônico
      if ((!payments || payments.length === 0) && studentId !== canonicalId) {
        const { data: altPayments } = await supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .order('paid_at', { ascending: false });
        if (altPayments && altPayments.length > 0) {
          payments = altPayments;
        }
      }

      const [deletedReg, feesAllRes, debtsAllRes] = await Promise.all([
        getDeletedRecordsRegistry(),
        supabase.from('monthly_fees').select('id, description, reference_month, status').eq('student_id', canonicalId),
        supabase.from('product_debts').select('id, product_name_snapshot, status').eq('student_id', canonicalId),
      ]);

      const activeFeesList = (feesAllRes.data || []).filter(
        (f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
      );
      const activeDebtsList = (debtsAllRes.data || []).filter(
        (d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id)
      );

      const activeFeeIds = new Set<string>(activeFeesList.map((f: any) => f.id));
      const activeDebtIds = new Set<string>(activeDebtsList.map((d: any) => d.id));

      const validPayments = (payments || []).filter((p: any) =>
        isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds)
      );

      if (validPayments.length > 0) {
        const feeMap = new Map<string, { description: string; reference_month: string }>();
        const debtMap = new Map<string, { product_name_snapshot: string }>();

        activeFeesList.forEach((f: any) => {
          feeMap.set(f.id, { description: f.description, reference_month: f.reference_month });
        });
        activeDebtsList.forEach((d: any) => {
          debtMap.set(d.id, { product_name_snapshot: d.product_name_snapshot });
        });

        const methodMap: Record<string, string> = {
          pix: 'PIX',
          dinheiro: 'Dinheiro',
          cartao: 'Cartão',
          cartao_credito: 'Cartão de Crédito',
          cartao_debito: 'Cartão de Débito',
          transferencia: 'Transferência',
          outro: 'Outro',
        };

        return validPayments.map((p: any) => {
          let title = '';
          if (p.payment_type === 'monthly_fee') {
            const fee = p.monthly_fee_id ? feeMap.get(p.monthly_fee_id) : null;
            if (fee?.reference_month) {
              title = `Mensalidade ${fee.reference_month}`;
            } else if (fee?.description) {
              title = fee.description;
            } else {
              title = 'Mensalidade';
            }
          } else if (p.payment_type === 'product') {
            const debt = p.product_debt_id ? debtMap.get(p.product_debt_id) : null;
            if (debt?.product_name_snapshot) {
              title = debt.product_name_snapshot;
            } else {
              title = 'Produto / Material';
            }
          } else {
            title = 'Pagamento Avulso';
          }

          const rawMethod = (p.payment_method || '').toLowerCase().trim();
          const paymentMethod = methodMap[rawMethod] || (p.payment_method ? p.payment_method.toUpperCase() : 'PIX');

          return {
            id: p.id,
            student_id: p.student_id,
            payment_type: p.payment_type || 'monthly_fee',
            title,
            amount: Number(p.amount) || 0,
            payment_method: paymentMethod,
            paid_at: p.paid_at || p.created_at,
            notes: p.notes || null,
            status: 'active',
            reversed_at: null,
            reversal_reason: null,
          };
        });
      }

      return [];
    } catch (err) {
      console.warn('Erro ao carregar histórico de pagamentos do aluno:', err);
      return [];
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Dashboard Metrics (dados REAIS)
  // -------------------------------------------------------------
  async getAdminDashboardMetrics(): Promise<AdminDashboardData> {
    const spTodayStr = getSaoPauloDateString();
    const spNow = getSaoPauloDate();
    const currentYearMonth = `${spNow.year}-${String(spNow.month).padStart(2, '0')}`;

    // Executa consultas de métricas em paralelo com a estrutura REAL do Supabase
    const [profilesRes, feesRes, debtsRes, paymentsRes, movementsRes] = await Promise.all([
      // 1. Fonte oficial de alunos e perfis: public.profiles
      supabase
        .from('profiles')
        .select('*'),
      // 2. Mensalidades (compatível com o schema real do Supabase)
      supabase
        .from('monthly_fees')
        .select('*')
        .neq('status', 'cancelled'),
      // 3. Débitos de produtos (todos os não cancelados: abertos, parciais e pagos)
      supabase
        .from('product_debts')
        .select('*')
        .neq('status', 'cancelled'),
      // 4. Pagamentos registrados
      supabase
        .from('payments')
        .select('*'),
      // 5. Últimas movimentações financeiras
      supabase
        .from('financial_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const rawProfiles = profilesRes.data || [];
    // Alunos são todos os perfis com role = 'student' ou não-admins
    const allStudents = rawProfiles.filter(
      (p) => !p.deleted_at && (p.role === 'student' || (!p.role && p.role !== 'admin'))
    );
    const activeStudents = allStudents.filter((s) => s.active !== false);
    const inactiveStudents = allStudents.filter((s) => s.active === false);

    const studentMap = new Map<string, any>();
    for (const p of allStudents) {
      studentMap.set(p.id, {
        id: p.id,
        full_name: p.full_name,
        nickname: p.nickname,
        date_of_birth: p.date_of_birth,
        whatsapp: p.whatsapp,
        guardian_name: p.guardian_name,
        guardian_phone: p.guardian_phone,
        active: p.active !== false,
        is_scholarship: Boolean(p.is_scholarship),
      });
    }

    // Regra do Usuário: total de alunos ativos (~31) exibido no Dashboard
    const totalStudents = activeStudents.length;
    const activeStudentsCount = activeStudents.length;
    const inactiveStudentsCount = inactiveStudents.length;

    const scholarshipStudentIds = new Set<string>();
    for (const s of allStudents) {
      if (s.is_scholarship) scholarshipStudentIds.add(s.id);
    }

    const deletedReg = await getDeletedRecordsRegistry();
    const fees = (feesRes.data || []).filter(
      (f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
    );
    const debts = (debtsRes.data || []).filter(
      (d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id)
    );
    const activeFeeIds = new Set<string>(fees.map((f: any) => f.id));
    const activeDebtIds = new Set<string>(debts.map((d: any) => d.id));
    const payments = (paymentsRes.data || []).filter((p: any) =>
      isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds)
    );
    let movements = (movementsRes.data || []).filter((m: any) => {
      if (m.deleted_at) return false;
      if (m.reference_id && (deletedReg.paymentIds.has(m.reference_id) || deletedReg.feeIds.has(m.reference_id) || deletedReg.debtIds.has(m.reference_id))) {
        return false;
      }
      return true;
    });

    // Enriquece movimentações caso o join student:profiles não encontre o aluno
    movements = movements.map((m: any) => {
      if (!m.student && m.student_id && studentMap.has(m.student_id)) {
        const s = studentMap.get(m.student_id);
        return {
          ...m,
          student: {
            id: s.id,
            full_name: s.full_name,
            nickname: s.nickname,
          },
        };
      }
      return m;
    });

    // Cálculos consolidados de acordo com as mensalidades e produtos lançados/pagos
    let totalToReceive = 0;
    let overdueFeesCount = 0;
    let monthPaymentsTotal = 0;
    const pendingStudentIds = new Set<string>();
    const countedFeeIds = new Set<string>();
    const countedDebtIds = new Set<string>();

    // 1. Mensalidades (abertas e pagas/parciais)
    for (const fee of fees) {
      if ((fee as any).deleted_at) continue;

      const isScholarshipFee =
        fee.status === 'scholarship' ||
        Boolean((fee as any).is_scholarship) ||
        (fee.notes && fee.notes.includes('[BOLSISTA]')) ||
        scholarshipStudentIds.has(fee.student_id);

      if (isScholarshipFee) {
        continue;
      }

      const feeAmount = Number(fee.amount) || 0;
      const feePaid = Number(fee.amount_paid) || 0;
      const isFeePaid = fee.status === 'paid' || (Number(fee.remaining_amount) === 0 && feePaid > 0);
      const effectivePaid = isFeePaid ? (feePaid > 0 ? feePaid : feeAmount) : feePaid;

      if (effectivePaid > 0 && fee.status !== 'cancelled') {
        monthPaymentsTotal += effectivePaid;
        countedFeeIds.add(fee.id);
      }

      const rem = isFeePaid ? 0 : (Number(fee.remaining_amount) || Math.max(0, feeAmount - feePaid));
      if (rem > 0 && fee.status !== 'cancelled' && fee.status !== 'paid' && fee.status !== 'scholarship') {
        totalToReceive += rem;
        pendingStudentIds.add(fee.student_id);
        if (fee.due_date && fee.due_date.substring(0, 10) < spTodayStr) {
          overdueFeesCount++;
        }
      }
    }

    // 2. Produtos (abertos e pagos/parciais)
    let openProductDebtsCount = 0;
    for (const debt of debts) {
      if ((debt as any).deleted_at) continue;
      if (debt.status === 'cancelled') continue;

      const totalAmt = Number(debt.total_amount) || 0;
      const debtPaid = Number(debt.amount_paid) || 0;
      const isDebtPaid = debt.status === 'paid' || (Number(debt.remaining_amount) === 0 && debtPaid > 0);
      const effectiveDebtPaid = isDebtPaid ? (debtPaid > 0 ? debtPaid : totalAmt) : debtPaid;

      if (effectiveDebtPaid > 0) {
        monthPaymentsTotal += effectiveDebtPaid;
        countedDebtIds.add(debt.id);
      }

      const rem = isDebtPaid ? 0 : (Number(debt.remaining_amount) || Math.max(0, totalAmt - debtPaid));
      if (rem > 0 && debt.status !== 'paid') {
        openProductDebtsCount++;
        totalToReceive += rem;
        pendingStudentIds.add(debt.student_id);
      }
    }

    // 3. Pagamentos avulsos em payments que não estejam vinculados a uma fee/debt já contabilizada
    const existingFeeIds = new Set(fees.map((f: any) => f.id));
    const existingDebtIds = new Set(debts.map((d: any) => d.id));
    for (const p of payments) {
      const pAny = p as any;
      if (pAny.deleted_at) continue;
      if (pAny.status === 'reversed' || pAny.status === 'cancelled') continue;

      if (p.monthly_fee_id) {
        // Se a mensalidade já foi somada ou se a mensalidade não existe mais (foi revertida para SEM MENSALIDADE), não duplica
        if (countedFeeIds.has(p.monthly_fee_id) || !existingFeeIds.has(p.monthly_fee_id)) {
          continue;
        }
        monthPaymentsTotal += Number(p.amount) || 0;
        countedFeeIds.add(p.monthly_fee_id);
      } else if (p.product_debt_id) {
        if (countedDebtIds.has(p.product_debt_id) || !existingDebtIds.has(p.product_debt_id)) {
          continue;
        }
        monthPaymentsTotal += Number(p.amount) || 0;
        countedDebtIds.add(p.product_debt_id);
      } else {
        const paidAtStr = p.paid_at ? String(p.paid_at) : (pAny.created_at ? String(pAny.created_at) : '');
        if (!paidAtStr || paidAtStr.includes(currentYearMonth) || paidAtStr.startsWith(String(spNow.year))) {
          monthPaymentsTotal += Number(p.amount) || 0;
        }
      }
    }

    totalToReceive = Number(totalToReceive.toFixed(2));
    monthPaymentsTotal = Number(monthPaymentsTotal.toFixed(2));

    // 4. Aniversariantes do mês e do dia (America/Sao_Paulo)
    let monthBirthdaysCount = 0;
    const todayBirthdays: Array<{
      id: string;
      full_name: string;
      nickname?: string | null;
      turningAge: number | null;
      contactPhone?: string | null;
      isGuardianContact?: boolean;
      guardian_name?: string | null;
    }> = [];

    let nextBirthday: {
      id: string;
      full_name: string;
      nickname?: string | null;
      day: number;
      month: number;
      turningAge: number | null;
      daysDiff: number;
    } | null = null;

    let closestDiff = 999;
    for (const s of allStudents) {
      if (!s.date_of_birth) continue;
      const parts = s.date_of_birth.split('-');
      if (parts.length < 3) continue;
      const bMonth = parseInt(parts[1], 10);
      const bDay = parseInt(parts[2], 10);

      if (bMonth === spNow.month) {
        monthBirthdaysCount++;
        const turningAge = calculateTurningAge(s.date_of_birth, spNow.year);
        const hasGuardian = Boolean(s.guardian_name && s.guardian_phone);
        const contactPhone = hasGuardian ? s.guardian_phone : (s.whatsapp || null);

        if (bDay === spNow.day) {
          todayBirthdays.push({
            id: s.id,
            full_name: s.full_name,
            nickname: s.nickname,
            turningAge,
            contactPhone,
            isGuardianContact: hasGuardian,
            guardian_name: s.guardian_name,
          });
        } else if (bDay > spNow.day) {
          const diff = bDay - spNow.day;
          if (diff < closestDiff) {
            closestDiff = diff;
            nextBirthday = {
              id: s.id,
              full_name: s.full_name,
              nickname: s.nickname,
              day: bDay,
              month: bMonth,
              turningAge,
              daysDiff: diff,
            };
          }
        }
      }
    }

    return {
      totalStudents,
      activeStudentsCount,
      inactiveStudentsCount,
      studentsWithPending: pendingStudentIds.size,
      overdueFeesCount,
      totalToReceive,
      openProductDebtsCount,
      monthPaymentsTotal,
      recentMovements: movements as FinancialMovement[],
      monthBirthdaysCount,
      todayBirthdays,
      nextBirthday,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Lista de Alunos com Status Financeiro
  // -------------------------------------------------------------
  async getAllStudents(searchTerm: string = ''): Promise<StudentWithBalance[]> {
    const spTodayStr = getSaoPauloDateString();

    // Consultas executadas em paralelo utilizando a tabela REAL public.profiles
    const [profilesRes, feesRes, debtsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('full_name', { ascending: true }),
      supabase
        .from('monthly_fees')
        .select('id, student_id, remaining_amount, amount, amount_paid, due_date, status, notes, reference_month')
        .neq('status', 'cancelled')
        .order('due_date', { ascending: false }),
      supabase
        .from('product_debts')
        .select('id, student_id, remaining_amount, status')
        .neq('status', 'cancelled')
        .neq('status', 'paid'),
    ]);

    const rawProfiles = profilesRes.data || [];
    const rawStudents = rawProfiles.filter(
      (p) => !p.deleted_at && (p.role === 'student' || (!p.role && p.role !== 'admin'))
    );
    if (rawStudents.length === 0) return [];

    const allFees = feesRes.data || [];
    const allDebts = debtsRes.data || [];

    const monthlyOpenMap: Record<string, number> = {};
    const productOpenMap: Record<string, number> = {};
    const hasOverdueMap: Record<string, boolean> = {};
    const feeCountMap: Record<string, number> = {};
    const isScholarshipMap: Record<string, boolean> = {};
    const latestPaidDueDateMap: Record<string, string> = {};
    const hasCurrentCyclePaidMap: Record<string, boolean> = {};

    const currentYearMonth = spTodayStr.substring(0, 7);

    for (const f of allFees) {
      feeCountMap[f.student_id] = (feeCountMap[f.student_id] || 0) + 1;
      if (
        f.status === 'scholarship' ||
        (f.notes && f.notes.includes('[BOLSISTA]'))
      ) {
        isScholarshipMap[f.student_id] = true;
      }

      const rem = Number(f.remaining_amount) || 0;
      const isPaid = f.status === 'paid' || (rem === 0 && Number(f.amount_paid) > 0);

      if (isPaid) {
        const feeYm = toReferenceYearMonth(f.reference_month) || (f.due_date ? f.due_date.substring(0, 7) : '');
        if (feeYm === currentYearMonth) {
          hasCurrentCyclePaidMap[f.student_id] = true;
        }
        if (f.due_date) {
          if (!latestPaidDueDateMap[f.student_id] || f.due_date > latestPaidDueDateMap[f.student_id]) {
            latestPaidDueDateMap[f.student_id] = f.due_date;
          }
        }
      } else if (rem > 0 && f.status !== 'cancelled' && f.status !== 'scholarship') {
        monthlyOpenMap[f.student_id] = (monthlyOpenMap[f.student_id] || 0) + rem;
        if (f.due_date && f.due_date.substring(0, 10) < spTodayStr) {
          hasOverdueMap[f.student_id] = true;
        }
      }
    }

    for (const d of allDebts) {
      const rem = Number(d.remaining_amount) || 0;
      if (rem > 0 && d.status !== 'cancelled' && d.status !== 'paid') {
        productOpenMap[d.student_id] = (productOpenMap[d.student_id] || 0) + rem;
      }
    }

    let result: StudentWithBalance[] = rawStudents.map((p) => {
      const isScholarship = Boolean(p.is_scholarship || isScholarshipMap[p.id]);
      const monthlyOpen = isScholarship ? 0 : Number((monthlyOpenMap[p.id] || 0).toFixed(2));
      const productOpen = Number((productOpenMap[p.id] || 0).toFixed(2));
      const totalOpen = Number((monthlyOpen + productOpen).toFixed(2));
      const hasOverdue = isScholarship ? false : Boolean(hasOverdueMap[p.id]);
      const feeCount = feeCountMap[p.id] || 0;
      const latestPaidDueDate = latestPaidDueDateMap[p.id] || null;
      const hasCurrentCyclePaid = Boolean(hasCurrentCyclePaidMap[p.id]);

      let financialStatus: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO' | 'INATIVO' | 'BOLSISTA';
      if (!p.active) {
        financialStatus = 'INATIVO';
      } else if (isScholarship) {
        financialStatus = 'BOLSISTA';
      } else if (hasOverdue) {
        financialStatus = 'EM ATRASO';
      } else if (hasCurrentCyclePaid) {
        financialStatus = 'EM DIA';
      } else if (monthlyOpen > 0) {
        // Mensalidade em aberto da competência com vencimento >= hoje
        financialStatus = 'EM DIA';
      } else {
        // Sem monthly_fee válida para a competência atual -> SEM MENSALIDADE
        financialStatus = 'SEM MENSALIDADE';
      }

      return {
        ...p,
        monthly_fee_amount: Number(p.monthly_fee_amount) || 0,
        due_day: p.due_day ?? 10,
        totalOpen,
        totalMonthlyOpen: monthlyOpen,
        totalProductOpen: productOpen,
        financialStatus,
        is_scholarship: isScholarship,
        isScholarship,
        role: 'student',
      };
    });

    if (searchTerm.trim()) {
      const term = normalizeSearch(searchTerm);
      result = result.filter((s) => {
        const fullName = normalizeSearch(s.full_name);
        const nickname = normalizeSearch(s.nickname);
        const email = normalizeSearch(s.email);
        const whatsapp = normalizeSearch(s.whatsapp);
        const cleanPhone = normalizeSearch(s.whatsapp_normalized);
        const guardian = normalizeSearch(s.guardian_name);
        const guardianPhone = normalizeSearch(s.guardian_phone);
        const cleanGuardianPhone = normalizeSearch(s.guardian_phone_normalized);
        return (
          fullName.includes(term) ||
          nickname.includes(term) ||
          email.includes(term) ||
          whatsapp.includes(term) ||
          cleanPhone.includes(term) ||
          guardian.includes(term) ||
          guardianPhone.includes(term) ||
          cleanGuardianPhone.includes(term)
        );
      });
    }

    return result;
  },

  // -------------------------------------------------------------
  // ADMIN: Aniversariantes do Mês Selecionado (Dados Reais)
  // -------------------------------------------------------------
  async getStudentsBirthdays(targetMonth?: number): Promise<BirthdaysResult> {
    const spNow = getSaoPauloDate();
    const selectedMonth = targetMonth && targetMonth >= 1 && targetMonth <= 12 ? targetMonth : spNow.month;
    const isCurrentMonth = selectedMonth === spNow.month;
    const selectedYear = spNow.year;
    const monthName = PT_MONTHS[selectedMonth - 1] || '';

    let rawStudents: any[] = [];
    try {
      const { data: profData, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .eq('active', true)
        .not('date_of_birth', 'is', null);
      if (pErr) throw pErr;
      rawStudents = profData || [];
    } catch (e) {
      console.warn('Erro ao consultar aniversariantes em profiles:', e);
      rawStudents = [];
    }

    const allForMonth: BirthdayStudent[] = [];
    const today: BirthdayStudent[] = [];
    const upcoming: BirthdayStudent[] = [];
    const past: BirthdayStudent[] = [];

    for (const s of rawStudents) {
      if (!s.date_of_birth) continue;
      const parts = s.date_of_birth.split('-');
      if (parts.length < 3) continue;

      const birthYear = parseInt(parts[0], 10);
      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);

      if (isNaN(birthMonth) || isNaN(birthDay) || birthMonth < 1 || birthMonth > 12) {
        continue;
      }

      // Filter by selected month
      if (birthMonth !== selectedMonth) {
        continue;
      }

      const turningAge = calculateTurningAge(s.date_of_birth, selectedYear);
      const hasGuardian = Boolean(s.guardian_name && s.guardian_phone);
      const isContactGuardian = hasGuardian;
      const contactPhone = isContactGuardian ? (s.guardian_phone || '') : (s.whatsapp || '');

      let isToday = false;
      let isUpcoming = false;
      let isPast = false;
      let daysDiff = 0;
      let countdownLabel = '';

      if (isCurrentMonth) {
        const countdown = getBirthdayCountdownLabel(birthDay, spNow.day);
        isToday = countdown.isToday;
        isUpcoming = countdown.isUpcoming;
        isPast = countdown.isPast;
        daysDiff = countdown.diff;
        countdownLabel = countdown.label;
      } else {
        countdownLabel = `${birthDay} de ${monthName.toLowerCase()}`;
      }

      const item: BirthdayStudent = {
        id: s.id,
        full_name: s.full_name,
        nickname: s.nickname || null,
        date_of_birth: s.date_of_birth,
        birthDay,
        birthMonth,
        birthYear,
        turningAge,
        isToday,
        isUpcoming,
        isPast,
        daysDiff,
        countdownLabel,
        whatsapp: s.whatsapp || null,
        guardian_name: s.guardian_name || null,
        guardian_phone: s.guardian_phone || null,
        hasGuardian,
        contactPhone,
        isContactGuardian,
        active: s.active ?? true,
      };

      allForMonth.push(item);

      if (isCurrentMonth) {
        if (isToday) {
          today.push(item);
        } else if (isUpcoming) {
          upcoming.push(item);
        } else if (isPast) {
          past.push(item);
        }
      }
    }

    // Sort allForMonth by day ascending
    allForMonth.sort((a, b) => a.birthDay - b.birthDay);

    // Sort upcoming by birthDay ascending (closest day first)
    upcoming.sort((a, b) => a.birthDay - b.birthDay);

    // Sort past by birthDay ascending
    past.sort((a, b) => a.birthDay - b.birthDay);

    return {
      selectedMonth,
      selectedYear,
      monthName,
      isCurrentMonth,
      allForMonth,
      today,
      upcoming,
      past,
      totalInMonth: allForMonth.length,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Cadastro Manual de Aluno (Sem Auth/Sem Senha Falsa)
  // -------------------------------------------------------------
  async addStudent(params: {
    fullName: string;
    nickname?: string;
    dateOfBirth: string;
    address: string;
    whatsapp?: string;
    guardianName?: string;
    guardianPhone?: string;
    registrationType?: 'self_registered' | 'admin_created';
    isScholarship?: boolean;
    dueDay?: number | null;
    monthlyFeeAmount?: number | null;
  }): Promise<Student> {
    const cleanWhatsApp = params.whatsapp ? normalizePhone(params.whatsapp) : null;
    const nowIso = new Date().toISOString();

    const newStudent: Record<string, any> = {
      full_name: params.fullName.trim(),
      nickname: params.nickname?.trim() || null,
      date_of_birth: params.dateOfBirth,
      address: params.address.trim(),
      whatsapp: params.whatsapp?.trim() || null,
      whatsapp_normalized: cleanWhatsApp,
      role: 'student',
      active: true,
      is_scholarship: Boolean(params.isScholarship),
      monthly_fee_amount: params.monthlyFeeAmount ?? 0,
      due_day: params.dueDay || 10,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let { data, error } = await supabase
      .from('profiles')
      .insert(newStudent)
      .select('*')
      .single();

    if (error && (error.message?.includes('is_scholarship') || error.message?.includes('due_day') || error.message?.includes('monthly_fee_amount'))) {
      const fallback = { ...newStudent };
      delete fallback.monthly_fee_amount;
      delete fallback.due_day;
      delete fallback.is_scholarship;
      const res = await supabase.from('profiles').insert(fallback).select('*').single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('Erro ao adicionar aluno na tabela profiles:', error);
      throw error;
    }

    return {
      ...data,
      guardian_name: params.guardianName || null,
      guardian_phone: params.guardianPhone || null,
    } as Student;
  },

  // -------------------------------------------------------------
  // ADMIN: Atualizar Dados do Aluno (Fonte Oficial: public.profiles)
  // -------------------------------------------------------------
  async updateStudent(
    studentId: string,
    params: {
      fullName: string;
      nickname?: string;
      dateOfBirth: string;
      address: string;
      whatsapp?: string;
      guardianName?: string;
      guardianPhone?: string;
      active?: boolean;
      isScholarship?: boolean;
      dueDay?: number | null;
      feeAmount?: number | null;
      financialStartDate?: string | null;
    }
  ): Promise<any> {
    const cleanWhatsApp = params.whatsapp ? normalizePhone(params.whatsapp) : null;
    const nowIso = new Date().toISOString();

    const finalFee = params.isScholarship
      ? 0
      : params.feeAmount !== undefined && params.feeAmount !== null
      ? Number(params.feeAmount)
      : 0;
    const finalDueDay =
      params.dueDay !== undefined && params.dueDay !== null && !isNaN(Number(params.dueDay))
        ? Number(params.dueDay)
        : null;
    const finalScholarship = Boolean(params.isScholarship);

    // Constrói estritamente com os campos reais existentes na tabela public.profiles
    const updatePayload: Record<string, any> = {
      full_name: params.fullName.trim(),
      nickname: params.nickname?.trim() || null,
      date_of_birth: params.dateOfBirth || null,
      address: params.address.trim(),
      whatsapp: params.whatsapp?.trim() || null,
      whatsapp_normalized: cleanWhatsApp,
      monthly_fee_amount: finalFee,
      due_day: finalDueDay,
      is_scholarship: finalScholarship,
      updated_at: nowIso,
    };

    if (params.active !== undefined) {
      updatePayload.active = params.active;
    }

    let { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', studentId)
      .select('*')
      .single();

    if (error) {
      console.warn('Erro ao atualizar profiles com campos financeiros, tentando atualizar campos base:', error.message);
      const fallback = { ...updatePayload };
      delete fallback.monthly_fee_amount;
      delete fallback.due_day;
      delete fallback.is_scholarship;
      const res = await supabase.from('profiles').update(fallback).eq('id', studentId).select('*').single();
      if (res.error) {
        throw new Error(res.error.message || error.message);
      }
      data = res.data;
    }

    const updatedProfile = {
      ...data,
      id: studentId,
      full_name: params.fullName.trim(),
      nickname: params.nickname?.trim() || data?.nickname || null,
      date_of_birth: params.dateOfBirth || data?.date_of_birth || null,
      guardian_name: params.guardianName || data?.guardian_name || null,
      guardian_phone: params.guardianPhone || data?.guardian_phone || null,
      monthly_fee_amount: finalFee,
      due_day: finalDueDay,
      is_scholarship: finalScholarship,
      active: params.active ?? data?.active ?? true,
    };

    // Dispara sincronização imediata em todo o app (Admin e Aluno)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('capoeira:financial_updated', {
          detail: { studentId, updated: updatedProfile },
        })
      );
    }

    return updatedProfile;
  },

  // -------------------------------------------------------------
  // ADMIN: Perfil Detalhado do Aluno
  // -------------------------------------------------------------
  async getStudentProfileWithDetails(studentId: string) {
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .single();

    if (pErr) throw pErr;
    const studentRecord = {
      ...profile,
      role: profile.role || 'student',
      monthly_fee_amount: Number(profile.monthly_fee_amount) || 0,
    };

    const [feesRes, debtsRes, paymentsRes, movementsRes, notesRes, deletedReg] = await Promise.all([
      supabase.from('monthly_fees').select('*').eq('student_id', studentId).order('due_date', { ascending: false }),
      supabase.from('product_debts').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', studentId).order('paid_at', { ascending: false }),
      supabase.from('financial_movements').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('internal_notes').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      getDeletedRecordsRegistry(),
    ]);

    const fees = ((feesRes.data || []) as MonthlyFee[]).filter(
      (f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
    );
    const debts = ((debtsRes.data || []) as ProductDebt[]).filter(
      (d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id)
    );
    const activeFeeIds = new Set<string>(fees.map((f) => f.id));
    const activeDebtIds = new Set<string>(debts.map((d) => d.id));
    const payments = ((paymentsRes.data || []) as Payment[]).filter((p: any) =>
      isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds)
    );
    const movements = ((movementsRes.data || []) as FinancialMovement[]).filter((m: any) => {
      if (m.deleted_at) return false;
      if (m.reference_id && (deletedReg.paymentIds.has(m.reference_id) || deletedReg.feeIds.has(m.reference_id) || deletedReg.debtIds.has(m.reference_id))) {
        return false;
      }
      return true;
    });
    const notes = (notesRes.data || []) as InternalNote[];

    const openFees = fees.filter((f) => f.status !== 'paid' && f.status !== 'cancelled');
    const openDebts = debts.filter((d) => d.status !== 'paid' && d.status !== 'cancelled');

    const totalOpenFees = openFees.reduce((sum, f) => sum + (Number(f.remaining_amount) || 0), 0);
    const totalOpenDebts = openDebts.reduce((sum, d) => sum + (Number(d.remaining_amount) || 0), 0);
    const totalOpen = totalOpenFees + totalOpenDebts;

    const lastPayment = payments.length > 0 ? payments[0] : null;

    return {
      profile: studentRecord as Student & Profile,
      fees,
      openFees,
      debts,
      openDebts,
      payments,
      movements,
      notes,
      totalOpen,
      totalOpenFees,
      totalOpenDebts,
      lastPayment,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Adicionar Mensalidade (Persistência Real no Supabase)
  // -------------------------------------------------------------
  async addMonthlyFee(params: {
    studentId: string;
    referenceMonth: string;
    description?: string;
    amount: number;
    dueDate: string;
    isScholarship?: boolean;
    status?: 'pending' | 'paid' | 'scholarship';
    notes?: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<MonthlyFee> {
    if (!params.studentId || !params.studentId.trim()) {
      throw new Error('Identificador do aluno é obrigatório.');
    }
    if (!params.referenceMonth || !params.referenceMonth.trim()) {
      throw new Error('Data ou mês de referência é obrigatório.');
    }
    if (!params.dueDate || !params.dueDate.trim()) {
      throw new Error('Data de vencimento é obrigatória.');
    }

    const targetStudentId = await this.ensureStudentId(params.studentId);

    // 1. Validar existência real do aluno em public.profiles
    const { data: studentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetStudentId)
      .maybeSingle();

    if (profileErr) {
      console.error('[addMonthlyFee] Erro ao validar aluno no banco:', profileErr);
      throw new Error(`Erro ao validar aluno no banco: ${profileErr.message}`);
    }
    if (!studentProfile) {
      throw new Error(`Aluno com ID ${targetStudentId} não foi encontrado em public.profiles.`);
    }

    // 2. Normalização de datas e competência
    const cleanRef = (params.referenceMonth || '').trim();
    const yearMonth = toReferenceYearMonth(cleanRef);
    const refMonth = toReferenceMonthIso(cleanRef); // Sempre ISO YYYY-MM-01
    const monthLabel = deriveReferenceMonth(refMonth);
    const desc = params.description?.trim() || `Mensalidade ${monthLabel}`;

    let cleanDueDate = toIsoDateString(params.dueDate);
    if (!cleanDueDate) {
      const dueDay = studentProfile.due_day || 10;
      cleanDueDate = `${yearMonth}-${String(dueDay).padStart(2, '0')}`;
    }

    // 3. Regras de Bolsista e Valores
    const isScholarship = Boolean(
      params.isScholarship ||
      params.status === 'scholarship' ||
      studentProfile.is_scholarship
    );

    const rawAmount = Number(params.amount);
    const effectiveAmount = isScholarship ? 0 : (isNaN(rawAmount) ? 0 : Math.max(0, rawAmount));

    if (!isScholarship && effectiveAmount <= 0) {
      throw new Error('Configure o valor mensal deste aluno antes de lançar o pagamento.');
    }

    const isPaid = !isScholarship && params.status === 'paid';
    const nowIso = new Date().toISOString();

    let dbStatus: 'pending' | 'paid' | 'overdue' = 'pending';
    if (isPaid) {
      dbStatus = 'paid';
    } else if (!isScholarship && isOverdue(cleanDueDate, effectiveAmount)) {
      dbStatus = 'overdue';
    } else {
      dbStatus = 'pending';
    }

    const amountPaid = isPaid ? effectiveAmount : 0;
    const remainingAmount = isPaid ? 0 : effectiveAmount;

    let cleanNotes = params.notes?.trim() || null;
    if (isScholarship && (!cleanNotes || !cleanNotes.includes('[BOLSISTA]'))) {
      cleanNotes = cleanNotes ? `[BOLSISTA] ${cleanNotes}` : '[BOLSISTA] Aluno isento de mensalidade';
    }

    // 4. NÃO DUPLICAR: Verificar se já existe mensalidade para esse aluno e competência
    const { data: existingFees, error: fetchErr } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('student_id', studentProfile.id)
      .neq('status', 'cancelled');

    if (fetchErr) {
      console.error('[addMonthlyFee] Erro ao verificar duplicidade no banco:', fetchErr);
      throw new Error(`Erro ao verificar duplicidade: ${fetchErr.message}`);
    }

    const existing = (existingFees || []).find((f) => {
      const fRef = (f.reference_month || '').substring(0, 7);
      return fRef === yearMonth;
    });

    let finalFee: MonthlyFee;

    if (existing) {
      // Atualizar mensalidade existente
      const updatePayload: Record<string, any> = {
        description: desc,
        amount: effectiveAmount,
        amount_paid: isPaid ? effectiveAmount : existing.amount_paid,
        remaining_amount: isPaid ? 0 : Math.max(0, effectiveAmount - Number(existing.amount_paid || 0)),
        due_date: cleanDueDate,
        status: isPaid ? 'paid' : (Number(existing.amount_paid) > 0 ? 'partial' : dbStatus),
        notes: cleanNotes,
        updated_at: nowIso,
      };
      if (isPaid) {
        updatePayload.paid_at = existing.paid_at || nowIso;
      }

      const { data: updatedFee, error: updateErr } = await supabase
        .from('monthly_fees')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updateErr || !updatedFee) {
        console.error('[addMonthlyFee] Erro ao atualizar mensalidade existente:', updateErr);
        throw new Error(`Erro ao atualizar mensalidade existente: ${updateErr?.message || 'Falha no banco'}`);
      }
      finalFee = updatedFee;
    } else {
      // Criar nova mensalidade
      const insertPayload: Record<string, any> = {
        student_id: studentProfile.id,
        reference_month: refMonth,
        description: desc,
        amount: effectiveAmount,
        amount_paid: amountPaid,
        remaining_amount: remainingAmount,
        due_date: cleanDueDate,
        status: dbStatus,
        notes: cleanNotes,
        paid_at: isPaid ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (params.adminId && isUuid(params.adminId)) {
        insertPayload.created_by = params.adminId;
      }

      let { data: insertedFee, error: insertErr } = await supabase
        .from('monthly_fees')
        .insert(insertPayload)
        .select('*')
        .single();

      // Retry sem created_by se violar FK
      if (insertErr && insertPayload.created_by) {
        delete insertPayload.created_by;
        const retryRes = await supabase
          .from('monthly_fees')
          .insert(insertPayload)
          .select('*')
          .single();
        insertedFee = retryRes.data;
        insertErr = retryRes.error;
      }

      if (insertErr || !insertedFee) {
        console.error('[addMonthlyFee] Erro ao inserir mensalidade:', insertErr);
        throw new Error(`Erro ao persistir mensalidade no banco: ${insertErr?.message || 'Falha ao salvar'}`);
      }
      finalFee = insertedFee;
    }

    // 5. Se foi marcada como PAGA no momento do lançamento, cria o payment oficial
    if (isPaid && effectiveAmount > 0) {
      const { data: existingPay } = await supabase
        .from('payments')
        .select('id')
        .eq('monthly_fee_id', finalFee.id)
        .maybeSingle();

      if (!existingPay) {
        const paymentPayload: Record<string, any> = {
          student_id: studentProfile.id,
          payment_type: 'monthly_fee',
          monthly_fee_id: finalFee.id,
          amount: effectiveAmount,
          payment_method: 'dinheiro',
          notes: 'Pago no momento do lançamento da mensalidade',
          paid_at: nowIso,
          created_at: nowIso,
        };

        if (params.adminId && isUuid(params.adminId)) {
          paymentPayload.recorded_by = params.adminId;
        }
        if (params.adminEmail) {
          paymentPayload.recorded_by_email = params.adminEmail;
        }

        const { error: payErr } = await supabase.from('payments').insert(paymentPayload);
        if (payErr && paymentPayload.recorded_by) {
          delete paymentPayload.recorded_by;
          await supabase.from('payments').insert(paymentPayload);
        }
      }
    }

    // 6. Sincroniza bolsista ou vencimento no perfil
    if (isScholarship && !studentProfile.is_scholarship) {
      try {
        await supabase
          .from('profiles')
          .update({ is_scholarship: true, updated_at: nowIso })
          .eq('id', studentProfile.id);
      } catch {}
    }

    // 7. Registro de Movimento de Auditoria
    try {
      const movPayload: Record<string, any> = {
        student_id: studentProfile.id,
        type: isPaid ? 'PAYMENT' : 'MONTHLY_FEE_CREATED',
        reference_type: 'monthly_fee',
        reference_id: finalFee.id,
        description: isPaid
          ? `Mensalidade ${monthLabel} lançada como PAGA`
          : `Mensalidade ${monthLabel} lançada (${formatCurrency(effectiveAmount)})`,
        previous_amount: existing ? Number(existing.amount) : 0,
        movement_amount: effectiveAmount,
        new_amount: isPaid ? 0 : effectiveAmount,
        notes: cleanNotes || (isPaid ? 'Lançamento com quitação' : 'Lançamento de mensalidade'),
        created_at: nowIso,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      if (params.adminEmail) {
        movPayload.performed_by_email = params.adminEmail;
      }

      const { error: movErr } = await supabase.from('financial_movements').insert(movPayload);
      if (movErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch (movErr) {
      console.warn('[addMonthlyFee] Auditoria não pôde ser gravada:', movErr);
    }

    // 8. Disparo de sincronização global imediata
    notifyFinancialUpdated({ studentId: studentProfile.id, feeId: finalFee.id });

    return finalFee;
  },

  // -------------------------------------------------------------
  // ADMIN: Atualizar / Editar Mensalidade (Valor, Vencimento, Status, Notas)
  // -------------------------------------------------------------
  async updateMonthlyFee(params: {
    feeId: string;
    studentId: string;
    amount?: number;
    dueDate?: string;
    status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
    notes?: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<MonthlyFee> {
    if (!params.feeId) {
      throw new Error('Identificador da mensalidade não informado.');
    }

    const targetStudentId = await this.ensureStudentId(params.studentId);
    const nowIso = new Date().toISOString();

    const { data: fee, error: feeErr } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('id', params.feeId)
      .single();

    if (feeErr || !fee) {
      throw new Error(`Mensalidade não encontrada (ID: ${params.feeId}).`);
    }

    const prevAmount = Number(fee.amount);
    const newAmount = params.amount !== undefined ? Math.max(0, Number(params.amount)) : prevAmount;
    const cleanDueDate = params.dueDate ? toIsoDateString(params.dueDate) : fee.due_date;
    const newStatus = params.status || fee.status;

    let newPaid = Number(fee.amount_paid || 0);
    let newRemaining = Number(fee.remaining_amount || 0);
    let paidAt = fee.paid_at;

    if (newStatus === 'paid') {
      newPaid = newAmount;
      newRemaining = 0;
      paidAt = fee.paid_at || nowIso;
    } else if (newStatus === 'pending' || newStatus === 'overdue') {
      newPaid = 0;
      newRemaining = newAmount;
      paidAt = null;
    } else {
      newRemaining = Math.max(0, Number((newAmount - newPaid).toFixed(2)));
    }

    const updatePayload: Record<string, any> = {
      amount: newAmount,
      amount_paid: newPaid,
      remaining_amount: newRemaining,
      due_date: cleanDueDate,
      status: newStatus,
      notes: params.notes !== undefined ? (params.notes.trim() || null) : fee.notes,
      paid_at: paidAt,
      updated_at: nowIso,
    };

    const { data: updatedFee, error: updErr } = await supabase
      .from('monthly_fees')
      .update(updatePayload)
      .eq('id', fee.id)
      .select('*')
      .single();

    if (updErr || !updatedFee) {
      throw new Error(`Erro ao atualizar mensalidade no banco: ${updErr?.message || 'Falha no banco'}`);
    }

    // Se passou a ser PAGO e não tinha payment registrado, cria o payment oficial
    if (newStatus === 'paid' && newAmount > 0) {
      const { data: existingPay } = await supabase
        .from('payments')
        .select('id')
        .eq('monthly_fee_id', fee.id)
        .maybeSingle();

      if (!existingPay) {
        const payPayload: Record<string, any> = {
          student_id: targetStudentId,
          payment_type: 'monthly_fee',
          monthly_fee_id: fee.id,
          amount: newAmount,
          payment_method: 'dinheiro',
          notes: 'Pago via edição de mensalidade',
          paid_at: nowIso,
          created_at: nowIso,
        };
        if (params.adminId && isUuid(params.adminId)) {
          payPayload.recorded_by = params.adminId;
        }
        if (params.adminEmail) {
          payPayload.recorded_by_email = params.adminEmail;
        }

        const { error: payErr } = await supabase.from('payments').insert(payPayload);
        if (payErr && payPayload.recorded_by) {
          delete payPayload.recorded_by;
          await supabase.from('payments').insert(payPayload);
        }
      }
    }

    // Auditoria
    try {
      const movPayload: Record<string, any> = {
        student_id: targetStudentId,
        type: newStatus === 'paid' ? 'PAYMENT' : 'ADJUSTMENT',
        reference_type: 'monthly_fee',
        reference_id: fee.id,
        description: `Mensalidade ${fee.reference_month} editada: ${formatCurrency(newAmount)} (${newStatus})`,
        previous_amount: prevAmount,
        movement_amount: Math.abs(newAmount - prevAmount),
        new_amount: newRemaining,
        notes: params.notes || 'Edição manual de mensalidade',
        created_at: nowIso,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      if (params.adminEmail) {
        movPayload.performed_by_email = params.adminEmail;
      }
      const { error: movErr } = await supabase.from('financial_movements').insert(movPayload);
      if (movErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch {}

    notifyFinancialUpdated({ studentId: targetStudentId, feeId: fee.id });
    return updatedFee;
  },

  // -------------------------------------------------------------
  // ADMIN: Gerar Mensalidades do Mês em Lote
  // -------------------------------------------------------------
  async generateMonthlyFeesBatch(params: {
    referenceMonth: string;
    defaultAmount: number;
    dueDay: number;
    adminId?: string;
    adminEmail?: string;
  }): Promise<{ createdCount: number; skippedCount: number }> {
    // 1. Obter alunos ativos da tabela public.profiles
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .eq('active', true);

    let activeStudents = profs || [];

    if (activeStudents.length === 0) {
      const { data: profsFallback } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('active', true);
      activeStudents = profsFallback || [];
    }

    if (activeStudents.length === 0) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // 2. Verificar mensalidades já existentes neste mês para evitar duplicidade
    const { data: existingFees } = await supabase
      .from('monthly_fees')
      .select('student_id')
      .eq('reference_month', params.referenceMonth.trim());

    const existingStudentIds = new Set((existingFees || []).map((f) => f.student_id));

    // Calcular data de vencimento (YYYY-MM-DD)
    const today = new Date();
    const [monthName, yearStr] = params.referenceMonth.split('/');
    let targetYear = today.getFullYear();
    let targetMonth = today.getMonth() + 1; // 1-indexed

    if (yearStr && !isNaN(Number(yearStr))) {
      targetYear = Number(yearStr);
    }
    // Converter nome do mês em pt-BR
    const ptMonths = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    if (monthName) {
      const idx = ptMonths.findIndex((m) => monthName.toLowerCase().includes(m));
      if (idx !== -1) {
        targetMonth = idx + 1;
      }
    }

    const dueDayPadded = String(Math.min(params.dueDay, 28)).padStart(2, '0');
    const targetMonthPadded = String(targetMonth).padStart(2, '0');
    const dueDate = `${targetYear}-${targetMonthPadded}-${dueDayPadded}`;

    let createdCount = 0;
    let skippedCount = 0;

    for (const student of activeStudents) {
      if (existingStudentIds.has(student.id)) {
        skippedCount++;
        continue;
      }

      // 1. Bolsista: mensalidade zerada ou isenta
      const isScholarship = Boolean(student.is_scholarship);
      // 2. Valor: A configuração individual do aluno é a ÚNICA fonte de verdade
      const configuredFee = isScholarship
        ? 0
        : (Number(student.monthly_fee_amount ?? (student as any).fee_amount) || params.defaultAmount);
      // 3. Dia de vencimento: configuração individual do aluno
      const studentDueDay = Number(student.due_day) || params.dueDay || 10;
      const studentDueDayPadded = String(Math.min(studentDueDay, 28)).padStart(2, '0');
      const studentDueDate = `${targetYear}-${targetMonthPadded}-${studentDueDayPadded}`;

      try {
        await this.addMonthlyFee({
          studentId: student.id,
          referenceMonth: params.referenceMonth,
          description: `Mensalidade ${params.referenceMonth.trim()}`,
          amount: configuredFee,
          dueDate: studentDueDate,
          notes: isScholarship ? '[BOLSISTA] Isento de mensalidade' : 'Gerada em lote pelo sistema',
          adminId: params.adminId,
          adminEmail: params.adminEmail,
        });

        createdCount++;
      } catch (genErr) {
        console.warn(`Erro ao gerar mensalidade para aluno ${student.id}:`, genErr);
      }
    }

    return { createdCount, skippedCount };
  },

  // -------------------------------------------------------------
  // ADMIN: Adicionar Produto em Débito
  // -------------------------------------------------------------
  async addProductDebt(params: {
    studentId: string;
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    adminId?: string;
    adminEmail?: string;
  }) {
    if (params.quantity <= 0) {
      throw new Error('A quantidade de produtos deve ser maior que zero.');
    }
    if (params.unitPrice < 0) {
      throw new Error('O preço unitário não pode ser negativo.');
    }

    const targetStudentId = await this.ensureStudentId(params.studentId);
    const totalAmount = Number((params.quantity * params.unitPrice).toFixed(2));

    const debtPayload: Record<string, any> = {
      student_id: targetStudentId,
      product_id: params.productId || null,
      product_name_snapshot: params.productName.trim(),
      quantity: params.quantity,
      unit_price: params.unitPrice,
      total_amount: totalAmount,
      amount_paid: 0,
      remaining_amount: totalAmount,
      status: 'open',
      notes: params.notes?.trim() || null,
    };
    if (params.adminId && isUuid(params.adminId)) {
      debtPayload.created_by = params.adminId;
    }

    let { data: debt, error: dErr } = await supabase
      .from('product_debts')
      .insert(debtPayload)
      .select('*')
      .single();

    if (dErr && debtPayload.created_by) {
      delete debtPayload.created_by;
      const retryDebt = await supabase
        .from('product_debts')
        .insert(debtPayload)
        .select('*')
        .single();
      debt = retryDebt.data;
      dErr = retryDebt.error;
    }

    if (dErr || !debt) throw dErr || new Error('Erro ao criar débito de produto');

    // Registrar no histórico / auditoria sem travar
    try {
      const movPayload: Record<string, any> = {
        student_id: targetStudentId,
        type: 'PRODUCT_DEBT_CREATED',
        reference_type: 'product_debt',
        reference_id: debt.id,
        description: `Produto adicionado: ${params.productName.trim()} (${params.quantity}x)`,
        previous_amount: 0,
        movement_amount: totalAmount,
        new_amount: totalAmount,
        performed_by_email: params.adminEmail || null,
        notes: params.notes || null,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
      if (mErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch (auditErr) {
      console.warn('Aviso: auditoria do débito de produto não pôde ser gravada:', auditErr);
    }

    notifyFinancialUpdated({ studentId: targetStudentId, debtId: debt.id });

    return debt as ProductDebt;
  },

  // -------------------------------------------------------------
  // ADMIN: Dar Baixa / Registrar Pagamento
  // -------------------------------------------------------------
  async recordPayment(params: {
    studentId: string;
    paymentType: 'monthly_fee' | 'product';
    monthlyFeeId?: string | null;
    productDebtId?: string | null;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    adminId?: string;
    adminEmail?: string;
  }) {
    if (params.amount <= 0) {
      throw new Error('O valor do pagamento deve ser maior que zero.');
    }

    const targetStudentId = await this.ensureStudentId(params.studentId);
    const nowIso = new Date().toISOString();

    // 1. Se for mensalidade
    if (params.paymentType === 'monthly_fee') {
      if (!params.monthlyFeeId) {
        throw new Error('Identificador da mensalidade não informado.');
      }

      const { data: fee, error: feeErr } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('id', params.monthlyFeeId)
        .single();

      if (feeErr || !fee) {
        throw new Error('Mensalidade não encontrada.');
      }

      const currentRemaining = Number(fee.remaining_amount);

      if (params.amount > currentRemaining + 0.001) {
        throw new Error('O valor informado é maior que o saldo em aberto.');
      }

      const newRemaining = Math.max(0, Number((currentRemaining - params.amount).toFixed(2)));
      const newPaid = Number((Number(fee.amount_paid) + params.amount).toFixed(2));
      const newStatus = newRemaining === 0 ? 'paid' : 'partial';

      const { error: updateErr } = await supabase
        .from('monthly_fees')
        .update({
          amount_paid: newPaid,
          remaining_amount: newRemaining,
          status: newStatus,
          paid_at: newRemaining === 0 ? nowIso : fee.paid_at,
          updated_at: nowIso,
        })
        .eq('id', params.monthlyFeeId);

      if (updateErr) throw updateErr;

      // Inserir registro na tabela payments
      const feePayPayload: Record<string, any> = {
        student_id: targetStudentId,
        payment_type: 'monthly_fee',
        monthly_fee_id: params.monthlyFeeId,
        amount: params.amount,
        payment_method: params.paymentMethod,
        notes: params.notes?.trim() || null,
        recorded_by_email: params.adminEmail || null,
        paid_at: nowIso,
      };
      if (isUuid(params.adminId)) {
        feePayPayload.recorded_by = params.adminId;
      }

      let { data: payment, error: pErr } = await supabase
        .from('payments')
        .insert(feePayPayload)
        .select('*')
        .single();

      if (pErr && feePayPayload.recorded_by) {
        delete feePayPayload.recorded_by;
        const retryPay = await supabase
          .from('payments')
          .insert(feePayPayload)
          .select('*')
          .single();
        payment = retryPay.data;
        pErr = retryPay.error;
      }

      if (pErr || !payment) throw pErr || new Error('Erro ao registrar pagamento');

      // Registrar movimento de auditoria
      try {
        await supabase.from('financial_movements').insert({
          student_id: targetStudentId,
          type: 'PAYMENT',
          reference_type: 'payment',
          reference_id: payment.id,
          description: `Pagamento registrado: Mensalidade ${fee.reference_month} (${params.paymentMethod.toUpperCase()})`,
          previous_amount: currentRemaining,
          movement_amount: params.amount,
          new_amount: newRemaining,
          performed_by: isUuid(params.adminId) ? params.adminId : null,
          performed_by_email: params.adminEmail || null,
          notes: params.notes || null,
        });
      } catch (moveErr) {
        console.warn('Aviso: auditoria do pagamento não pôde ser gravada:', moveErr);
      }

      let nextFeeCreated: MonthlyFee | null = null;

      // PARTE 1 — MENSALIDADE RECORRENTE AUTOMÁTICA
      // Somente se a mensalidade ficou TOTALMENTE PAGA (newRemaining === 0)
      if (newRemaining === 0) {
        try {
          const { data: stdRecord } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetStudentId)
            .maybeSingle();

          const isScholarshipStudent = Boolean(
            stdRecord?.is_scholarship ||
            fee.is_scholarship ||
            fee.status === 'scholarship' ||
            (fee.notes && fee.notes.includes('[BOLSISTA]'))
          );

          // Se for bolsista, não gera cobrança automática de mensalidade
          if (!isScholarshipStudent) {
            const { nextReferenceMonth, nextDueDate, nextDescription } = getNextMonthlyFeeDetails(
              fee.reference_month,
              fee.due_date,
              stdRecord?.due_day
            );

            // Verificar se já existe mensalidade para esse aluno no próximo ciclo
            const { data: existingFees } = await supabase
              .from('monthly_fees')
              .select('id, reference_month, status, due_date')
              .eq('student_id', targetStudentId);

            const alreadyExists = (existingFees || []).some((f) => {
              if (f.status === 'cancelled') return false;
              const ref = (f.reference_month || '').toLowerCase().trim();
              const target = nextReferenceMonth.toLowerCase().trim();
              return ref === target || ref.includes(target) || target.includes(ref) || f.due_date === nextDueDate;
            });

            const todayStr = getTodayLocalDateString();
            const daysToNext =
              (new Date(nextDueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24);

            // Só cria automaticamente se não existir e se estiver dentro da janela de até 35 dias
            if (!alreadyExists && daysToNext <= 35) {
              // Cria a próxima mensalidade usando OBRIGATORIAMENTE a configuração do aluno
              const studentNextAmount = Number(stdRecord?.monthly_fee_amount) || Number(fee.amount);
              const newFeePayload: Record<string, any> = {
                student_id: targetStudentId,
                reference_month: nextReferenceMonth,
                description: nextDescription,
                amount: studentNextAmount,
                amount_paid: 0,
                remaining_amount: studentNextAmount,
                due_date: nextDueDate,
                status: 'pending',
                notes: 'Gerada automaticamente após quitação da mensalidade anterior.',
                created_by: params.adminId || null,
              };

              let { data: newNextFee, error: nextFeeErr } = await supabase
                .from('monthly_fees')
                .insert({
                  ...newFeePayload,
                  auto_generated_from_fee_id: fee.id,
                })
                .select('*')
                .maybeSingle();

              // Se falhou com auto_generated_from_fee_id (coluna pode não existir)
              if (nextFeeErr) {
                const resRetry = await supabase
                  .from('monthly_fees')
                  .insert(newFeePayload)
                  .select('*')
                  .maybeSingle();
                newNextFee = resRetry.data;
                nextFeeErr = resRetry.error;

                if (nextFeeErr && (nextFeeErr.message?.includes('status') || nextFeeErr.code === '23514')) {
                  const resOpen = await supabase
                    .from('monthly_fees')
                    .insert({ ...newFeePayload, status: 'open' })
                    .select('*')
                    .maybeSingle();
                  newNextFee = resOpen.data;
                }
              }

              if (newNextFee) {
                nextFeeCreated = newNextFee as MonthlyFee;

                try {
                  await supabase.from('financial_movements').insert({
                    student_id: targetStudentId,
                    type: 'MONTHLY_FEE_CREATED',
                    reference_type: 'monthly_fee',
                    reference_id: newNextFee.id,
                    description: `Mensalidade ${nextReferenceMonth} gerada automaticamente`,
                    previous_amount: 0,
                    movement_amount: fee.amount,
                    new_amount: fee.amount,
                    performed_by: params.adminId || null,
                    performed_by_email: params.adminEmail || null,
                    notes: 'Gerada automaticamente após quitação da mensalidade anterior.',
                  });
                } catch (auditErr) {
                  console.warn('Aviso: auditoria da mensalidade automática não pôde ser gravada:', auditErr);
                }
              }
            }
          }
        } catch (autoErr) {
          console.error('Erro na geração automática da próxima mensalidade:', autoErr);
        }
      }

      notifyFinancialUpdated({ studentId: targetStudentId, paymentId: payment.id, feeId: fee.id });

      return {
        payment: payment as Payment,
        nextFeeCreated,
      };
    }

    // 2. Se for débito de produto
    if (params.paymentType === 'product') {
      if (!params.productDebtId) {
        throw new Error('Identificador do débito do produto não informado.');
      }

      const { data: debt, error: debtErr } = await supabase
        .from('product_debts')
        .select('*')
        .eq('id', params.productDebtId)
        .single();

      if (debtErr || !debt) {
        throw new Error('Débito de produto não encontrado.');
      }

      const currentRemaining = Number(debt.remaining_amount);

      if (params.amount > currentRemaining + 0.001) {
        throw new Error('O valor informado é maior que o saldo em aberto.');
      }

      const newRemaining = Math.max(0, Number((currentRemaining - params.amount).toFixed(2)));
      const newPaid = Number((Number(debt.amount_paid) + params.amount).toFixed(2));
      const newStatus = newRemaining === 0 ? 'paid' : 'partial';

      const { error: updateErr } = await supabase
        .from('product_debts')
        .update({
          amount_paid: newPaid,
          remaining_amount: newRemaining,
          status: newStatus,
          paid_at: newRemaining === 0 ? nowIso : debt.paid_at,
          updated_at: nowIso,
        })
        .eq('id', params.productDebtId);

      if (updateErr) throw updateErr;

      // Inserir registro na tabela payments
      const prodPayPayload: Record<string, any> = {
        student_id: targetStudentId,
        payment_type: 'product',
        product_debt_id: params.productDebtId,
        amount: params.amount,
        payment_method: params.paymentMethod,
        notes: params.notes?.trim() || null,
        recorded_by_email: params.adminEmail || null,
        paid_at: nowIso,
      };
      if (isUuid(params.adminId)) {
        prodPayPayload.recorded_by = params.adminId;
      }

      let { data: payment, error: pErr } = await supabase
        .from('payments')
        .insert(prodPayPayload)
        .select('*')
        .single();

      if (pErr && prodPayPayload.recorded_by) {
        delete prodPayPayload.recorded_by;
        const retryPay = await supabase
          .from('payments')
          .insert(prodPayPayload)
          .select('*')
          .single();
        payment = retryPay.data;
        pErr = retryPay.error;
      }

      if (pErr || !payment) throw pErr || new Error('Erro ao registrar pagamento de produto');

      // Registrar movimento de auditoria
      try {
        await supabase.from('financial_movements').insert({
          student_id: targetStudentId,
          type: 'PAYMENT',
          reference_type: 'payment',
          reference_id: payment.id,
          description: `Pagamento registrado: Produto ${debt.product_name_snapshot} (${params.paymentMethod.toUpperCase()})`,
          previous_amount: currentRemaining,
          movement_amount: params.amount,
          new_amount: newRemaining,
          performed_by: isUuid(params.adminId) ? params.adminId : null,
          performed_by_email: params.adminEmail || null,
          notes: params.notes || null,
        });
      } catch (auditErr) {
        console.warn('Aviso: auditoria do pagamento de produto não pôde ser gravada:', auditErr);
      }

      notifyFinancialUpdated({ studentId: targetStudentId, paymentId: payment.id, debtId: debt.id });

      return {
        payment: payment as Payment,
        nextFeeCreated: null,
      };
    }

    throw new Error('Tipo de pagamento inválido.');
  },

  // -------------------------------------------------------------
  // ADMIN: Reverter / Desfazer Pagamento (PARTE 2)
  // -------------------------------------------------------------
  async revertPayment(params: {
    paymentId: string;
    reason: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<{
    payment: Payment;
    nextFeeCancelled: boolean;
    nextFeeWarning?: string;
  }> {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('O motivo da reversão é obrigatório.');
    }

    const nowIso = new Date().toISOString();

    // 1. Obter o pagamento original
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', params.paymentId)
      .single();

    if (pErr || !payment) {
      throw new Error('Pagamento não encontrado.');
    }

    if (payment.status === 'reversed') {
      throw new Error('Este pagamento já foi revertido anteriormente.');
    }

    let nextFeeCancelled = false;
    let nextFeeWarning: string | undefined = undefined;

    // 2. Se o pagamento for de MENSALIDADE
    if (payment.payment_type === 'monthly_fee' && payment.monthly_fee_id) {
      const { data: fee, error: fErr } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('id', payment.monthly_fee_id)
        .single();

      if (fErr || !fee) {
        throw new Error('Mensalidade vinculada ao pagamento não encontrada.');
      }

      const paymentAmount = Number(payment.amount);
      const currentPaid = Number(fee.amount_paid);
      const totalAmount = Number(fee.amount);

      const restoredPaid = Math.max(0, Number((currentPaid - paymentAmount).toFixed(2)));
      const restoredRemaining = Math.max(0, Number((totalAmount - restoredPaid).toFixed(2)));
      const restoredStatus = restoredRemaining === 0 ? 'paid' : restoredPaid > 0 ? 'partial' : 'pending';

      // Atualiza os valores da mensalidade original
      const { error: feeUpErr } = await supabase
        .from('monthly_fees')
        .update({
          amount_paid: restoredPaid,
          remaining_amount: restoredRemaining,
          status: restoredStatus,
          paid_at: restoredRemaining === 0 ? fee.paid_at : null,
          updated_at: nowIso,
        })
        .eq('id', fee.id);

      if (feeUpErr) throw feeUpErr;

      // PARTE 2: REVERSÃO DA MENSALIDADE AUTOMÁTICA
      // Se este pagamento quitou a mensalidade e gerou uma mensalidade automática para o mês seguinte:
      try {
        const { data: linkedFees } = await supabase
          .from('monthly_fees')
          .select('*')
          .eq('student_id', fee.student_id)
          .eq('auto_generated_from_fee_id', fee.id);

        const autoNextFee = linkedFees && linkedFees.length > 0 ? linkedFees[0] : null;

        if (autoNextFee) {
          // Se a mensalidade automática NÃO possui pagamentos posteriores e ainda está pending
          if (Number(autoNextFee.amount_paid) === 0 && autoNextFee.status === 'pending') {
            await supabase
              .from('monthly_fees')
              .update({
                status: 'cancelled',
                notes: 'Mensalidade automática cancelada devido à reversão da quitação anterior.',
                updated_at: nowIso,
              })
              .eq('id', autoNextFee.id);

            await supabase.from('financial_movements').insert({
              student_id: fee.student_id,
              type: 'CANCELLATION',
              reference_type: 'monthly_fee',
              reference_id: autoNextFee.id,
              description: `Cancelamento de mensalidade automática ${autoNextFee.reference_month} por reversão da quitação anterior`,
              previous_amount: autoNextFee.amount,
              movement_amount: autoNextFee.amount,
              new_amount: 0,
              performed_by: params.adminId || null,
              performed_by_email: params.adminEmail || null,
              notes: 'Cancelamento automático decorrente da reversão da mensalidade anterior.',
            });

            nextFeeCancelled = true;
          } else if (Number(autoNextFee.amount_paid) > 0 || autoNextFee.status !== 'cancelled') {
            nextFeeWarning = 'A mensalidade seguinte já possui movimentações ou pagamentos e não pôde ser cancelada automaticamente.';
          }
        }
      } catch (autoErr) {
        console.error('Erro ao verificar mensalidade subsequente:', autoErr);
      }
    }

    // 3. Se o pagamento for de PRODUTO
    if (payment.payment_type === 'product' && payment.product_debt_id) {
      const { data: debt, error: dErr } = await supabase
        .from('product_debts')
        .select('*')
        .eq('id', payment.product_debt_id)
        .single();

      if (dErr || !debt) {
        throw new Error('Débito de produto vinculado não encontrado.');
      }

      const paymentAmount = Number(payment.amount);
      const currentPaid = Number(debt.amount_paid);
      const totalAmount = Number(debt.total_amount);

      const restoredPaid = Math.max(0, Number((currentPaid - paymentAmount).toFixed(2)));
      const restoredRemaining = Math.max(0, Number((totalAmount - restoredPaid).toFixed(2)));
      const restoredStatus = restoredRemaining === 0 ? 'paid' : restoredPaid > 0 ? 'partial' : 'open';

      const { error: debtUpErr } = await supabase
        .from('product_debts')
        .update({
          amount_paid: restoredPaid,
          remaining_amount: restoredRemaining,
          status: restoredStatus,
          paid_at: restoredRemaining === 0 ? debt.paid_at : null,
          updated_at: nowIso,
        })
        .eq('id', debt.id);

      if (debtUpErr) throw debtUpErr;
    }

    // 4. Marca o pagamento como REVERTIDO (NÃO DELETE O HISTÓRICO!)
    const { data: updatedPayment, error: pUpErr } = await supabase
      .from('payments')
      .update({
        status: 'reversed',
        reversed_at: nowIso,
        reversed_by: params.adminId || null,
        reversal_reason: params.reason.trim(),
      })
      .eq('id', payment.id)
      .select('*')
      .single();

    if (pUpErr) throw pUpErr;

    // 5. Inserir movimento de auditoria com type = REVERSAL
    try {
      const movPayload: Record<string, any> = {
        student_id: payment.student_id,
        type: 'REVERSAL',
        reference_type: 'payment',
        reference_id: payment.id,
        description: `Reversão de pagamento de ${formatCurrency(payment.amount)} (${payment.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}). Motivo: ${params.reason.trim()}`,
        previous_amount: payment.amount,
        movement_amount: payment.amount,
        new_amount: 0,
        notes: params.reason.trim(),
        created_at: nowIso,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      if (params.adminEmail) {
        movPayload.performed_by_email = params.adminEmail;
      }
      const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
      if (mErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch {}

    notifyFinancialUpdated({ studentId: payment.student_id, paymentId: payment.id });

    return {
      payment: (updatedPayment || payment) as Payment,
      nextFeeCancelled,
      nextFeeWarning,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Cancelar Mensalidade adicionada por engano
  // -------------------------------------------------------------
  async cancelMonthlyFee(params: {
    feeId: string;
    reason: string;
    adminId?: string;
    adminEmail?: string;
  }) {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('O motivo do cancelamento é obrigatório.');
    }

    const { data: fee, error: fErr } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('id', params.feeId)
      .single();

    if (fErr || !fee) {
      throw new Error('Mensalidade não encontrada.');
    }

    if (Number(fee.amount_paid) > 0) {
      throw new Error('Não é possível cancelar uma mensalidade que já possui pagamentos registrados. Reverta os pagamentos primeiro.');
    }

    const nowIso = new Date().toISOString();

    const { error: upErr } = await supabase
      .from('monthly_fees')
      .update({
        status: 'cancelled',
        notes: params.reason.trim(),
        updated_at: nowIso,
      })
      .eq('id', fee.id);

    if (upErr) throw upErr;

    try {
      const movPayload: Record<string, any> = {
        student_id: fee.student_id,
        type: 'CANCELLATION',
        reference_type: 'monthly_fee',
        reference_id: fee.id,
        description: `Cancelamento de mensalidade ${fee.reference_month}. Motivo: ${params.reason.trim()}`,
        previous_amount: fee.amount,
        movement_amount: fee.amount,
        new_amount: 0,
        notes: params.reason.trim(),
        created_at: nowIso,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      if (params.adminEmail) {
        movPayload.performed_by_email = params.adminEmail;
      }
      const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
      if (mErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch {}

    notifyFinancialUpdated({ studentId: fee.student_id, feeId: fee.id });
  },

  // -------------------------------------------------------------
  // ADMIN: Cancelar Débito de Produto lançado por engano
  // -------------------------------------------------------------
  async cancelProductDebt(params: {
    debtId: string;
    reason: string;
    adminId?: string;
    adminEmail?: string;
  }) {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('O motivo do cancelamento é obrigatório.');
    }

    const { data: debt, error: dErr } = await supabase
      .from('product_debts')
      .select('*')
      .eq('id', params.debtId)
      .single();

    if (dErr || !debt) {
      throw new Error('Débito de produto não encontrado.');
    }

    if (Number(debt.amount_paid) > 0) {
      throw new Error('Não é possível cancelar um débito que já possui pagamentos registrados. Reverta os pagamentos primeiro.');
    }

    const nowIso = new Date().toISOString();

    const { error: upErr } = await supabase
      .from('product_debts')
      .update({
        status: 'cancelled',
        notes: params.reason.trim(),
        updated_at: nowIso,
      })
      .eq('id', debt.id);

    if (upErr) throw upErr;

    try {
      const movPayload: Record<string, any> = {
        student_id: debt.student_id,
        type: 'CANCELLATION',
        reference_type: 'product_debt',
        reference_id: debt.id,
        description: `Cancelamento do produto ${debt.product_name_snapshot}. Motivo: ${params.reason.trim()}`,
        previous_amount: debt.total_amount,
        movement_amount: debt.total_amount,
        new_amount: 0,
        notes: params.reason.trim(),
        created_at: nowIso,
      };
      if (params.adminId && isUuid(params.adminId)) {
        movPayload.performed_by = params.adminId;
      }
      if (params.adminEmail) {
        movPayload.performed_by_email = params.adminEmail;
      }
      const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
      if (mErr && movPayload.performed_by) {
        delete movPayload.performed_by;
        await supabase.from('financial_movements').insert(movPayload);
      }
    } catch {}

    notifyFinancialUpdated({ studentId: debt.student_id, debtId: debt.id });
  },

  // -------------------------------------------------------------
  // ADMIN: Fazer Ajuste com Motivo Obrigatório
  // -------------------------------------------------------------
  async recordAdjustment(params: {
    studentId: string;
    itemType: 'monthly_fee' | 'product_debt';
    itemId: string;
    newTotalAmount: number;
    reason: string;
    adminId?: string;
    adminEmail?: string;
  }) {
    if (!params.reason || params.reason.trim().length < 3) {
      throw new Error('O motivo do ajuste é obrigatório.');
    }
    if (params.newTotalAmount < 0) {
      throw new Error('O novo valor não pode ser negativo.');
    }

    const nowIso = new Date().toISOString();

    if (params.itemType === 'monthly_fee') {
      const { data: fee, error: feeErr } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('id', params.itemId)
        .single();

      if (feeErr || !fee) throw new Error('Mensalidade não encontrada.');

      const prevAmount = Number(fee.amount);
      const paid = Number(fee.amount_paid);

      if (params.newTotalAmount < paid) {
        throw new Error('O novo valor não pode ser menor que o valor já pago.');
      }

      const newRemaining = Number((params.newTotalAmount - paid).toFixed(2));
      const newStatus = newRemaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

      const { error: updErr } = await supabase
        .from('monthly_fees')
        .update({
          amount: params.newTotalAmount,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: nowIso,
          notes: fee.notes ? `${fee.notes} | Ajuste: ${params.reason}` : `Ajuste: ${params.reason}`,
        })
        .eq('id', params.itemId);

      if (updErr) throw updErr;

      // Auditoria
      try {
        const movPayload: Record<string, any> = {
          student_id: params.studentId,
          type: 'ADJUSTMENT',
          reference_type: 'monthly_fee',
          reference_id: params.itemId,
          description: `Ajuste de valor: Mensalidade ${fee.reference_month}`,
          previous_amount: prevAmount,
          movement_amount: Number((params.newTotalAmount - prevAmount).toFixed(2)),
          new_amount: params.newTotalAmount,
          notes: params.reason,
          created_at: nowIso,
        };
        if (params.adminId && isUuid(params.adminId)) {
          movPayload.performed_by = params.adminId;
        }
        if (params.adminEmail) {
          movPayload.performed_by_email = params.adminEmail;
        }
        const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
        if (mErr && movPayload.performed_by) {
          delete movPayload.performed_by;
          await supabase.from('financial_movements').insert(movPayload);
        }
      } catch {}

      notifyFinancialUpdated({ studentId: params.studentId, feeId: params.itemId });
      return;
    }

    if (params.itemType === 'product_debt') {
      const { data: debt, error: dErr } = await supabase
        .from('product_debts')
        .select('*')
        .eq('id', params.itemId)
        .single();

      if (dErr || !debt) throw new Error('Débito de produto não encontrado.');

      const prevAmount = Number(debt.total_amount);
      const paid = Number(debt.amount_paid);

      if (params.newTotalAmount < paid) {
        throw new Error('O novo valor não pode ser menor que o valor já pago.');
      }

      const newRemaining = Number((params.newTotalAmount - paid).toFixed(2));
      const newStatus = newRemaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'open';

      const { error: updErr } = await supabase
        .from('product_debts')
        .update({
          total_amount: params.newTotalAmount,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: nowIso,
          notes: debt.notes ? `${debt.notes} | Ajuste: ${params.reason}` : `Ajuste: ${params.reason}`,
        })
        .eq('id', params.itemId);

      if (updErr) throw updErr;

      // Auditoria
      try {
        const movPayload: Record<string, any> = {
          student_id: params.studentId,
          type: 'ADJUSTMENT',
          reference_type: 'product_debt',
          reference_id: params.itemId,
          description: `Ajuste de valor: Produto ${debt.product_name_snapshot}`,
          previous_amount: prevAmount,
          movement_amount: Number((params.newTotalAmount - prevAmount).toFixed(2)),
          new_amount: params.newTotalAmount,
          notes: params.reason,
          created_at: nowIso,
        };
        if (params.adminId && isUuid(params.adminId)) {
          movPayload.performed_by = params.adminId;
        }
        if (params.adminEmail) {
          movPayload.performed_by_email = params.adminEmail;
        }
        const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
        if (mErr && movPayload.performed_by) {
          delete movPayload.performed_by;
          await supabase.from('financial_movements').insert(movPayload);
        }
      } catch {}

      notifyFinancialUpdated({ studentId: params.studentId, debtId: params.itemId });
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Obter dados individuais do aluno (Fonte: public.profiles)
  // -------------------------------------------------------------
  async getStudentById(studentId: string): Promise<(Student & Profile) | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (error || !profile) {
        return null;
      }

      return {
        ...profile,
        role: profile.role || 'student',
        fee_amount: profile.monthly_fee_amount ?? profile.fee_amount ?? 0,
        monthly_fee_amount: profile.monthly_fee_amount ?? profile.fee_amount ?? 0,
        due_day: profile.due_day ?? 10,
      } as unknown as (Student & Profile);
    } catch (e) {
      console.error('Erro ao buscar perfil do aluno:', e);
      return null;
    }
  },

  async getStudentPayments(studentId: string): Promise<Payment[]> {
    try {
      const targetId = await this.ensureStudentId(studentId);
      const [payRes, feesRes, debtsRes, deletedReg] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', targetId)
          .order('paid_at', { ascending: false }),
        supabase
          .from('monthly_fees')
          .select('id, status')
          .eq('student_id', targetId),
        supabase
          .from('product_debts')
          .select('id, status')
          .eq('student_id', targetId),
        getDeletedRecordsRegistry(),
      ]);

      if (payRes.error) {
        console.warn('Aviso ao buscar pagamentos do aluno:', payRes.error.message);
        return [];
      }

      const activeFeeIds = new Set<string>(
        (feesRes.data || [])
          .filter((f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id))
          .map((f: any) => f.id)
      );
      const activeDebtIds = new Set<string>(
        (debtsRes.data || [])
          .filter((d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id))
          .map((d: any) => d.id)
      );

      return ((payRes.data || []) as Payment[]).filter((p: any) =>
        isPaymentRecordActive(p, deletedReg, activeFeeIds, activeDebtIds)
      );
    } catch (e) {
      console.warn('Falha na busca de pagamentos:', e);
      return [];
    }
  },

  async getInternalNotes(studentId: string): Promise<InternalNote[]> {
    try {
      const targetId = await this.ensureStudentId(studentId);
      const { data, error } = await supabase
        .from('internal_notes')
        .select('*')
        .eq('student_id', targetId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Aviso ao buscar observações internas:', error.message);
        return [];
      }
      return (data || []) as InternalNote[];
    } catch (e) {
      console.warn('Falha na busca de observações internas:', e);
      return [];
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Observações Internas (Somente Admin visualiza)
  // -------------------------------------------------------------
  async addInternalNote(
    studentIdOrParams:
      | string
      | { studentId: string; note: string; authorId?: string; authorEmail?: string },
    text?: string,
    adminId?: string,
    adminEmail?: string
  ) {
    let sId = '';
    let content = '';
    let author = adminId || null;
    let email = adminEmail || null;

    if (typeof studentIdOrParams === 'object') {
      sId = studentIdOrParams.studentId;
      content = studentIdOrParams.note;
      author = studentIdOrParams.authorId || null;
      email = studentIdOrParams.authorEmail || null;
    } else {
      sId = studentIdOrParams;
      content = text || '';
    }

    if (!content.trim()) {
      throw new Error('O texto da observação não pode ser vazio.');
    }

    const targetStudentId = await this.ensureStudentId(sId);

    const { data, error } = await supabase
      .from('internal_notes')
      .insert({
        student_id: targetStudentId,
        text: content.trim(),
        created_by: author,
        created_by_email: email,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalNote;
  },

  // -------------------------------------------------------------
  // ADMIN: Catálogo de Produtos
  // -------------------------------------------------------------
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Product[];
  },

  async saveProduct(product: Partial<Product>): Promise<Product> {
    if (!product.name || !product.name.trim()) {
      throw new Error('Nome do produto é obrigatório.');
    }
    if ((product.price ?? 0) < 0) {
      throw new Error('Preço do produto não pode ser negativo.');
    }

    if (product.id) {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: product.name.trim(),
          category: product.category || 'Outros',
          description: product.description?.trim() || null,
          price: product.price,
          active: product.active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .select('*')
        .single();

      if (error) throw error;
      return data as Product;
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name.trim(),
          category: product.category || 'Outros',
          description: product.description?.trim() || null,
          price: product.price ?? 0,
          active: product.active ?? true,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as Product;
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todas as mensalidades (Geral)
  // -------------------------------------------------------------
  async getAllMonthlyFees(filterStatus?: string) {
    let query = supabase
      .from('monthly_fees')
      .select('*')
      .order('due_date', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0];
        query = query.lt('due_date', todayStr).gt('remaining_amount', 0).neq('status', 'cancelled');
      } else {
        query = query.eq('status', filterStatus);
      }
    }

    const [{ data, error }, { data: profs }] = await Promise.all([
      query,
      supabase.from('profiles').select('*'),
    ]);
    if (error) throw error;
    const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    return (data || []).map((f: any) => ({
      ...f,
      student: pMap.get(f.student_id) || undefined,
    })) as MonthlyFee[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todos os débitos de produtos (Geral)
  // -------------------------------------------------------------
  async getAllProductDebts(filterStatus?: string) {
    let query = supabase
      .from('product_debts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const [{ data, error }, { data: profs }] = await Promise.all([
      query,
      supabase.from('profiles').select('*'),
    ]);
    if (error) throw error;
    const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    return (data || []).map((d: any) => ({
      ...d,
      student: pMap.get(d.student_id) || undefined,
    })) as ProductDebt[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todos os pagamentos (Geral)
  // -------------------------------------------------------------
  async getAllPayments(limit: number = 50) {
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .limit(limit),
      supabase.from('profiles').select('*'),
    ]);

    if (error) throw error;
    const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    return (data || []).map((p: any) => ({
      ...p,
      student: pMap.get(p.student_id) || undefined,
    })) as Payment[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todas as movimentações financeiras (Geral)
  // -------------------------------------------------------------
  async getAllMovements(limit: number = 100) {
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase
        .from('financial_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase.from('profiles').select('*'),
    ]);

    if (error) throw error;
    const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    return (data || []).map((m: any) => ({
      ...m,
      student: pMap.get(m.student_id) || undefined,
    })) as FinancialMovement[];
  },

  // -------------------------------------------------------------
  // ADMIN: Configurações do Sistema
  // -------------------------------------------------------------
  async getSystemSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'financial_defaults')
        .maybeSingle();

      if (error || !data) {
        return { default_fee_amount: 50, default_due_day: 10 };
      }
      return data.value as { default_fee_amount: number; default_due_day: number };
    } catch {
      return { default_fee_amount: 50, default_due_day: 10 };
    }
  },

  async saveSystemSettings(settings: { default_fee_amount: number; default_due_day: number }) {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'financial_defaults',
        value: settings,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  // -------------------------------------------------------------
  // CORREÇÃO PONTUAL E SEGURA: Registro incorreto de Setembro/2026 do aluno Rafael Cordeiro
  // Corrige única e exclusivamente o lançamento que ficou com R$ 120 para R$ 50
  // -------------------------------------------------------------
  async fixRafaelSeptember2026Record(): Promise<boolean> {
    try {
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Rafael%Cordeiro%');

      if (!students || students.length === 0) return false;

      const rafael = students[0];
      const correctAmount = Number(rafael.monthly_fee_amount) || 50;
      const dueDay = Number(rafael.due_day) || 22;
      const correctDueDate = `2026-09-${String(dueDay).padStart(2, '0')}`;

      // Busca a mensalidade específica de Setembro/2026 do Rafael
      const { data: fees } = await supabase
        .from('monthly_fees')
        .select('*')
        .eq('student_id', rafael.id);

      if (!fees || fees.length === 0) return false;

      const wrongFee = fees.find((f) => {
        const ref = (f.reference_month || '').toLowerCase();
        const isSept2026 = ref.startsWith('2026-09') || ref.includes('setembro/2026') || ref.includes('set/2026');
        return isSept2026 && (Number(f.amount) === 120 || Number(f.amount_paid) === 120);
      });

      if (!wrongFee) return false;

      console.log(`[fixRafaelSeptember2026Record] Ajustando mensalidade de Rafael Cordeiro (${wrongFee.id}) de R$ 120 para R$ ${correctAmount}`);

      const isPaid = wrongFee.status === 'paid' || Number(wrongFee.amount_paid) > 0;
      await supabase
        .from('monthly_fees')
        .update({
          amount: correctAmount,
          amount_paid: isPaid ? correctAmount : 0,
          remaining_amount: isPaid ? 0 : correctAmount,
          due_date: correctDueDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wrongFee.id);

      // Corrige exclusivamente o pagamento desse lançamento
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('monthly_fee_id', wrongFee.id)
        .eq('student_id', rafael.id);

      if (payments && payments.length > 0) {
        for (const pay of payments) {
          if (Number(pay.amount) === 120) {
            await supabase
              .from('payments')
              .update({
                amount: correctAmount,
                notes: 'Pagamento de mensalidade (R$ 50,00)',
              })
              .eq('id', pay.id);
          }
        }
      }

      // Corrige exclusivamente a movimentação financeira desse lançamento
      const { data: movements } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('reference_id', wrongFee.id)
        .eq('student_id', rafael.id);

      if (movements && movements.length > 0) {
        for (const mov of movements) {
          if (Number(mov.movement_amount) === 120 || Number(mov.previous_amount) === 120) {
            await supabase
              .from('financial_movements')
              .update({
                movement_amount: correctAmount,
                previous_amount: correctAmount,
                description: 'Mensalidade Setembro/2026 marcada como PAGA',
              })
              .eq('id', mov.id);
          }
        }
      }

      notifyFinancialUpdated({ studentId: rafael.id, feeId: wrongFee.id });
      return true;
    } catch (e) {
      console.warn('Aviso ao verificar registro de Rafael Cordeiro:', e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Grade Anual de Mensalidades (Lote Otimizado)
  // -------------------------------------------------------------
  async getAnnualFeesGrid(year: number): Promise<AnnualGridStudentRow[]> {
    // Executa correção pontual segura do registro de Setembro/2026 de Rafael Cordeiro se existir
    try {
      await this.fixRafaelSeptember2026Record();
    } catch {}

    const spTodayStr = getSaoPauloDateString();
    const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

    // 1. Busca todos os alunos da academia
    const allStudents = await this.getAllStudents('');

    // 2. Ordena estritamente por ordem alfabética do nome completo compatível com pt-BR
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
    allStudents.sort((a, b) => collator.compare(a.full_name || '', b.full_name || ''));

    // 3. Busca mensalidades da academia
    // Não filtra por texto no Supabase para não perder competências gravadas em formatos diferentes ("Setembro/2026", "2026-09-01", etc.)
    const [feesRes, historyFeesRes, deletedReg] = await Promise.all([
      supabase
        .from('monthly_fees')
        .select('*')
        .neq('status', 'cancelled'),
      supabase
        .from('monthly_fees')
        .select('id, student_id, reference_month')
        .neq('status', 'cancelled')
        .order('reference_month', { ascending: true }),
      getDeletedRecordsRegistry(),
    ]);

    const fees = (feesRes.data || []).filter(
      (f: any) => !f.deleted_at && f.status !== 'cancelled' && !deletedReg.feeIds.has(f.id)
    );
    const historyFees = (historyFeesRes.data || []).filter(
      (f: any) => !f.deleted_at && !deletedReg.feeIds.has(f.id)
    );

    // Mapeia mensalidades do ano por studentId_YYYY-MM
    const feeMap = new Map<string, MonthlyFee>();
    for (const f of fees) {
      if (f.student_id && (f.reference_month || f.due_date)) {
        const ym = toReferenceYearMonth(f.reference_month) || (f.due_date ? f.due_date.substring(0, 7) : '');
        if (ym.startsWith(`${year}-`)) {
          const key = `${f.student_id}_${ym}`;
          const existing = feeMap.get(key);
          if (
            !existing ||
            (f.status === 'paid' && existing.status !== 'paid') ||
            Number(f.amount_paid) > Number(existing.amount_paid)
          ) {
            feeMap.set(key, f as MonthlyFee);
          }
        }
      }
    }

    // Identifica menor competência histórica de cada aluno
    const minRefByStudent = new Map<string, string>();
    for (const hf of historyFees) {
      if (hf.student_id && hf.reference_month) {
        const ym = toReferenceYearMonth(hf.reference_month) || (hf.reference_month || '').substring(0, 7);
        const cur = minRefByStudent.get(hf.student_id);
        if (!cur || ym < cur) {
          minRefByStudent.set(hf.student_id, ym);
        }
      }
    }

    const rows: AnnualGridStudentRow[] = allStudents.map((std) => {
      const isScholarship = Boolean(std.is_scholarship);
      const feeAmount = Number(std.monthly_fee_amount ?? std.fee_amount) || 0;
      const dueDay = Number(std.due_day) || 10;

      // DATA REAL DE CADASTRO DO ALUNO (created_at no fuso oficial America/Sao_Paulo)
      const regYearMonth = getSaoPauloYearMonth(std.created_at);

      const months: GridMonthCell[] = [];

      for (let m = 1; m <= 12; m++) {
        const monthIndexStr = String(m).padStart(2, '0');
        const refMonth = `${year}-${monthIndexStr}`;
        const monthLabel = MONTH_LABELS[m - 1];

        const isPre = false;

        const feeKey = `${std.id}_${refMonth}`;
        const fee = feeMap.get(feeKey);

        let status: GridFeeStatus;
        let isEditable = !isScholarship;
        let isFeeOverdue = false;
        const isFeePaid = fee ? (fee.status === 'paid' || (Number(fee.remaining_amount) === 0 && Number(fee.amount_paid) > 0)) : false;
        // Para mensalidade já paga, preserva o valor registrado. Se ainda não paga, OBRIGATORIAMENTE o valor configurado do aluno!
        const amount = isScholarship ? 0 : (isFeePaid ? Number(fee?.amount || feeAmount) : (feeAmount > 0 ? feeAmount : Number(fee?.amount || 0)));
        const amountPaid = fee ? Number(fee.amount_paid || 0) : 0;
        const remainingAmount = fee ? (isFeePaid ? 0 : (feeAmount > 0 ? feeAmount : Number(fee.remaining_amount))) : 0;
        const paidAt = fee?.paid_at || null;
        const calculatedDueDate = `${year}-${monthIndexStr}-${String(dueDay).padStart(2, '0')}`;
        const actualDueDate = fee?.due_date ? fee.due_date.substring(0, 10) : calculatedDueDate;

        // FONTE ÚNICA DE VERDADE: SOMENTE monthly_fees
        // 1. Bolsista -> BOLSISTA
        if (isScholarship) {
          status = 'BOLSISTA';
          isEditable = false;
        }
        // 2. Sem registro em monthly_fees -> SEM MENSALIDADE
        else if (!fee) {
          status = 'SEM MENSALIDADE';
          isEditable = true;
        }
        // 3. Registro paid -> PAGO
        else if (fee.status === 'paid' || (remainingAmount === 0 && amountPaid > 0)) {
          status = 'PAGO';
          isEditable = true;
        }
        // 4. Registro partial -> PARCIAL
        else if (fee.status === 'partial' || (amountPaid > 0 && remainingAmount > 0)) {
          status = 'PARCIAL';
          isEditable = false;
        }
        // 5. Registro pending/open + vencimento passado -> ATRASO
        else if (actualDueDate < spTodayStr) {
          isFeeOverdue = true;
          status = 'ATRASO';
          isEditable = true;
        }
        // 6. Registro pending/open + vencimento futuro -> NÃO PAGO
        else {
          status = 'NÃO PAGO';
          isEditable = true;
        }

        months.push({
          referenceMonth: refMonth,
          monthIndex: m,
          monthLabel,
          status,
          isPre,
          isEditable,
          isScholarship,
          isOverdue: isFeeOverdue,
          feeId: fee?.id || null,
          amount: fee ? amount : feeAmount,
          amountPaid,
          remainingAmount,
          dueDate: actualDueDate,
          paidAt,
        });
      }

      return {
        student: std,
        months,
      };
    });

    return rows;
  },

  // -------------------------------------------------------------
  // ADMIN: Lançar Alterações em Lote na Grade Anual (Persistência Real no Supabase)
  // -------------------------------------------------------------
  async batchApplyGridFees(
    changes: GridFeeChange[],
    adminId?: string,
    adminEmail?: string
  ): Promise<{ success: boolean; appliedCount: number; message: string }> {
    if (!changes || changes.length === 0) {
      return { success: true, appliedCount: 0, message: 'Nenhuma alteração a processar.' };
    }

    const nowIso = new Date().toISOString();
    const spTodayStr = getSaoPauloDateString();
    let appliedCount = 0;

    for (const change of changes) {
      const { studentId, referenceMonth, targetStatus, feeId } = change;
      const targetStudentId = await this.ensureStudentId(studentId);
      const ym = toReferenceYearMonth(referenceMonth);
      const isoRef = toReferenceMonthIso(referenceMonth);

      // 1. Busca configuração financeira REAL do aluno diretamente no banco de dados (Única fonte de verdade)
      const { data: studentProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetStudentId)
        .maybeSingle();

      if (profileErr) {
        throw new Error(`Erro ao buscar dados do aluno no banco: ${profileErr.message}`);
      }

      const isScholarship = Boolean(studentProfile?.is_scholarship);
      // Para bolsista: 0. Para pagante: SEMPRE o valor configurado individualmente para o aluno!
      const studentFee = isScholarship
        ? 0
        : (Number(studentProfile?.monthly_fee_amount) || Number(change.feeAmount) || 0);
      const studentDueDay = Number(studentProfile?.due_day) || Number(change.dueDay) || 10;
      const [yPart, mPart] = ym.split('-');
      const targetDueDate = `${yPart}-${mPart}-${String(Math.min(Math.max(studentDueDay, 1), 28)).padStart(2, '0')}`;

      // 2. Localiza se já existe mensalidade para essa competência no banco
      let resolvedFeeId = feeId;
      let existingFee: MonthlyFee | null = null;

      if (resolvedFeeId) {
        const { data: fData } = await supabase
          .from('monthly_fees')
          .select('*')
          .eq('id', resolvedFeeId)
          .maybeSingle();
        if (fData) {
          existingFee = fData as MonthlyFee;
        }
      }

      if (!existingFee) {
        const { data: existingFeeRecords, error: fetchErr } = await supabase
          .from('monthly_fees')
          .select('*')
          .eq('student_id', targetStudentId)
          .neq('status', 'cancelled');

        if (fetchErr) {
          throw new Error(`Erro ao verificar mensalidades existentes: ${fetchErr.message}`);
        }

        const match = (existingFeeRecords || []).find((f) => {
          const fYm = toReferenceYearMonth(f.reference_month);
          const rawSub = (f.reference_month || '').substring(0, 7);
          const dueSub = (f.due_date || '').substring(0, 7);
          return fYm === ym || rawSub === ym || dueSub === ym;
        });

        if (match) {
          existingFee = match as MonthlyFee;
          resolvedFeeId = match.id;
        }
      }

      // 3. Processa conforme status alvo
      if (targetStatus === 'PAGO') {
        if (existingFee) {
          // Atualiza a mensalidade existente usando SEMPRE o valor individual configurado do aluno
          const { error: updErr } = await supabase
            .from('monthly_fees')
            .update({
              status: 'paid',
              amount: studentFee,
              amount_paid: studentFee,
              remaining_amount: 0,
              due_date: existingFee.due_date || targetDueDate,
              paid_at: existingFee.paid_at || nowIso,
              updated_at: nowIso,
            })
            .eq('id', existingFee.id);

          if (updErr) {
            throw new Error(`Erro ao persistir baixa da mensalidade de ${change.studentName}: ${updErr.message}`);
          }
          resolvedFeeId = existingFee.id;
        } else {
          // Cria nova mensalidade quitada com o valor individual do aluno
          const feeInsertPayload: Record<string, any> = {
            student_id: targetStudentId,
            reference_month: isoRef,
            description: `Mensalidade ${change.monthLabel || formatReferenceDisplay(referenceMonth)}`,
            amount: studentFee,
            amount_paid: studentFee,
            remaining_amount: 0,
            due_date: targetDueDate,
            status: 'paid',
            paid_at: nowIso,
            notes: 'Baixa registrada via Grade Anual de Mensalidades',
            created_at: nowIso,
            updated_at: nowIso,
          };
          if (adminId && isUuid(adminId)) {
            feeInsertPayload.created_by = adminId;
          }

          let { data: newFee, error: newFeeErr } = await supabase
            .from('monthly_fees')
            .insert(feeInsertPayload)
            .select('*')
            .single();

          if (newFeeErr && feeInsertPayload.created_by) {
            delete feeInsertPayload.created_by;
            const retryRes = await supabase
              .from('monthly_fees')
              .insert(feeInsertPayload)
              .select('*')
              .single();
            newFee = retryRes.data;
            newFeeErr = retryRes.error;
          }

          if (newFeeErr || !newFee) {
            throw new Error(`Erro ao criar mensalidade de ${change.studentName}: ${newFeeErr?.message || 'Falha ao salvar'}`);
          }

          existingFee = newFee as MonthlyFee;
          resolvedFeeId = newFee.id;
        }

        // 4. Vincula o pagamento correspondente em payments
        if (resolvedFeeId && studentFee > 0) {
          const { data: existingPayment } = await supabase
            .from('payments')
            .select('id, amount')
            .eq('monthly_fee_id', resolvedFeeId)
            .maybeSingle();

          if (existingPayment) {
            if (Number(existingPayment.amount) !== studentFee) {
              const { error: upPayErr } = await supabase
                .from('payments')
                .update({
                  amount: studentFee,
                  paid_at: nowIso,
                  notes: `Baixa via Grade Anual (${formatCurrency(studentFee)})`,
                })
                .eq('id', existingPayment.id);
              if (upPayErr) {
                throw new Error(`Erro ao atualizar pagamento de ${change.studentName}: ${upPayErr.message}`);
              }
            }
          } else {
            const payPayload: Record<string, any> = {
              student_id: targetStudentId,
              payment_type: 'monthly_fee',
              monthly_fee_id: resolvedFeeId,
              amount: studentFee,
              payment_method: 'dinheiro',
              notes: 'Baixa registrada via Grade Anual de Mensalidades',
              paid_at: nowIso,
              created_at: nowIso,
            };
            if (adminId && isUuid(adminId)) {
              payPayload.recorded_by = adminId;
            }
            if (adminEmail) {
              payPayload.recorded_by_email = adminEmail;
            }

            let { error: payErr } = await supabase.from('payments').insert(payPayload);
            if (payErr && payPayload.recorded_by) {
              delete payPayload.recorded_by;
              const retryPay = await supabase.from('payments').insert(payPayload);
              payErr = retryPay.error;
            }
            if (payErr) {
              throw new Error(`Erro ao registrar pagamento de ${change.studentName}: ${payErr.message}`);
            }
          }

          // 5. Linha única e clara no histórico / financial_movements
          try {
            const { data: existingMov } = await supabase
              .from('financial_movements')
              .select('id, movement_amount')
              .eq('reference_id', resolvedFeeId)
              .eq('type', 'PAYMENT')
              .maybeSingle();

            if (existingMov) {
              if (Number(existingMov.movement_amount) !== studentFee) {
                await supabase
                  .from('financial_movements')
                  .update({
                    movement_amount: studentFee,
                    previous_amount: studentFee,
                    new_amount: 0,
                    description: `Mensalidade ${formatReferenceDisplay(referenceMonth)} marcada como PAGA`,
                  })
                  .eq('id', existingMov.id);
              }
            } else {
              const movPayload: Record<string, any> = {
                student_id: targetStudentId,
                type: 'PAYMENT',
                reference_type: 'monthly_fee',
                reference_id: resolvedFeeId,
                description: `Mensalidade ${formatReferenceDisplay(referenceMonth)} marcada como PAGA`,
                previous_amount: studentFee,
                movement_amount: studentFee,
                new_amount: 0,
                created_at: nowIso,
              };
              if (adminId && isUuid(adminId)) {
                movPayload.performed_by = adminId;
              }
              if (adminEmail) {
                movPayload.performed_by_email = adminEmail;
              }
              const { error: mErr } = await supabase.from('financial_movements').insert(movPayload);
              if (mErr && movPayload.performed_by) {
                delete movPayload.performed_by;
                await supabase.from('financial_movements').insert(movPayload);
              }
            }
          } catch {}
        }
        appliedCount++;
      } else if (targetStatus === 'NÃO PAGO') {
        // Marca/cria mensalidade como NÃO PAGO usando status válido do banco ('pending' ou fallback 'open')
        if (resolvedFeeId && existingFee) {
          let { error: updErr } = await supabase
            .from('monthly_fees')
            .update({
              status: 'pending',
              amount: studentFee,
              amount_paid: 0,
              remaining_amount: studentFee,
              paid_at: null,
              updated_at: nowIso,
            })
            .eq('id', resolvedFeeId);

          if (updErr && (updErr.message?.includes('check constraint') || updErr.code === '23514')) {
            const retryUpd = await supabase
              .from('monthly_fees')
              .update({
                status: 'open',
                amount: studentFee,
                amount_paid: 0,
                remaining_amount: studentFee,
                paid_at: null,
                updated_at: nowIso,
              })
              .eq('id', resolvedFeeId);
            updErr = retryUpd.error;
          }

          if (updErr) {
            throw new Error(`Erro ao atualizar mensalidade de ${change.studentName}: ${updErr.message}`);
          }

          // Remove pagamento vinculado se existir
          const { data: linkedPays } = await supabase
            .from('payments')
            .select('id')
            .eq('monthly_fee_id', resolvedFeeId);
          if (linkedPays && linkedPays.length > 0) {
            await markRecordAsDeleted({ paymentIds: linkedPays.map((p: any) => p.id) });
          }
          await supabase
            .from('payments')
            .delete()
            .eq('monthly_fee_id', resolvedFeeId);

          // Remove movimentação de pagamento antiga ou registra reversão
          try {
            await supabase
              .from('financial_movements')
              .delete()
              .eq('reference_id', resolvedFeeId)
              .eq('type', 'PAYMENT');
          } catch {}

          appliedCount++;
        } else {
          // Cria nova mensalidade em aberto usando o valor individual configurado
          const feeInsertPayload: Record<string, any> = {
            student_id: targetStudentId,
            reference_month: isoRef,
            description: `Mensalidade ${change.monthLabel || formatReferenceDisplay(referenceMonth)}`,
            amount: studentFee,
            amount_paid: 0,
            remaining_amount: studentFee,
            due_date: targetDueDate,
            status: 'pending',
            paid_at: null,
            notes: 'Mensalidade lançada via Grade Anual',
            created_at: nowIso,
            updated_at: nowIso,
          };
          if (adminId && isUuid(adminId)) {
            feeInsertPayload.created_by = adminId;
          }

          let { data: newFee, error: newFeeErr } = await supabase
            .from('monthly_fees')
            .insert(feeInsertPayload)
            .select('*')
            .single();

          if (newFeeErr && feeInsertPayload.created_by) {
            delete feeInsertPayload.created_by;
            const retryRes = await supabase
              .from('monthly_fees')
              .insert(feeInsertPayload)
              .select('*')
              .single();
            newFee = retryRes.data;
            newFeeErr = retryRes.error;
          }

          if (newFeeErr && (newFeeErr.message?.includes('check constraint') || newFeeErr.code === '23514')) {
            feeInsertPayload.status = 'open';
            const retryOpen = await supabase
              .from('monthly_fees')
              .insert(feeInsertPayload)
              .select('*')
              .single();
            newFee = retryOpen.data;
            newFeeErr = retryOpen.error;
          }

          if (newFeeErr || !newFee) {
            throw new Error(`Erro ao lançar mensalidade de ${change.studentName}: ${newFeeErr?.message || 'Falha ao salvar'}`);
          }

          appliedCount++;
        }
      } else if (targetStatus === 'SEM MENSALIDADE') {
        // REGRA ESTRITA: SEM MENSALIDADE NÃO É STATUS DO BANCO!
        // Significa não existir registro em monthly_fees para aquele aluno naquele mês.
        // Portanto, removemos com segurança o registro e qualquer payment/movimentação vinculada.
        const feeIdToDelete = resolvedFeeId || existingFee?.id;
        if (feeIdToDelete) {
          const { data: linkedPays } = await supabase
            .from('payments')
            .select('id')
            .eq('monthly_fee_id', feeIdToDelete);
          await markRecordAsDeleted({
            paymentIds: (linkedPays || []).map((p: any) => p.id),
            feeIds: [feeIdToDelete],
          });

          // 1. Remove pagamentos vinculados
          const { error: delPayErr } = await supabase
            .from('payments')
            .delete()
            .eq('monthly_fee_id', feeIdToDelete);

          if (delPayErr) {
            throw new Error(`Erro ao reverter pagamento vinculado de ${change.studentName}: ${delPayErr.message}`);
          }

          // 2. Remove movimentações vinculadas
          await supabase
            .from('financial_movements')
            .delete()
            .eq('reference_id', feeIdToDelete);

          // 3. Remove a monthly_fee do banco
          const { error: delFeeErr } = await supabase
            .from('monthly_fees')
            .delete()
            .eq('id', feeIdToDelete);

          if (delFeeErr) {
            throw new Error(`Erro ao remover mensalidade de ${change.studentName}: ${delFeeErr.message}`);
          }
        }
        appliedCount++;
      }
    }

    // Dispara sincronização com o painel do aluno e dashboard em tempo real
    notifyFinancialUpdated({ changesCount: appliedCount });

    return {
      success: true,
      appliedCount,
      message: `${appliedCount} alteraç${appliedCount > 1 ? 'ões lançadas' : 'ão lançada'} com sucesso!`,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Reset Limpo dos Lançamentos Financeiros de Teste
  // -------------------------------------------------------------
  async resetFinancialTransactions(): Promise<{
    success: boolean;
    message: string;
    preservedStudentsCount: number;
  }> {
    // 1. Auditoria de Segurança: Garante que os alunos reais existem e continuam intactos
    const { data: students, error: stdErr } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin');

    if (stdErr) {
      throw new Error(`Falha de segurança ao auditar alunos: ${stdErr.message}`);
    }

    if (!students || students.length === 0) {
      throw new Error('Operação cancelada por segurança: nenhum aluno encontrado no cadastro.');
    }

    // 2. Limpeza estritamente transacional (apenas movimentações, pagamentos e mensalidades)
    // PRESERVAÇÃO RIGOROSA: profiles, students, auth.users, products, product_debts,
    // e todas as configurações individuais (valor mensal, dia base, bolsista/pagante).
    const { error: movErr } = await supabase
      .from('financial_movements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (movErr) {
      console.warn('Aviso ao resetar financial_movements:', movErr.message);
    }

    const { error: payErr } = await supabase
      .from('payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (payErr) {
      console.warn('Aviso ao resetar payments:', payErr.message);
    }

    const { error: feeErr } = await supabase
      .from('monthly_fees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (feeErr) {
      console.warn('Aviso ao resetar monthly_fees:', feeErr.message);
    }

    // Notifica todos os ouvintes em tempo real para atualizar Alunos, Mensalidades, Área do Aluno
    notifyFinancialUpdated();

    return {
      success: true,
      preservedStudentsCount: students.length,
      message: `Reset financeiro concluído com sucesso. Todos os ${students.length} alunos foram preservados com seus cadastros e configurações intactas.`,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Excluir Pagamento (Remove pagamento e mensalidade/produto tanto para o Admin quanto para o Aluno)
  // -------------------------------------------------------------
  async deletePayment(paymentId: string): Promise<{ success: boolean; message: string }> {
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(`Erro ao localizar pagamento: ${fetchErr.message}`);
    }

    if (!payment) {
      await markRecordAsDeleted({ paymentIds: [paymentId] });
      notifyFinancialUpdated({ paymentId });
      return {
        success: true,
        message: 'Pagamento excluído com sucesso!',
      };
    }

    const monthlyFeeId = payment.monthly_fee_id;
    const productDebtId = payment.product_debt_id;
    const nowIso = new Date().toISOString();

    // 1. Registra imediatamente no registro global do sistema (system_settings + localStorage)
    // Como system_settings possui SELECT público para todos os usuários autenticados,
    // o item desaparece instantaneamente tanto para o Admin quanto para o Aluno!
    await markRecordAsDeleted({
      paymentIds: [paymentId],
      feeIds: monthlyFeeId ? [monthlyFeeId] : [],
      debtIds: productDebtId ? [productDebtId] : [],
    });

    // 2. Remove movimentações financeiras vinculadas a este pagamento, mensalidade ou produto
    try {
      await supabase.from('financial_movements').delete().eq('reference_id', paymentId);
      if (monthlyFeeId) {
        await supabase.from('financial_movements').delete().eq('reference_id', monthlyFeeId);
      }
      if (productDebtId) {
        await supabase.from('financial_movements').delete().eq('reference_id', productDebtId);
      }
    } catch {}

    // 3. Tenta excluir fisicamente o pagamento em public.payments
    try {
      const { data: deletedPayRows } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId)
        .select('id');

      // Caso o RLS de payments bloqueie hard DELETE, aciona RPC SECURITY DEFINER e/ou UPDATE
      if (!deletedPayRows || deletedPayRows.length === 0) {
        try {
          await supabase.rpc('soft_delete_payment', {
            p_payment_id: paymentId,
            p_admin_id: null,
            p_reason: '[EXCLUIDO]',
          });
        } catch {}

        try {
          await supabase
            .from('payments')
            .update({
              status: 'reversed',
              notes: '[EXCLUIDO]',
              reversal_reason: '[EXCLUIDO]',
              reversed_at: nowIso,
            } as any)
            .eq('id', paymentId);
        } catch {}
      }
    } catch {}

    // 4. Se for MENSALIDADE: exclui a mensalidade vinculada do banco (apagada para Admin e Aluno)
    if (monthlyFeeId) {
      try {
        const { data: delFeeRows } = await supabase
          .from('monthly_fees')
          .delete()
          .eq('id', monthlyFeeId)
          .select('id');

        if (!delFeeRows || delFeeRows.length === 0) {
          await supabase
            .from('monthly_fees')
            .update({
              status: 'cancelled',
              updated_at: nowIso,
            })
            .eq('id', monthlyFeeId);
        }
      } catch {}
    }

    // 5. Se for PRODUTO: exclui o débito de produto vinculado do banco (apagado para Admin e Aluno)
    if (productDebtId) {
      try {
        const { data: delDebtRows } = await supabase
          .from('product_debts')
          .delete()
          .eq('id', productDebtId)
          .select('id');

        if (!delDebtRows || delDebtRows.length === 0) {
          await supabase
            .from('product_debts')
            .update({
              status: 'cancelled',
              updated_at: nowIso,
            })
            .eq('id', productDebtId);
        }
      } catch {}
    }

    notifyFinancialUpdated({
      paymentId,
      monthlyFeeId,
      productDebtId,
      studentId: payment.student_id,
    });

    return {
      success: true,
      message: 'Registro excluído permanentemente para você e para o aluno!',
    };
  },
};
