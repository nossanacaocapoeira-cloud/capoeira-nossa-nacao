export type UserRole = 'student' | 'admin';
export type StudentRegistrationType = 'self_registered' | 'admin_created';

export type MonthlyFeeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type ProductDebtStatus = 'open' | 'partial' | 'paid' | 'cancelled';
export type PaymentType = 'monthly_fee' | 'product' | 'adjustment';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro';
export type PaymentStatus = 'active' | 'reversed';

export type MovementType =
  | 'MONTHLY_FEE_CREATED'
  | 'PRODUCT_DEBT_CREATED'
  | 'PAYMENT'
  | 'ADJUSTMENT'
  | 'CANCELLATION'
  | 'REVERSAL';

export interface Profile {
  id: string; // matches auth.users.id
  full_name: string;
  nickname?: string | null;
  email: string;
  date_of_birth: string; // YYYY-MM-DD
  address: string;
  whatsapp: string;
  whatsapp_normalized: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  nickname?: string | null;
  date_of_birth: string; // YYYY-MM-DD
  address: string;
  whatsapp?: string | null;
  whatsapp_normalized?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_phone_normalized?: string | null;
  registration_type: StudentRegistrationType;
  active: boolean;
  email?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MonthlyFee {
  id: string;
  student_id: string;
  reference_month: string; // e.g. "2026-09" or "Setembro/2026"
  description: string;
  amount: number;
  amount_paid: number;
  remaining_amount: number;
  due_date: string; // YYYY-MM-DD
  status: MonthlyFeeStatus;
  notes?: string | null;
  created_by?: string | null;
  auto_generated_from_fee_id?: string | null;
  created_at: string;
  updated_at?: string;
  paid_at?: string | null;
  student?: Student | Profile;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  price: number;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ProductDebt {
  id: string;
  student_id: string;
  product_id?: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  remaining_amount: number;
  status: ProductDebtStatus;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  paid_at?: string | null;
  student?: Student | Profile;
}

export interface Payment {
  id: string;
  student_id: string;
  payment_type: PaymentType;
  monthly_fee_id?: string | null;
  product_debt_id?: string | null;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  recorded_by?: string | null;
  recorded_by_email?: string | null;
  registered_by_email?: string | null;
  status?: PaymentStatus;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversed_by_email?: string | null;
  reversal_reason?: string | null;
  paid_at: string;
  created_at: string;
  student?: Student | Profile;
}

export interface FinancialMovement {
  id: string;
  student_id: string;
  type: MovementType;
  reference_type: 'monthly_fee' | 'product_debt' | 'payment' | 'adjustment';
  reference_id?: string | null;
  description: string;
  previous_amount?: number | null;
  movement_amount: number;
  new_amount?: number | null;
  performed_by?: string | null;
  performed_by_email?: string | null;
  created_by_email?: string | null;
  notes?: string | null;
  created_at: string;
  student?: Student | Profile;
}

export interface InternalNote {
  id: string;
  student_id: string;
  text: string;
  created_by?: string | null;
  created_by_email?: string | null;
  created_at: string;
}

export interface SystemSettings {
  default_fee_amount: number;
  default_due_day: number;
}
