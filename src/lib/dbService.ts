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
} from './utils';

export interface StudentFinancialSummary {
  status: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO';
  totalOpen: number;
  totalMonthlyOpen: number;
  totalProductOpen: number;
  openFeesCount: number;
  openDebtsCount: number;
  nextDueDate: string | null;
  overdueCount: number;
  totalFeesEver: number;
  totalDebtsEver: number;
  monthlyStatus: 'SEM_MENSALIDADE' | 'EM_DIA' | 'PENDENTE' | 'EM_ATRASO';
  productStatus: 'NENHUM_DEBITO' | 'PENDENTE';
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number | null;
}

export interface AdminDashboardData {
  totalStudents: number;
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
  financialStatus: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO' | 'INATIVO';
  lastPaymentDate?: string | null;
  role?: 'student';
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

export const dbService = {
  // -------------------------------------------------------------
  // HELPER CANÔNICO: Garantir students.id oficial
  // auth.uid() -> public.students.auth_user_id -> students.id
  // -------------------------------------------------------------
  async ensureStudentId(studentIdentifier: string): Promise<string> {
    if (!studentIdentifier || typeof studentIdentifier !== 'string') {
      return studentIdentifier;
    }
    const cleanId = studentIdentifier.trim();

    try {
      // 1. Verificar se já existe diretamente como students.id
      const { data: byId } = await supabase
        .from('students')
        .select('id')
        .eq('id', cleanId)
        .maybeSingle();

      if (byId?.id) {
        return byId.id;
      }

      // 2. Verificar se existe através de students.auth_user_id (auth.uid() -> public.students.auth_user_id)
      try {
        const { data: byAuthUser } = await supabase
          .from('students')
          .select('id')
          .eq('auth_user_id', cleanId)
          .maybeSingle();

        if (byAuthUser?.id) {
          return byAuthUser.id;
        }
      } catch {
        // coluna pode não existir em schema antigo
      }

      // 3. Verificar se existe como students.user_id
      try {
        const { data: byUser } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', cleanId)
          .maybeSingle();

        if (byUser?.id) {
          return byUser.id;
        }
      } catch {
        // coluna pode não existir em schema antigo
      }

      // 4. Se existe em profiles, verificar se é perfil de aluno
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, date_of_birth, address, whatsapp, whatsapp_normalized, role, active')
        .eq('id', cleanId)
        .maybeSingle();

      if (profile) {
        // Se for perfil de admin e NÃO tem vínculo de estudante, não vincular
        if (profile.role === 'admin') {
          try {
            const { data: adminStudent } = await supabase
              .from('students')
              .select('id')
              .or(`auth_user_id.eq.${cleanId},user_id.eq.${cleanId}`)
              .maybeSingle();
            if (adminStudent?.id) return adminStudent.id;
          } catch {}
          return cleanId;
        }

        // Tentar localizar aluno existente correspondente ao profile.id
        try {
          const { data: existingStudent } = await supabase
            .from('students')
            .select('id')
            .or(`id.eq.${profile.id},auth_user_id.eq.${profile.id},user_id.eq.${profile.id}`)
            .maybeSingle();

          if (existingStudent?.id) {
            return existingStudent.id;
          }
        } catch {
          // ignore
        }

        // Tentar registrar/sincronizar em public.students caso ausente
        try {
          const { data: inserted, error: insErr } = await supabase
            .from('students')
            .insert({
              id: profile.id,
              auth_user_id: profile.id,
              user_id: profile.id,
              full_name: profile.full_name || 'Aluno',
              nickname: profile.nickname || null,
              date_of_birth: profile.date_of_birth || null,
              address: profile.address || null,
              whatsapp: profile.whatsapp || null,
              whatsapp_normalized: profile.whatsapp_normalized || null,
              registration_type: 'self_registered',
              active: profile.active !== false,
            })
            .select('id')
            .maybeSingle();

          if (!insErr && inserted?.id) {
            return inserted.id;
          }
        } catch {}

        // Se falhou por colisão ou trigger, busca novamente
        try {
          const { data: retryCheck } = await supabase
            .from('students')
            .select('id')
            .or(`id.eq.${profile.id},auth_user_id.eq.${profile.id},user_id.eq.${profile.id}`)
            .maybeSingle();

          if (retryCheck?.id) {
            return retryCheck.id;
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Aviso: ensureStudentId não conseguiu verificar public.students:', err);
    }

    return cleanId;
  },

  async resolveCanonicalStudentId(studentIdentifier: string): Promise<string> {
    return this.ensureStudentId(studentIdentifier);
  },

  // -------------------------------------------------------------
  // ALUNO: Resumo Financeiro
  // -------------------------------------------------------------
  async getStudentSummary(studentId: string): Promise<StudentFinancialSummary> {
    try {
      const canonicalId = await this.ensureStudentId(studentId);
      const todayStr = new Date().toISOString().split('T')[0];

      // Get open or partial fees (pending, open, partial, overdue)
      let { data: fees } = await supabase
        .from('monthly_fees')
        .select('remaining_amount, due_date, status')
        .eq('student_id', canonicalId)
        .in('status', ['pending', 'open', 'partial', 'overdue']);

      if ((!fees || fees.length === 0) && studentId !== canonicalId) {
        const { data: altFees } = await supabase
          .from('monthly_fees')
          .select('remaining_amount, due_date, status')
          .eq('student_id', studentId)
          .in('status', ['pending', 'open', 'partial', 'overdue']);
        if (altFees && altFees.length > 0) fees = altFees;
      }

      // Get open or partial product debts
      let { data: debts } = await supabase
        .from('product_debts')
        .select('remaining_amount, status')
        .eq('student_id', canonicalId)
        .in('status', ['open', 'partial']);

      if ((!debts || debts.length === 0) && studentId !== canonicalId) {
        const { data: altDebts } = await supabase
          .from('product_debts')
          .select('remaining_amount, status')
          .eq('student_id', studentId)
          .in('status', ['open', 'partial']);
        if (altDebts && altDebts.length > 0) debts = altDebts;
      }

      let totalMonthlyOpen = 0;
      let totalProductOpen = 0;
      let overdueCount = 0;
      let nextDueDate: string | null = null;
      let openFeesCount = 0;
      let openDebtsCount = 0;

      if (fees) {
        for (const fee of fees) {
          const rem = Number(fee.remaining_amount) || 0;
          if (rem > 0 && fee.status !== 'cancelled') {
            totalMonthlyOpen += rem;
            openFeesCount++;
            if (fee.due_date && fee.due_date < todayStr) {
              overdueCount++;
            }
            if (fee.due_date) {
              if (!nextDueDate || fee.due_date < nextDueDate) {
                nextDueDate = fee.due_date;
              }
            }
          }
        }
      }

      if (debts) {
        for (const debt of debts) {
          const rem = Number(debt.remaining_amount) || 0;
          if (rem > 0 && debt.status !== 'cancelled') {
            totalProductOpen += rem;
            openDebtsCount++;
          }
        }
      }

      totalMonthlyOpen = Number(totalMonthlyOpen.toFixed(2));
      totalProductOpen = Number(totalProductOpen.toFixed(2));
      const totalOpen = Number((totalMonthlyOpen + totalProductOpen).toFixed(2));

      // Se não há mensalidades em aberto, garante que nextDueDate é nulo
      if (totalMonthlyOpen === 0) {
        nextDueDate = null;
      }

      // Get last non-reversed payment
      let lastPaymentDate: string | null = null;
      let lastPaymentAmount: number | null = null;
      try {
        const { data: latestPayment } = await supabase
          .from('payments')
          .select('paid_at, amount, status')
          .eq('student_id', canonicalId)
          .neq('status', 'reversed')
          .order('paid_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPayment) {
          lastPaymentDate = latestPayment.paid_at;
          lastPaymentAmount = Number(latestPayment.amount) || 0;
        }
      } catch (pErr) {
        // Non-fatal if payment query fails
      }

      // Check total history to detect if student has any fees or debts ever registered
      let totalFeesEver = 0;
      let totalDebtsEver = 0;
      try {
        const { count: cFees } = await supabase
          .from('monthly_fees')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', canonicalId)
          .neq('status', 'cancelled');
        totalFeesEver = cFees || 0;

        const { count: cDebts } = await supabase
          .from('product_debts')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', canonicalId)
          .neq('status', 'cancelled');
        totalDebtsEver = cDebts || 0;
      } catch (cntErr) {
        // non-fatal
      }

      // Status EXCLUSIVO das mensalidades (não considera produtos)
      let monthlyStatus: 'SEM_MENSALIDADE' | 'EM_DIA' | 'PENDENTE' | 'EM_ATRASO';
      if (totalFeesEver === 0) {
        monthlyStatus = 'SEM_MENSALIDADE';
      } else if (overdueCount > 0) {
        monthlyStatus = 'EM_ATRASO';
      } else if (totalMonthlyOpen > 0) {
        monthlyStatus = 'PENDENTE';
      } else {
        monthlyStatus = 'EM_DIA';
      }

      // Status EXCLUSIVO dos produtos
      const productStatus: 'NENHUM_DEBITO' | 'PENDENTE' =
        totalProductOpen > 0 ? 'PENDENTE' : 'NENHUM_DEBITO';

      // Status geral de mensalidades (NUNCA afetado por débitos de produtos)
      let status: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO';
      if (totalFeesEver === 0) {
        status = 'SEM MENSALIDADE';
      } else if (overdueCount > 0) {
        status = 'EM ATRASO';
      } else if (totalMonthlyOpen > 0) {
        status = 'PENDENTE';
      } else {
        status = 'EM DIA';
      }

      return {
        status,
        totalOpen,
        totalMonthlyOpen,
        totalProductOpen,
        openFeesCount,
        openDebtsCount,
        nextDueDate,
        overdueCount,
        totalFeesEver,
        totalDebtsEver,
        monthlyStatus,
        productStatus,
        lastPaymentDate,
        lastPaymentAmount,
      };
    } catch (err) {
      console.warn('Erro ao carregar resumo do aluno:', err);
      return {
        status: 'SEM MENSALIDADE',
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
      };
    }
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

      const fees = (data || []) as MonthlyFee[];
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

      const debts = (data || []) as ProductDebt[];
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

      // Se encontramos pagamentos na tabela payments
      if (payments && payments.length > 0) {
        const feeIds = Array.from(new Set(payments.map((p) => p.monthly_fee_id).filter(Boolean)));
        const debtIds = Array.from(new Set(payments.map((p) => p.product_debt_id).filter(Boolean)));

        const feeMap = new Map<string, { description: string; reference_month: string }>();
        const debtMap = new Map<string, { product_name_snapshot: string }>();

        if (feeIds.length > 0) {
          try {
            const { data: fees } = await supabase
              .from('monthly_fees')
              .select('id, description, reference_month')
              .in('id', feeIds);
            (fees || []).forEach((f) => {
              feeMap.set(f.id, { description: f.description, reference_month: f.reference_month });
            });
          } catch (e) {
            console.warn('Erro ao carregar mensalidades vinculadas aos pagamentos:', e);
          }
        }

        if (debtIds.length > 0) {
          try {
            const { data: debts } = await supabase
              .from('product_debts')
              .select('id, product_name_snapshot')
              .in('id', debtIds);
            (debts || []).forEach((d) => {
              debtMap.set(d.id, { product_name_snapshot: d.product_name_snapshot });
            });
          } catch (e) {
            console.warn('Erro ao carregar débitos de produtos vinculados:', e);
          }
        }

        const methodMap: Record<string, string> = {
          pix: 'PIX',
          dinheiro: 'Dinheiro',
          cartao: 'Cartão',
          cartao_credito: 'Cartão de Crédito',
          cartao_debito: 'Cartão de Débito',
          transferencia: 'Transferência',
          outro: 'Outro',
        };

        return payments.map((p: any) => {
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
            status: p.status === 'reversed' ? 'reversed' : 'active',
            reversed_at: p.reversed_at || null,
            reversal_reason: p.reversal_reason || null,
          };
        });
      }

      // 2. Se a tabela payments não tiver registros, verificar em financial_movements SOMENTE os registros de pagamento
      const { data: movements } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('student_id', canonicalId)
        .in('type', ['PAYMENT', 'REVERSAL'])
        .order('created_at', { ascending: false });

      if (movements && movements.length > 0) {
        return movements.map((m: any) => {
          const isReversed = m.type === 'REVERSAL';
          let title = m.description || 'Pagamento';
          title = title.replace(/^Pagamento registrado:\s*/i, '').replace(/^Reversão de pagamento:\s*/i, '');
          title = title.replace(/\s*\((PIX|DINHEIRO|CARTÃO|CARTAO|TRANSFERÊNCIA|TRANSFERENCIA|OUTRO)\)/i, '');

          const methodMatch = m.description?.match(/\((PIX|DINHEIRO|CART[ÃA]O|TRANSFER[ÊE]NCIA|OUTRO)\)/i);
          const method = methodMatch ? methodMatch[1].toUpperCase() : 'PIX';

          return {
            id: m.id,
            student_id: m.student_id,
            payment_type: m.reference_type === 'product_debt' ? 'product' : 'monthly_fee',
            title: title.trim() || 'Pagamento registrado',
            amount: Number(m.movement_amount) || 0,
            payment_method: method,
            paid_at: m.created_at,
            notes: m.notes || null,
            status: isReversed ? 'reversed' : 'active',
            reversed_at: isReversed ? m.created_at : null,
            reversal_reason: isReversed ? m.notes : null,
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
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const monthStartIso = firstDayOfMonth.toISOString();

    // 1. Total de alunos ativos (tenta students primeiro, senão profiles)
    let totalStudents = 0;
    try {
      const { data: stds, error: stdErr } = await supabase
        .from('students')
        .select('id')
        .eq('active', true);

      if (!stdErr && stds) {
        totalStudents = stds.length;
      } else {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'student')
          .eq('active', true);
        totalStudents = profs ? profs.length : 0;
      }
    } catch {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .eq('active', true);
      totalStudents = profs ? profs.length : 0;
    }

    // 2. Mensalidades
    const { data: fees, error: fErr } = await supabase
      .from('monthly_fees')
      .select('student_id, remaining_amount, due_date, status')
      .in('status', ['pending', 'partial', 'overdue']);

    if (fErr) throw fErr;

    // 3. Débitos de produtos
    const { data: debts, error: dErr } = await supabase
      .from('product_debts')
      .select('student_id, remaining_amount, status')
      .in('status', ['open', 'partial']);

    if (dErr) throw dErr;

    // 4. Pagamentos do mês (excluindo os revertidos)
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('amount, paid_at, status')
      .gte('paid_at', monthStartIso);

    if (pErr) throw pErr;

    // 5. Últimas movimentações
    const { data: movements, error: mErr } = await supabase
      .from('financial_movements')
      .select('*, student:profiles(id, full_name, nickname)')
      .order('created_at', { ascending: false })
      .limit(8);

    if (mErr) throw mErr;

    // Calculations
    let totalToReceive = 0;
    let overdueFeesCount = 0;
    const pendingStudentIds = new Set<string>();

    if (fees) {
      for (const fee of fees) {
        const rem = Number(fee.remaining_amount) || 0;
        if (rem > 0) {
          totalToReceive += rem;
          pendingStudentIds.add(fee.student_id);
          if (fee.due_date < todayStr) {
            overdueFeesCount++;
          }
        }
      }
    }

    if (debts) {
      for (const debt of debts) {
        const rem = Number(debt.remaining_amount) || 0;
        if (rem > 0) {
          totalToReceive += rem;
          pendingStudentIds.add(debt.student_id);
        }
      }
    }

    let monthPaymentsTotal = 0;
    if (payments) {
      for (const p of payments) {
        if (p.status !== 'reversed') {
          monthPaymentsTotal += Number(p.amount) || 0;
        }
      }
    }

    // 6. Aniversariantes do Mês Atual (Dados reais de students)
    const spNow = getSaoPauloDate();
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

    try {
      let bStudents: any[] = [];
      const { data: stdBdays } = await supabase
        .from('students')
        .select('id, full_name, nickname, date_of_birth, whatsapp, guardian_name, guardian_phone, active')
        .eq('active', true)
        .not('date_of_birth', 'is', null);

      if (stdBdays && stdBdays.length > 0) {
        bStudents = stdBdays;
      } else {
        const { data: profBdays } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, date_of_birth, whatsapp, active')
          .eq('role', 'student')
          .eq('active', true)
          .not('date_of_birth', 'is', null);
        bStudents = profBdays || [];
      }

      let closestDiff = 999;

      for (const s of bStudents) {
        if (!s.date_of_birth) continue;
        const parts = s.date_of_birth.split('-');
        if (parts.length < 3) continue;
        const bMonth = parseInt(parts[1], 10);
        const bDay = parseInt(parts[2], 10);

        if (bMonth === spNow.month) {
          monthBirthdaysCount++;
          const turningAge = calculateTurningAge(s.date_of_birth, spNow.year);
          const hasGuardian = !!(s.guardian_name && s.guardian_phone);
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
    } catch (bErr) {
      console.error('Erro ao calcular aniversariantes no dashboard:', bErr);
    }

    return {
      totalStudents,
      studentsWithPending: pendingStudentIds.size,
      overdueFeesCount,
      totalToReceive,
      openProductDebtsCount: (debts || []).length,
      monthPaymentsTotal,
      recentMovements: (movements || []) as FinancialMovement[],
      monthBirthdaysCount,
      todayBirthdays,
      nextBirthday,
    };
  },

  // -------------------------------------------------------------
  // ADMIN: Lista de Alunos com Status Financeiro
  // -------------------------------------------------------------
  async getAllStudents(searchTerm: string = ''): Promise<StudentWithBalance[]> {
    let rawStudents: any[] = [];

    try {
      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .order('full_name', { ascending: true });

      if (!sErr && studentsData && studentsData.length > 0) {
        rawStudents = studentsData;
      } else {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .order('full_name', { ascending: true });
        if (pErr) throw pErr;
        rawStudents = profiles || [];
      }
    } catch {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name', { ascending: true });
      if (pErr) throw pErr;
      rawStudents = profiles || [];
    }

    if (!rawStudents || rawStudents.length === 0) return [];

    // Fetch all fees and debts (non-cancelled) to determine exact financial status:
    // - balanceMap: open balance
    // - hasHistoryMap: whether the student ever had any fee/debt assigned
    // - hasOverdueMap: whether student has any open fee whose due_date < today
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: allFees } = await supabase
      .from('monthly_fees')
      .select('student_id, remaining_amount, due_date, status')
      .neq('status', 'cancelled');

    const { data: allDebts } = await supabase
      .from('product_debts')
      .select('student_id, remaining_amount, status')
      .neq('status', 'cancelled');

    const balanceMap: Record<string, number> = {};
    const hasHistoryMap: Record<string, boolean> = {};
    const hasOverdueMap: Record<string, boolean> = {};

    if (allFees) {
      for (const f of allFees) {
        hasHistoryMap[f.student_id] = true;
        const rem = Number(f.remaining_amount) || 0;
        if (rem > 0) {
          balanceMap[f.student_id] = (balanceMap[f.student_id] || 0) + rem;
          if (f.due_date && f.due_date < todayStr) {
            hasOverdueMap[f.student_id] = true;
          }
        }
      }
    }

    if (allDebts) {
      for (const d of allDebts) {
        hasHistoryMap[d.student_id] = true;
        const rem = Number(d.remaining_amount) || 0;
        if (rem > 0) {
          balanceMap[d.student_id] = (balanceMap[d.student_id] || 0) + rem;
        }
      }
    }

    let result: StudentWithBalance[] = rawStudents.map((p) => {
      const openAmount = balanceMap[p.id] || 0;
      const hasHistory = hasHistoryMap[p.id] || false;
      const hasOverdue = hasOverdueMap[p.id] || false;

      let financialStatus: 'SEM MENSALIDADE' | 'EM DIA' | 'PENDENTE' | 'EM ATRASO' | 'INATIVO';
      if (!p.active) {
        financialStatus = 'INATIVO';
      } else if (!hasHistory) {
        financialStatus = 'SEM MENSALIDADE';
      } else if (hasOverdue) {
        financialStatus = 'EM ATRASO';
      } else if (openAmount > 0) {
        financialStatus = 'PENDENTE';
      } else {
        financialStatus = 'EM DIA';
      }

      return {
        ...p,
        totalOpen: Number(openAmount.toFixed(2)),
        financialStatus,
        role: 'student',
      };
    });

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.full_name || '').toLowerCase().includes(term) ||
          (s.nickname || '').toLowerCase().includes(term) ||
          (s.email || '').toLowerCase().includes(term) ||
          (s.whatsapp || '').includes(term) ||
          (s.whatsapp_normalized || '').includes(term) ||
          (s.guardian_name || '').toLowerCase().includes(term) ||
          (s.guardian_phone || '').includes(term) ||
          (s.guardian_phone_normalized || '').includes(term)
      );
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
      const { data: stdData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('active', true)
        .not('date_of_birth', 'is', null);

      if (!sErr && stdData && stdData.length > 0) {
        rawStudents = stdData;
      } else {
        const { data: profData, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .eq('active', true)
          .not('date_of_birth', 'is', null);
        if (pErr) throw pErr;
        rawStudents = profData || [];
      }
    } catch {
      const { data: profData, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('active', true)
        .not('date_of_birth', 'is', null);
      if (pErr) throw pErr;
      rawStudents = profData || [];
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
  }): Promise<Student> {
    const cleanWhatsApp = params.whatsapp ? normalizePhone(params.whatsapp) : null;
    const cleanGuardianPhone = params.guardianPhone ? normalizePhone(params.guardianPhone) : null;

    const newStudent = {
      full_name: params.fullName.trim(),
      nickname: params.nickname?.trim() || null,
      date_of_birth: params.dateOfBirth,
      address: params.address.trim(),
      whatsapp: params.whatsapp?.trim() || null,
      whatsapp_normalized: cleanWhatsApp,
      guardian_name: params.guardianName?.trim() || null,
      guardian_phone: params.guardianPhone?.trim() || null,
      guardian_phone_normalized: cleanGuardianPhone,
      registration_type: params.registrationType || 'admin_created',
      active: true,
    };

    const { data, error } = await supabase
      .from('students')
      .insert(newStudent)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao adicionar aluno na tabela students:', error);
      throw error;
    }

    return data as Student;
  },

  // -------------------------------------------------------------
  // ADMIN: Atualizar Dados do Aluno
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
    }
  ): Promise<void> {
    const cleanWhatsApp = params.whatsapp ? normalizePhone(params.whatsapp) : null;
    const cleanGuardianPhone = params.guardianPhone ? normalizePhone(params.guardianPhone) : null;
    const nowIso = new Date().toISOString();

    const updatePayload: any = {
      full_name: params.fullName.trim(),
      nickname: params.nickname?.trim() || null,
      date_of_birth: params.dateOfBirth,
      address: params.address.trim(),
      whatsapp: params.whatsapp?.trim() || null,
      whatsapp_normalized: cleanWhatsApp,
      guardian_name: params.guardianName?.trim() || null,
      guardian_phone: params.guardianPhone?.trim() || null,
      guardian_phone_normalized: cleanGuardianPhone,
      updated_at: nowIso,
    };

    if (params.active !== undefined) {
      updatePayload.active = params.active;
    }

    // 1. Tenta atualizar students
    try {
      await supabase.from('students').update(updatePayload).eq('id', studentId);
    } catch (err) {
      console.warn('Atualização em students falhou:', err);
    }

    // 2. Se houver registro correspondente em profiles, mantém sincronizado
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: params.fullName.trim(),
          nickname: params.nickname?.trim() || '',
          date_of_birth: params.dateOfBirth,
          address: params.address.trim(),
          whatsapp: params.whatsapp?.trim() || '',
          whatsapp_normalized: cleanWhatsApp || '',
          active: params.active !== undefined ? params.active : true,
          updated_at: nowIso,
        })
        .eq('id', studentId);
    } catch {
      // Perfil pode não existir se for aluno criado manualmente sem login
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Perfil Detalhado do Aluno
  // -------------------------------------------------------------
  async getStudentProfileWithDetails(studentId: string) {
    let studentRecord: any = null;

    try {
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (!sErr && sData) {
        studentRecord = {
          ...sData,
          role: 'student',
          email: sData.email || null,
        };
      }
    } catch {
      // Ignora e tenta profiles
    }

    if (!studentRecord) {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      if (pErr) throw pErr;
      studentRecord = profile;
    }

    const [feesRes, debtsRes, paymentsRes, movementsRes, notesRes] = await Promise.all([
      supabase.from('monthly_fees').select('*').eq('student_id', studentId).order('due_date', { ascending: false }),
      supabase.from('product_debts').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', studentId).order('paid_at', { ascending: false }),
      supabase.from('financial_movements').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('internal_notes').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
    ]);

    const fees = (feesRes.data || []) as MonthlyFee[];
    const debts = (debtsRes.data || []) as ProductDebt[];
    const payments = (paymentsRes.data || []) as Payment[];
    const movements = (movementsRes.data || []) as FinancialMovement[];
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
  // ADMIN: Adicionar Mensalidade
  // -------------------------------------------------------------
  async addMonthlyFee(params: {
    studentId: string;
    referenceMonth: string;
    description?: string;
    amount: number;
    dueDate: string;
    notes?: string;
    adminId?: string;
    adminEmail?: string;
  }): Promise<MonthlyFee> {
    if (params.amount <= 0) {
      throw new Error('O valor da mensalidade deve ser maior que zero.');
    }
    if (!params.referenceMonth || !params.referenceMonth.trim()) {
      throw new Error('Mês de referência é obrigatório.');
    }
    if (!params.dueDate) {
      throw new Error('Data de vencimento é obrigatória.');
    }

    // Garante que o studentId aponta para o ID oficial em public.students
    const targetStudentId = await this.ensureStudentId(params.studentId);
    // Normalizar referenceMonth estritamente para formato ISO YYYY-MM-DD para compatibilidade com coluna PostgreSQL DATE
    const refMonth = toIsoDateString(params.referenceMonth, 1);
    const monthLabel = deriveReferenceMonth(refMonth);
    const desc = params.description?.trim() || `Mensalidade ${monthLabel}`;
    const cleanNotes = params.notes?.trim() || null;
    const isLate = isOverdue(params.dueDate, params.amount);
    const initialStatus = isLate ? 'overdue' : 'pending';

    let insertedFee: any = null;
    let insertError: any = null;

    const basePayload: Record<string, any> = {
      student_id: targetStudentId,
      reference_month: refMonth, // Sempre YYYY-MM-DD
      description: desc,
      amount: params.amount,
      amount_paid: 0,
      remaining_amount: params.amount,
      due_date: toIsoDateString(params.dueDate) || params.dueDate,
      status: initialStatus,
      notes: cleanNotes,
    };

    if (params.adminId) {
      basePayload.created_by = params.adminId;
    }

    const { data: res1, error: err1 } = await supabase
      .from('monthly_fees')
      .insert(basePayload)
      .select('*')
      .maybeSingle();

    if (!err1 && res1) {
      insertedFee = res1;
    } else {
      insertError = err1;
      console.warn('Primeira tentativa de adicionar mensalidade:', err1?.message);

      // Se falhou por status check constraint (ex: open vs pending)
      if (err1?.message?.includes('status') || err1?.code === '23514') {
        const payloadWithOpen = { ...basePayload, status: 'open' };
        const { data: res2, error: err2 } = await supabase
          .from('monthly_fees')
          .insert(payloadWithOpen)
          .select('*')
          .maybeSingle();

        if (!err2 && res2) {
          insertedFee = res2;
          insertError = null;
        } else {
          insertError = err2;
        }
      }

      // Se falhou por created_by foreign key
      if (insertError && basePayload.created_by) {
        const payloadNoCreatedBy = { ...basePayload };
        delete payloadNoCreatedBy.created_by;
        const { data: res3, error: err3 } = await supabase
          .from('monthly_fees')
          .insert(payloadNoCreatedBy)
          .select('*')
          .maybeSingle();

        if (!err3 && res3) {
          insertedFee = res3;
          insertError = null;
        } else if (err3?.message?.includes('status') || err3?.code === '23514') {
          payloadNoCreatedBy.status = 'open';
          const { data: res4, error: err4 } = await supabase
            .from('monthly_fees')
            .insert(payloadNoCreatedBy)
            .select('*')
            .maybeSingle();

          if (!err4 && res4) {
            insertedFee = res4;
            insertError = null;
          }
        }
      }
    }

    if (insertError && !insertedFee) {
      throw new Error(insertError.message || 'Falha ao salvar mensalidade no banco de dados.');
    }

    const finalFee: MonthlyFee = insertedFee || {
      id: 'fee_' + Date.now(),
      student_id: targetStudentId,
      reference_month: refMonth,
      description: desc,
      amount: params.amount,
      amount_paid: 0,
      remaining_amount: params.amount,
      due_date: params.dueDate,
      status: initialStatus as any,
      notes: cleanNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Registrar no histórico / auditoria sem travar a operação se falhar
    try {
      await supabase.from('financial_movements').insert({
        student_id: targetStudentId,
        type: 'MONTHLY_FEE_CREATED',
        reference_type: 'monthly_fee',
        reference_id: finalFee.id,
        description: `Mensalidade ${refMonth} adicionada`,
        previous_amount: 0,
        movement_amount: params.amount,
        new_amount: params.amount,
        performed_by: params.adminId || null,
        performed_by_email: params.adminEmail || null,
        notes: cleanNotes,
      });
    } catch (moveErr) {
      console.warn('Aviso: auditoria da mensalidade não pôde ser gravada:', moveErr);
    }

    return finalFee;
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
    // 1. Obter alunos ativos priorizando a tabela public.students
    let activeStudents: Array<{ id: string; full_name: string; nickname?: string | null }> = [];
    try {
      const { data: stds, error: sErr } = await supabase
        .from('students')
        .select('id, full_name, nickname')
        .eq('active', true);
      if (!sErr && stds && stds.length > 0) {
        activeStudents = stds;
      }
    } catch {
      // fallback para profiles
    }

    if (activeStudents.length === 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, nickname')
        .eq('role', 'student')
        .eq('active', true);
      activeStudents = profs || [];
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

      try {
        await this.addMonthlyFee({
          studentId: student.id,
          referenceMonth: params.referenceMonth,
          description: `Mensalidade ${params.referenceMonth.trim()}`,
          amount: params.defaultAmount,
          dueDate,
          notes: 'Gerada em lote pelo sistema',
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

    const { data: debt, error: dErr } = await supabase
      .from('product_debts')
      .insert({
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
        created_by: params.adminId || null,
      })
      .select('*')
      .single();

    if (dErr) throw dErr;

    // Registrar no histórico / auditoria sem travar
    try {
      await supabase.from('financial_movements').insert({
        student_id: targetStudentId,
        type: 'PRODUCT_DEBT_CREATED',
        reference_type: 'product_debt',
        reference_id: debt.id,
        description: `Produto adicionado: ${params.productName.trim()} (${params.quantity}x)`,
        previous_amount: 0,
        movement_amount: totalAmount,
        new_amount: totalAmount,
        performed_by: params.adminId || null,
        performed_by_email: params.adminEmail || null,
        notes: params.notes || null,
      });
    } catch (auditErr) {
      console.warn('Aviso: auditoria do débito de produto não pôde ser gravada:', auditErr);
    }

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
      const { data: payment, error: pErr } = await supabase
        .from('payments')
        .insert({
          student_id: targetStudentId,
          payment_type: 'monthly_fee',
          monthly_fee_id: params.monthlyFeeId,
          amount: params.amount,
          payment_method: params.paymentMethod,
          notes: params.notes?.trim() || null,
          recorded_by: params.adminId || null,
          recorded_by_email: params.adminEmail || null,
          paid_at: nowIso,
        })
        .select('*')
        .single();

      if (pErr) throw pErr;

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
          performed_by: params.adminId || null,
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
          const { nextReferenceMonth, nextDueDate, nextDescription } = getNextMonthlyFeeDetails(
            fee.reference_month,
            fee.due_date
          );

          // Verificar se já existe mensalidade para esse aluno no próximo mês
          const { data: existingFees } = await supabase
            .from('monthly_fees')
            .select('id, reference_month, status')
            .eq('student_id', targetStudentId);

          const alreadyExists = (existingFees || []).some((f) => {
            if (f.status === 'cancelled') return false;
            const ref = (f.reference_month || '').toLowerCase().trim();
            const target = nextReferenceMonth.toLowerCase().trim();
            return ref === target || ref.includes(target) || target.includes(ref);
          });

          if (!alreadyExists) {
            // Cria a próxima mensalidade com o MESMO VALOR da atual e MESMO DIA de vencimento
            const newFeePayload: Record<string, any> = {
              student_id: targetStudentId,
              reference_month: nextReferenceMonth,
              description: nextDescription,
              amount: fee.amount,
              amount_paid: 0,
              remaining_amount: fee.amount,
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
        } catch (autoErr) {
          console.error('Erro na geração automática da próxima mensalidade:', autoErr);
        }
      }

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
      const { data: payment, error: pErr } = await supabase
        .from('payments')
        .insert({
          student_id: targetStudentId,
          payment_type: 'product',
          product_debt_id: params.productDebtId,
          amount: params.amount,
          payment_method: params.paymentMethod,
          notes: params.notes?.trim() || null,
          recorded_by: params.adminId || null,
          recorded_by_email: params.adminEmail || null,
          paid_at: nowIso,
        })
        .select('*')
        .single();

      if (pErr) throw pErr;

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
          performed_by: params.adminId || null,
          performed_by_email: params.adminEmail || null,
          notes: params.notes || null,
        });
      } catch (auditErr) {
        console.warn('Aviso: auditoria do pagamento de produto não pôde ser gravada:', auditErr);
      }

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
    await supabase.from('financial_movements').insert({
      student_id: payment.student_id,
      type: 'REVERSAL',
      reference_type: 'payment',
      reference_id: payment.id,
      description: `Reversão de pagamento de ${formatCurrency(payment.amount)} (${payment.payment_type === 'monthly_fee' ? 'Mensalidade' : 'Produto'}). Motivo: ${params.reason.trim()}`,
      previous_amount: payment.amount,
      movement_amount: payment.amount,
      new_amount: 0,
      performed_by: params.adminId || null,
      performed_by_email: params.adminEmail || null,
      notes: params.reason.trim(),
    });

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

    await supabase.from('financial_movements').insert({
      student_id: fee.student_id,
      type: 'CANCELLATION',
      reference_type: 'monthly_fee',
      reference_id: fee.id,
      description: `Cancelamento de mensalidade ${fee.reference_month}. Motivo: ${params.reason.trim()}`,
      previous_amount: fee.amount,
      movement_amount: fee.amount,
      new_amount: 0,
      performed_by: params.adminId || null,
      performed_by_email: params.adminEmail || null,
      notes: params.reason.trim(),
    });
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

    await supabase.from('financial_movements').insert({
      student_id: debt.student_id,
      type: 'CANCELLATION',
      reference_type: 'product_debt',
      reference_id: debt.id,
      description: `Cancelamento do produto ${debt.product_name_snapshot}. Motivo: ${params.reason.trim()}`,
      previous_amount: debt.total_amount,
      movement_amount: debt.total_amount,
      new_amount: 0,
      performed_by: params.adminId || null,
      performed_by_email: params.adminEmail || null,
      notes: params.reason.trim(),
    });
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
      await supabase.from('financial_movements').insert({
        student_id: params.studentId,
        type: 'ADJUSTMENT',
        reference_type: 'monthly_fee',
        reference_id: params.itemId,
        description: `Ajuste de valor: Mensalidade ${fee.reference_month}`,
        previous_amount: prevAmount,
        movement_amount: Number((params.newTotalAmount - prevAmount).toFixed(2)),
        new_amount: params.newTotalAmount,
        performed_by: params.adminId || null,
        performed_by_email: params.adminEmail || null,
        notes: params.reason,
      });

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
      await supabase.from('financial_movements').insert({
        student_id: params.studentId,
        type: 'ADJUSTMENT',
        reference_type: 'product_debt',
        reference_id: params.itemId,
        description: `Ajuste de valor: Produto ${debt.product_name_snapshot}`,
        previous_amount: prevAmount,
        movement_amount: Number((params.newTotalAmount - prevAmount).toFixed(2)),
        new_amount: params.newTotalAmount,
        performed_by: params.adminId || null,
        performed_by_email: params.adminEmail || null,
        notes: params.reason,
      });
    }
  },

  // -------------------------------------------------------------
  // ADMIN: Obter dados individuais do aluno
  // -------------------------------------------------------------
  async getStudentById(studentId: string): Promise<(Student & Profile) | null> {
    try {
      // 1. Tenta buscar por ID direto em public.students
      const { data: student, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (!sErr && student) {
        return {
          ...student,
          role: 'student',
          email: student.email || null,
        } as unknown as (Student & Profile);
      }

      // 2. Tenta buscar por user_id em public.students
      const { data: studentByUser, error: uErr } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', studentId)
        .maybeSingle();

      if (!uErr && studentByUser) {
        return {
          ...studentByUser,
          role: 'student',
          email: studentByUser.email || null,
        } as unknown as (Student & Profile);
      }
    } catch (e) {
      console.warn('Erro ao buscar aluno na tabela students:', e);
    }

    try {
      // 3. Fallback para tabela profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (error || !profile) {
        return null;
      }

      // Se encontrou em profiles, tenta encontrar o ID correspondente em students
      const canonicalId = await this.ensureStudentId(studentId);
      return {
        ...profile,
        id: canonicalId, // Garante que operações subsequentes usem o ID canônico
      } as (Student & Profile);
    } catch (profErr) {
      console.error('Erro ao buscar perfil do aluno:', profErr);
      return null;
    }
  },

  async getStudentPayments(studentId: string): Promise<Payment[]> {
    try {
      const targetId = await this.ensureStudentId(studentId);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', targetId)
        .order('paid_at', { ascending: false });

      if (error) {
        console.warn('Aviso ao buscar pagamentos do aluno:', error.message);
        return [];
      }
      return (data || []) as Payment[];
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
      .select('*, student:profiles(id, full_name, nickname, whatsapp)')
      .order('due_date', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0];
        query = query.lt('due_date', todayStr).gt('remaining_amount', 0).neq('status', 'cancelled');
      } else {
        query = query.eq('status', filterStatus);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MonthlyFee[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todos os débitos de produtos (Geral)
  // -------------------------------------------------------------
  async getAllProductDebts(filterStatus?: string) {
    let query = supabase
      .from('product_debts')
      .select('*, student:profiles(id, full_name, nickname, whatsapp)')
      .order('created_at', { ascending: false });

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ProductDebt[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todos os pagamentos (Geral)
  // -------------------------------------------------------------
  async getAllPayments(limit: number = 50) {
    const { data, error } = await supabase
      .from('payments')
      .select('*, student:profiles(id, full_name, nickname, email)')
      .order('paid_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as Payment[];
  },

  // -------------------------------------------------------------
  // ADMIN: Listar todas as movimentações financeiras (Geral)
  // -------------------------------------------------------------
  async getAllMovements(limit: number = 100) {
    const { data, error } = await supabase
      .from('financial_movements')
      .select('*, student:profiles(id, full_name, nickname)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as FinancialMovement[];
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
        return { default_fee_amount: 120, default_due_day: 10 };
      }
      return data.value as { default_fee_amount: number; default_due_day: number };
    } catch {
      return { default_fee_amount: 120, default_due_day: 10 };
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
};
