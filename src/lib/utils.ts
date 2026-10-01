export const ACADEMY_INFO = {
  name: 'Capoeira Nossa Nação',
  instagram: '@capoeiranossanacao_oficial',
  instagramUrl: 'https://instagram.com/capoeiranossanacao_oficial',
  whatsapp: '(62) 99986-8309',
  whatsappNormalized: '5562999868309',
  whatsappUrl: 'https://wa.me/5562999868309',
};

export function formatCurrency(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(numeric)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normaliza strings para busca insensível a maiúsculas/minúsculas e acentos (ex: Antônio -> antonio)
 */
export function normalizeSearch(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Retorna 'YYYY-MM' no fuso horário oficial America/Sao_Paulo a partir de uma data ou timestamp
 */
export function getSaoPauloYearMonth(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    });
    return formatter.format(d); // Formato 'YYYY-MM'
  } catch {
    return String(dateString).substring(0, 7);
  }
}

export function maskPhone(value: string): string {
  const digits = normalizePhone(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function getWhatsAppLink(phone: string, message?: string): string {
  let clean = normalizePhone(phone);
  if (!clean.startsWith('55') && clean.length >= 10) {
    clean = '55' + clean;
  }
  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${clean}${encodedMsg}`;
}

export function isOverdue(
  dueDate: string | null | undefined,
  remainingAmount: number | string | null | undefined
): boolean {
  const rem = typeof remainingAmount === 'string' ? parseFloat(remainingAmount) : (remainingAmount ?? 0);
  if (isNaN(rem) || rem <= 0) return false;
  if (!dueDate || typeof dueDate !== 'string') return false;

  try {
    const todayStr = getSaoPauloDateString();
    const cleanDue = dueDate.trim().substring(0, 10);
    return cleanDue < todayStr;
  } catch {
    return false;
  }
}

export const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Returns current date in YYYY-MM-DD format strictly in America/Sao_Paulo timezone.
 */
export function getSaoPauloDateString(): string {
  const { year, month, day } = getSaoPauloDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the current local date in YYYY-MM-DD format based strictly on the user's local device/browser,
 * preventing any UTC conversion off-by-one errors.
 */
export function getTodayLocalDateString(dateInput: Date = new Date()): string {
  // Prefer America/Sao_Paulo date string for financial calculations
  return getSaoPauloDateString();
}

/**
 * Calculates the due date for the same day of the following month (+1 month).
 * Handles shorter months correctly (e.g., 31/01/2026 -> 28/02/2026 or 29/02 in leap years;
 * 31/03/2026 -> 30/04/2026) without ever generating Invalid Date.
 */
export function calculateNextMonthDueDate(referenceDateStr: string): string {
  if (!referenceDateStr) return '';

  let year: number;
  let month: number;
  let day: number;

  const trimmed = referenceDateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return '';
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  let targetYear = year;
  let targetMonth = month + 1;
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear += 1;
  }

  // Last day of targetMonth in targetYear (targetMonth is 1-based, passing targetMonth to month parameter in JS Date gives last day of targetMonth)
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  const targetMonthStr = String(targetMonth).padStart(2, '0');
  const targetDayStr = String(targetDay).padStart(2, '0');

  return `${targetYear}-${targetMonthStr}-${targetDayStr}`;
}

/**
 * Derives the database-compatible reference month (e.g. "Setembro/2026") from a full reference date (YYYY-MM-DD or DD/MM/YYYY).
 */
export function deriveReferenceMonth(referenceDateStr: string): string {
  if (!referenceDateStr) return '';

  let year: number = 2026;
  let month: number = 9;

  const trimmed = referenceDateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  const monthName = PT_MONTHS[month - 1] || 'Setembro';
  return `${monthName}/${year}`;
}

/**
 * Checks if a value is a valid UUID v4
 */
export function isUuid(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Converts any reference month into a standardized ISO date for the 1st of that month (YYYY-MM-01).
 * Suitable for PostgreSQL DATE or TEXT columns.
 */
export function toReferenceMonthIso(val: string | null | undefined): string {
  if (!val) {
    const today = getTodayLocalDateString();
    return `${today.substring(0, 7)}-01`;
  }
  const iso = toIsoDateString(val, 1);
  if (/^\d{4}-\d{2}/.test(iso)) {
    return `${iso.substring(0, 7)}-01`;
  }
  const today = getTodayLocalDateString();
  return `${today.substring(0, 7)}-01`;
}

/**
 * Extracts standard YYYY-MM competence prefix from any reference string.
 */
export function toReferenceYearMonth(val: string | null | undefined): string {
  const refIso = toReferenceMonthIso(val);
  return refIso.substring(0, 7);
}

/**
 * Converts any date format (YYYY-MM-DD, DD/MM/YYYY, YYYY-MM, or "Setembro/2026")
 * into a valid ISO date string (YYYY-MM-DD) suitable for PostgreSQL DATE columns.
 */
export function toIsoDateString(val: string | null | undefined, defaultDay: number = 1): string {
  if (!val) return '';
  const trimmed = val.trim();

  // Pattern YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Pattern DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Pattern YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [y, m] = trimmed.split('-');
    return `${y}-${m.padStart(2, '0')}-${String(defaultDay).padStart(2, '0')}`;
  }

  // Pattern "Setembro/2026" or "Setembro / 2026"
  const ptMatch = trimmed.match(/^([A-Za-zçÇãÃáÁéÉíÍóÓúÚ]+)\s*\/\s*(\d{4})$/i);
  if (ptMatch) {
    const nameStr = ptMatch[1].toLowerCase();
    const yearNum = parseInt(ptMatch[2], 10);
    const monthIndex = PT_MONTHS.findIndex(
      (m) =>
        m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
        nameStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (monthIndex >= 0) {
      const monthNum = String(monthIndex + 1).padStart(2, '0');
      return `${yearNum}-${monthNum}-${String(defaultDay).padStart(2, '0')}`;
    }
  }

  return trimmed;
}

/**
 * Formats a reference month / date for user-friendly UI display.
 * Example: "2026-09-16" -> "16/09/2026"
 * Example: "2026-09" -> "Setembro/2026"
 * Example: "Setembro/2026" -> "Setembro/2026"
 */
export function formatReferenceDisplay(ref: string | null | undefined): string {
  if (!ref) return '';
  const trimmed = ref.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    const monthIndex = parseInt(m, 10) - 1;
    const monthName = PT_MONTHS[monthIndex] || '';
    return `${d}/${m}/${y} (${monthName})`;
  }

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    const y = parts[0];
    const m = parts[1];
    const monthIndex = parseInt(m, 10) - 1;
    const monthName = PT_MONTHS[monthIndex] || '';
    return `${monthName}/${y}`;
  }

  return trimmed;
}

/**
 * Calculates the next reference month and due date, preserving the exact due day.
 * Returns reference month as ISO date string (YYYY-MM-DD) for database compatibility,
 * and nextDescription for user readability.
 * NEVER skips months (e.g. 17/09 -> 17/10 -> 17/11).
 */
export function getNextMonthlyFeeDetails(
  referenceMonth: string,
  dueDate: string,
  baseDueDay?: number | null
): { nextReferenceMonth: string; nextDueDate: string; nextDescription: string } {
  // 1. Determine reference month and year (competência)
  let refYear = 2026;
  let refMonth = 9; // 1-based
  let refDay = 17;

  if (referenceMonth && /^\d{4}-\d{2}-\d{2}$/.test(referenceMonth.trim())) {
    const parts = referenceMonth.trim().split('-');
    refYear = parseInt(parts[0], 10);
    refMonth = parseInt(parts[1], 10);
    refDay = parseInt(parts[2], 10);
  } else if (referenceMonth) {
    const d = new Date(referenceMonth);
    if (!isNaN(d.getTime())) {
      refYear = d.getFullYear();
      refMonth = d.getMonth() + 1;
      refDay = d.getDate();
    }
  }

  // 2. Determine base due day
  let dueDay = baseDueDay || refDay || 17;
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
    const parts = dueDate.trim().split('-');
    if (!baseDueDay) {
      dueDay = parseInt(parts[2], 10);
    }
  }

  // 3. Advance reference by EXACTLY 1 month (no month skipping)
  let nextRefYear = refYear;
  let nextRefMonth = refMonth + 1;
  if (nextRefMonth > 12) {
    nextRefMonth = 1;
    nextRefYear += 1;
  }

  const maxDaysInNextRefMonth = new Date(nextRefYear, nextRefMonth, 0).getDate();
  const actualRefDay = Math.min(refDay, maxDaysInNextRefMonth);
  const nextReferenceMonth = `${nextRefYear}-${String(nextRefMonth).padStart(2, '0')}-${String(actualRefDay).padStart(2, '0')}`;

  // 4. Calculate next due date:
  // If the previous due date was in the same month as reference, next due date is in nextRefMonth.
  // If the previous due date was 1 month ahead of reference, next due date is 1 month ahead of nextRefMonth.
  let dueDateIsNextMonth = false;
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
    const dParts = dueDate.trim().split('-');
    const dMonth = parseInt(dParts[1], 10);
    if (dMonth === nextRefMonth || (refMonth === 12 && dMonth === 1)) {
      dueDateIsNextMonth = true;
    }
  }

  let nextDueYear = nextRefYear;
  let nextDueMonth = nextRefMonth;
  if (dueDateIsNextMonth) {
    nextDueMonth += 1;
    if (nextDueMonth > 12) {
      nextDueMonth = 1;
      nextDueYear += 1;
    }
  }

  const maxDaysInNextDueMonth = new Date(nextDueYear, nextDueMonth, 0).getDate();
  const actualDueDay = Math.min(dueDay, maxDaysInNextDueMonth);
  const nextDueDate = `${nextDueYear}-${String(nextDueMonth).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;

  const monthLabel = PT_MONTHS[nextRefMonth - 1] || 'Mês';
  const nextDescription = `Mensalidade ${monthLabel}/${nextRefYear}`;

  return {
    nextReferenceMonth,
    nextDueDate,
    nextDescription,
  };
}

/**
 * Calculates age in years from date of birth (YYYY-MM-DD).
 */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  try {
    const parts = dateOfBirth.split('-');
    if (parts.length !== 3) return null;
    const birthDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Returns current year, month (1-12), and day (1-31) in America/Sao_Paulo timezone.
 */
export function getSaoPauloDate(): { year: number; month: number; day: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '9', 10);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '16', 10);
    return { year, month, day };
  } catch {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
}

/**
 * Calculates the age the student turns in the specified year (default current year).
 * Example: Birth 2017, Target 2026 -> Completa 9 anos.
 */
export function calculateTurningAge(
  dateOfBirth: string | null | undefined,
  targetYear?: number
): number | null {
  if (!dateOfBirth) return null;
  try {
    const parts = dateOfBirth.split('-');
    if (parts.length < 1) return null;
    const birthYear = parseInt(parts[0], 10);
    if (isNaN(birthYear) || birthYear <= 1900) return null;
    const year = targetYear ?? getSaoPauloDate().year;
    const turning = year - birthYear;
    return turning >= 0 ? turning : null;
  } catch {
    return null;
  }
}

/**
 * Formats birthday day and month name, e.g. "14 de setembro"
 */
export function formatBirthdayDisplay(day: number, month: number): string {
  const monthName = PT_MONTHS[month - 1] || '';
  return `${day} de ${monthName.toLowerCase()}`;
}

/**
 * Returns friendly countdown text for a birthday in the current month.
 */
export function getBirthdayCountdownLabel(birthDay: number, currentDay: number): {
  label: string;
  isToday: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  diff: number;
} {
  const diff = birthDay - currentDay;
  if (diff === 0) {
    return { label: 'Hoje', isToday: true, isUpcoming: false, isPast: false, diff: 0 };
  }
  if (diff === 1) {
    return { label: 'Amanhã', isToday: false, isUpcoming: true, isPast: false, diff: 1 };
  }
  if (diff > 1) {
    return { label: `Em ${diff} dias`, isToday: false, isUpcoming: true, isPast: false, diff };
  }
  const passed = Math.abs(diff);
  return {
    label: `Passou há ${passed} ${passed === 1 ? 'dia' : 'dias'}`,
    isToday: false,
    isUpcoming: false,
    isPast: true,
    diff,
  };
}

/**
 * Formats a phone or WhatsApp number for clean display.
 */
export function formatWhatsAppForDisplay(phone: string | null | undefined): string {
  return maskPhone(phone);
}

/**
 * Filtra e simplifica a exibição do histórico de movimentações financeiras:
 * - Exibe apenas lançamentos administrativos relevantes (uma ação = uma linha visual)
 * - Remove registros técnicos redundantes (sincronização, payment criado/atualizado, etc.)
 */
export function filterAdministrativeMovements<
  T extends {
    description?: string;
    notes?: string | null;
    type?: string;
    student_id?: string;
    reference_id?: string | null;
    created_at?: string;
  }
>(movements: T[]): T[] {
  const technicalKeywords = [
    'sincronização',
    'sincronizacao',
    'sync',
    'status atualizado',
    'payment criado',
    'payment atualizado',
    'movimentação interna',
    'movimentacao interna',
    'atualização de status',
    'auditoria interna',
  ];

  const filtered = movements.filter((m) => {
    const desc = (m.description || '').toLowerCase();
    const notes = (m.notes || '').toLowerCase();
    const isTechnical = technicalKeywords.some((kw) => desc.includes(kw) || notes.includes(kw));
    return !isTechnical;
  });

  // Deduplica eventos quase simultâneos para o mesmo aluno e referência
  const result: T[] = [];
  const seenKeys = new Set<string>();

  for (const m of filtered) {
    const timeKey = m.created_at ? Math.floor(new Date(m.created_at).getTime() / 15000) : '';
    const key = `${m.student_id || ''}_${m.reference_id || ''}_${m.type || ''}_${timeKey}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(m);
    }
  }

  return result;
}

