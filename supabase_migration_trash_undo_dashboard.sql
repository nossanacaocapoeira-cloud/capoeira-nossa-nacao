-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - SQL DE MIGRAÇÃO SEGURA — LIXEIRA + UNDO + DASHBOARD
-- ==============================================================================
-- ATENÇÃO: ESTE SCRIPT É 100% SEGURO E NÃO-DESTRUTIVO.
-- NÃO UTILIZA: DROP TABLE, TRUNCATE OU DELETE GERAL.
-- PRESERVA TODOS OS ALUNOS (31), MENSALIDADES, PAGAMENTOS, PRODUTOS E HISTÓRICO.
-- EXECUTE NO SUPABASE SQL EDITOR (COPIAR E COLAR INTEGRALMENTE).
-- ==============================================================================

-- 0. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABELA STUDENTS (FONTE OFICIAL DOS ALUNOS DA ACADEMIA)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    nickname TEXT,
    email TEXT,
    date_of_birth DATE,
    address TEXT,
    whatsapp TEXT,
    whatsapp_normalized TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_phone_normalized TEXT,
    registration_type TEXT NOT NULL DEFAULT 'self_registered',
    active BOOLEAN NOT NULL DEFAULT true,
    is_scholarship BOOLEAN NOT NULL DEFAULT false,
    due_day INTEGER NOT NULL DEFAULT 10,
    fee_amount NUMERIC(10,2) NOT NULL DEFAULT 120.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    deletion_reason TEXT DEFAULT NULL
);

-- Adiciona colunas necessárias de forma idempotente caso a tabela já existisse
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS due_day INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) NOT NULL DEFAULT 120.00;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Garante que se houver registros antigos com active = null, fiquem active = true
UPDATE public.students SET active = true WHERE active IS NULL;

-- ------------------------------------------------------------------------------
-- 2. MIGRAÇÃO SEGURA: PROFILES -> STUDENTS (GARANTIA DOS 31 ALUNOS)
-- Copia alunos que existam em profiles mas ainda não estejam em students
-- ------------------------------------------------------------------------------
INSERT INTO public.students (
    id,
    user_id,
    full_name,
    nickname,
    email,
    date_of_birth,
    address,
    whatsapp,
    whatsapp_normalized,
    guardian_name,
    guardian_phone,
    registration_type,
    active,
    is_scholarship,
    created_at,
    updated_at
)
SELECT
    p.id,
    p.id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), 'Aluno'),
    p.nickname,
    p.email,
    p.date_of_birth,
    p.address,
    p.whatsapp,
    p.whatsapp_normalized,
    p.guardian_name,
    p.guardian_phone,
    'self_registered',
    COALESCE(p.active, true),
    COALESCE(p.is_scholarship, false),
    COALESCE(p.created_at, timezone('utc'::text, now())),
    COALESCE(p.updated_at, timezone('utc'::text, now()))
FROM public.profiles p
WHERE (p.role = 'student' OR p.role IS NULL)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    active = COALESCE(public.students.active, EXCLUDED.active, true);

-- ==============================================================================
-- 3. ADIÇÃO DE CAMPOS DE LIXEIRA NAS TABELAS OPERACIONAIS
-- ==============================================================================

-- A) MONTHLY_FEES
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;
ALTER TABLE public.monthly_fees ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN DEFAULT false;

-- B) PRODUCT_DEBTS
ALTER TABLE public.product_debts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.product_debts ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.product_debts ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- C) PAYMENTS
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- D) FINANCIAL_MOVEMENTS
ALTER TABLE public.financial_movements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.financial_movements ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.financial_movements ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- E) INTERNAL_NOTES
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- ==============================================================================
-- 4. TABELA: ADMIN_ACTION_LOG (SISTEMA DE DESFAZER / AUDITORIA DE AÇÕES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    admin_email TEXT,
    action_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'PAYMENT', 'REVERSAL', 'SOFT_DELETE', 'RESTORE', 'PERMANENT_DELETE', 'ADJUSTMENT'
    entity_type TEXT NOT NULL, -- 'student', 'monthly_fee', 'product_debt', 'payment', 'financial_movement', 'internal_note'
    entity_id UUID NOT NULL,
    student_id UUID,
    summary TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB,
    can_undo BOOLEAN NOT NULL DEFAULT true,
    reverted_at TIMESTAMPTZ,
    reverted_by UUID REFERENCES auth.users(id),
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON public.students(deleted_at);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(active);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students(full_name);

CREATE INDEX IF NOT EXISTS idx_monthly_fees_deleted_at ON public.monthly_fees(deleted_at);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_student_id ON public.monthly_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_status ON public.monthly_fees(status);

CREATE INDEX IF NOT EXISTS idx_product_debts_deleted_at ON public.product_debts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_product_debts_student_id ON public.product_debts(student_id);

CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments(student_id);

CREATE INDEX IF NOT EXISTS idx_movements_deleted_at ON public.financial_movements(deleted_at);
CREATE INDEX IF NOT EXISTS idx_movements_student_id ON public.financial_movements(student_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON public.admin_action_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_entity ON public.admin_action_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_student ON public.admin_action_log(student_id);

-- ==============================================================================
-- 6. PERMISSÕES / GRANTS (CRÍTICO PARA EXPOR AO POSTGREST SEM 404 / 401)
-- ==============================================================================
GRANT ALL ON TABLE public.students TO authenticated, service_role;
GRANT SELECT ON TABLE public.students TO anon;

GRANT ALL ON TABLE public.monthly_fees TO authenticated, service_role;
GRANT SELECT ON TABLE public.monthly_fees TO anon;

GRANT ALL ON TABLE public.product_debts TO authenticated, service_role;
GRANT SELECT ON TABLE public.product_debts TO anon;

GRANT ALL ON TABLE public.payments TO authenticated, service_role;
GRANT SELECT ON TABLE public.payments TO anon;

GRANT ALL ON TABLE public.financial_movements TO authenticated, service_role;
GRANT SELECT ON TABLE public.financial_movements TO anon;

GRANT ALL ON TABLE public.internal_notes TO authenticated, service_role;

GRANT ALL ON TABLE public.admin_action_log TO authenticated, service_role;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

-- STUDENTS: Admins podem tudo; alunos podem visualizar seu próprio registro
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
CREATE POLICY "students_admin_all" ON public.students
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "students_select_own" ON public.students;
CREATE POLICY "students_select_own" ON public.students
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR id = auth.uid()
  );

-- ADMIN_ACTION_LOG: Apenas administradores
DROP POLICY IF EXISTS "admin_action_log_admin_all" ON public.admin_action_log;
CREATE POLICY "admin_action_log_admin_all" ON public.admin_action_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ==============================================================================
-- 8. RPCS TRANSACIONAIS SEGURAS (LIXEIRA, RESTAURAÇÃO E DESFAZER)
-- ==============================================================================

-- A) SOFT DELETE DE PAGAMENTO (RECALCULA MENSALIDADE OU PRODUTO VINCULADO)
CREATE OR REPLACE FUNCTION public.soft_delete_payment(
    p_payment_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Enviado para a lixeira pelo administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pay RECORD;
    v_fee RECORD;
    v_debt RECORD;
    v_new_amount_paid NUMERIC;
    v_new_remaining NUMERIC;
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado');
    END IF;

    IF v_pay.deleted_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pagamento já está na lixeira');
    END IF;

    -- Marca pagamento como soft-deleted
    UPDATE public.payments
    SET deleted_at = timezone('utc'::text, now()),
        deleted_by = p_admin_id,
        deletion_reason = p_reason
    WHERE id = p_payment_id;

    -- Se vinculado a mensalidade, recalcula saldo
    IF v_pay.monthly_fee_id IS NOT NULL THEN
        SELECT * INTO v_fee FROM public.monthly_fees WHERE id = v_pay.monthly_fee_id;
        IF FOUND THEN
            v_new_amount_paid := GREATEST(0, COALESCE(v_fee.amount_paid, 0) - v_pay.amount);
            v_new_remaining := LEAST(v_fee.amount, v_fee.amount - v_new_amount_paid);
            
            IF v_new_amount_paid = 0 THEN
                v_new_status := CASE WHEN v_fee.due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END;
            ELSIF v_new_remaining > 0 THEN
                v_new_status := 'partial';
            ELSE
                v_new_status := 'paid';
            END IF;

            UPDATE public.monthly_fees
            SET amount_paid = v_new_amount_paid,
                remaining_amount = v_new_remaining,
                status = v_new_status,
                paid_at = CASE WHEN v_new_remaining > 0 THEN NULL ELSE paid_at END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_pay.monthly_fee_id;
        END IF;
    END IF;

    -- Se vinculado a produto, recalcula saldo
    IF v_pay.product_debt_id IS NOT NULL THEN
        SELECT * INTO v_debt FROM public.product_debts WHERE id = v_pay.product_debt_id;
        IF FOUND THEN
            v_new_amount_paid := GREATEST(0, COALESCE(v_debt.amount_paid, 0) - v_pay.amount);
            v_new_remaining := LEAST(v_debt.total_amount, v_debt.total_amount - v_new_amount_paid);
            v_new_status := CASE WHEN v_new_amount_paid = 0 THEN 'open' ELSIF v_new_remaining > 0 THEN 'partial' ELSE 'paid' END;

            UPDATE public.product_debts
            SET amount_paid = v_new_amount_paid,
                remaining_amount = v_new_remaining,
                status = v_new_status,
                paid_at = CASE WHEN v_new_remaining > 0 THEN NULL ELSE paid_at END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_pay.product_debt_id;
        END IF;
    END IF;

    -- Registra no log de ações
    INSERT INTO public.admin_action_log (
        admin_id,
        action_type,
        entity_type,
        entity_id,
        student_id,
        summary,
        before_data,
        after_data
    ) VALUES (
        p_admin_id,
        'SOFT_DELETE',
        'payment',
        p_payment_id,
        v_pay.student_id,
        'Pagamento de ' || v_pay.amount || ' enviado para lixeira (' || COALESCE(p_reason, '') || ')',
        to_jsonb(v_pay),
        jsonb_build_object('deleted_at', now(), 'deleted_by', p_admin_id, 'deletion_reason', p_reason)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- B) RESTAURAÇÃO DE PAGAMENTO DA LIXEIRA (REAPLICA VALOR À MENSALIDADE OU PRODUTO)
CREATE OR REPLACE FUNCTION public.restore_payment(
    p_payment_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pay RECORD;
    v_fee RECORD;
    v_debt RECORD;
    v_new_amount_paid NUMERIC;
    v_new_remaining NUMERIC;
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pagamento não encontrado');
    END IF;

    -- Remove marcas de lixeira
    UPDATE public.payments
    SET deleted_at = NULL,
        deleted_by = NULL,
        deletion_reason = NULL
    WHERE id = p_payment_id;

    -- Se vinculado a mensalidade, reaplica pagamento
    IF v_pay.monthly_fee_id IS NOT NULL THEN
        SELECT * INTO v_fee FROM public.monthly_fees WHERE id = v_pay.monthly_fee_id;
        IF FOUND THEN
            v_new_amount_paid := LEAST(v_fee.amount, COALESCE(v_fee.amount_paid, 0) + v_pay.amount);
            v_new_remaining := GREATEST(0, v_fee.amount - v_new_amount_paid);
            v_new_status := CASE WHEN v_new_remaining = 0 THEN 'paid' ELSE 'partial' END;

            UPDATE public.monthly_fees
            SET amount_paid = v_new_amount_paid,
                remaining_amount = v_new_remaining,
                status = v_new_status,
                paid_at = CASE WHEN v_new_remaining = 0 THEN timezone('utc'::text, now()) ELSE paid_at END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_pay.monthly_fee_id;
        END IF;
    END IF;

    -- Se vinculado a produto, reaplica pagamento
    IF v_pay.product_debt_id IS NOT NULL THEN
        SELECT * INTO v_debt FROM public.product_debts WHERE id = v_pay.product_debt_id;
        IF FOUND THEN
            v_new_amount_paid := LEAST(v_debt.total_amount, COALESCE(v_debt.amount_paid, 0) + v_pay.amount);
            v_new_remaining := GREATEST(0, v_debt.total_amount - v_new_amount_paid);
            v_new_status := CASE WHEN v_new_remaining = 0 THEN 'paid' ELSE 'partial' END;

            UPDATE public.product_debts
            SET amount_paid = v_new_amount_paid,
                remaining_amount = v_new_remaining,
                status = v_new_status,
                paid_at = CASE WHEN v_new_remaining = 0 THEN timezone('utc'::text, now()) ELSE paid_at END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_pay.product_debt_id;
        END IF;
    END IF;

    -- Registra no log de ações
    INSERT INTO public.admin_action_log (
        admin_id,
        action_type,
        entity_type,
        entity_id,
        student_id,
        summary,
        after_data
    ) VALUES (
        p_admin_id,
        'RESTORE',
        'payment',
        p_payment_id,
        v_pay.student_id,
        'Pagamento de ' || v_pay.amount || ' restaurado da lixeira',
        to_jsonb(v_pay)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
