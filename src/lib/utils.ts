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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If format YYYY-MM-DD
    const parts = dueDate.trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const due = new Date(year, month, day);
        return due < today;
      }
    }

    const due = new Date(dueDate);
    if (!isNaN(due.getTime())) {
      due.setHours(0, 0, 0, 0);
      return due < today;
    }
    return false;
  } catch {
    return false;
  }
}

export const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Returns the current local date in YYYY-MM-DD format based strictly on the user's local device/browser,
 * preventing any UTC conversion off-by-one errors.
 */
export function getTodayLocalDateString(dateInput: Date = new Date()): string {
  const year = dateInput.getFullYear();
  const month = String(dateInput.getMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
 */
export function getNextMonthlyFeeDetails(
  referenceMonth: string,
  dueDate: string
): { nextReferenceMonth: string; nextDueDate: string; nextDescription: string } {
  // 1. Calculate next due date
  let dueYear = 2026;
  let dueMonth = 9; // 1-based
  let dueDay = 10;

  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const parts = dueDate.split('-');
    dueYear = parseInt(parts[0], 10);
    dueMonth = parseInt(parts[1], 10);
    dueDay = parseInt(parts[2], 10);
  } else if (dueDate) {
    const d = new Date(dueDate);
    if (!isNaN(d.getTime())) {
      dueYear = d.getFullYear();
      dueMonth = d.getMonth() + 1;
      dueDay = d.getDate();
    }
  }

  // Advance by 1 month
  let nextDueYear = dueYear;
  let nextDueMonth = dueMonth + 1;
  if (nextDueMonth > 12) {
    nextDueMonth = 1;
    nextDueYear += 1;
  }

  // Handle month boundary (e.g. 31st on a 30-day month)
  const maxDaysInNextMonth = new Date(nextDueYear, nextDueMonth, 0).getDate();
  const actualDueDay = Math.min(dueDay, maxDaysInNextMonth);

  const nextDueDate = `${nextDueYear}-${String(nextDueMonth).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;

  // 2. Calculate next reference date in ISO format YYYY-MM-DD
  // Use the reference date day if available, otherwise 1st of the month
  let refDay = 1;
  if (referenceMonth && /^\d{4}-\d{2}-\d{2}$/.test(referenceMonth.trim())) {
    const parts = referenceMonth.trim().split('-');
    refDay = parseInt(parts[2], 10) || 1;
  }

  const maxDaysRefMonth = new Date(nextDueYear, nextDueMonth, 0).getDate();
  const actualRefDay = Math.min(refDay, maxDaysRefMonth);
  const nextReferenceMonth = `${nextDueYear}-${String(nextDueMonth).padStart(2, '0')}-${String(actualRefDay).padStart(2, '0')}`;

  const monthLabel = PT_MONTHS[nextDueMonth - 1] || 'Mês';
  const nextDescription = `Mensalidade ${monthLabel}/${nextDueYear}`;

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
