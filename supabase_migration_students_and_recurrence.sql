-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - MIGRATION COMPLETA DE EVOLUÇÃO DO BANCO DE DADOS
-- 1. TABELA STUDENTS (Cadastro manual, crianças, responsáveis, sem e-mail/senha obrigatórios)
-- 2. SUPORTE A REVERSÕES AUDITÁVEIS (Payments status 'active' / 'reversed')
-- 3. MENSALIDADES RECORRENTES AUTOMÁTICAS E CANCELAMENTOS
-- 4. MIGRAÇÃO DE DADOS EXISTENTES DE PROFILES PARA STUDENTS
-- ==============================================================================

-- Habilita extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. CRIAÇÃO DA TABELA STUDENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    nickname TEXT,
    date_of_birth DATE,
    address TEXT,
    whatsapp TEXT,
    whatsapp_normalized TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_phone_normalized TEXT,
    registration_type TEXT NOT NULL DEFAULT 'self_registered', -- 'self_registered' ou 'admin_created'
    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(active);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students(full_name);

-- ------------------------------------------------------------------------------
-- 2. MIGRAÇÃO DOS DADOS ATUAIS DE PROFILES PARA STUDENTS
-- Preserva rigorosamente o mesmo ID para não quebrar referências existentes
-- ------------------------------------------------------------------------------
INSERT INTO public.students (
    id,
    user_id,
    full_name,
    nickname,
    date_of_birth,
    address,
    whatsapp,
    whatsapp_normalized,
    registration_type,
    active,
    created_at,
    updated_at
)
SELECT
    p.id,
    p.id,
    COALESCE(p.full_name, 'Aluno'),
    p.nickname,
    p.date_of_birth,
    COALESCE(p.address, ''),
    p.whatsapp,
    p.whatsapp_normalized,
    'self_registered',
    COALESCE(p.active, true),
    COALESCE(p.created_at, now()),
    COALESCE(p.updated_at, now())
FROM public.profiles p
WHERE p.role = 'student' OR p.role IS NULL
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    nickname = COALESCE(EXCLUDED.nickname, public.students.nickname),
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.students.date_of_birth),
    address = COALESCE(EXCLUDED.address, public.students.address),
    whatsapp = COALESCE(EXCLUDED.whatsapp, public.students.whatsapp),
    whatsapp_normalized = COALESCE(EXCLUDED.whatsapp_normalized, public.students.whatsapp_normalized);

-- ------------------------------------------------------------------------------
-- 3. EVOLUÇÃO DA TABELA PAYMENTS (REVERSÕES AUDITADAS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reversed_by UUID,
    ADD COLUMN IF NOT EXISTS reversed_by_email TEXT,
    ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

DO $$
BEGIN
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN ('active', 'reversed'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 4. EVOLUÇÃO DA TABELA MONTHLY_FEES (RECORRÊNCIA E CANCELAMENTOS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.monthly_fees 
    ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generated_from_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID,
    ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

DO $$
BEGIN
    ALTER TABLE public.monthly_fees DROP CONSTRAINT IF EXISTS monthly_fees_status_check;
    ALTER TABLE public.monthly_fees ADD CONSTRAINT monthly_fees_status_check CHECK (status IN ('open', 'partial', 'paid', 'cancelled'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 5. EVOLUÇÃO DA TABELA PRODUCT_DEBTS (CANCELAMENTOS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_debts 
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID,
    ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

DO $$
BEGIN
    ALTER TABLE public.product_debts DROP CONSTRAINT IF EXISTS product_debts_status_check;
    ALTER TABLE public.product_debts ADD CONSTRAINT product_debts_status_check CHECK (status IN ('open', 'partial', 'paid', 'cancelled'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 6. ATUALIZAÇÃO DAS CHAVES ESTRANGEIRAS PARA APONTAR PARA STUDENTS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- monthly_fees
    ALTER TABLE public.monthly_fees DROP CONSTRAINT IF EXISTS monthly_fees_student_id_fkey;
    ALTER TABLE public.monthly_fees ADD CONSTRAINT monthly_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

    -- product_debts
    ALTER TABLE public.product_debts DROP CONSTRAINT IF EXISTS product_debts_student_id_fkey;
    ALTER TABLE public.product_debts ADD CONSTRAINT product_debts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

    -- payments
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
    ALTER TABLE public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

    -- financial_movements
    ALTER TABLE public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_student_id_fkey;
    ALTER TABLE public.financial_movements ADD CONSTRAINT financial_movements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

    -- internal_notes
    ALTER TABLE public.internal_notes DROP CONSTRAINT IF EXISTS internal_notes_student_id_fkey;
    ALTER TABLE public.internal_notes ADD CONSTRAINT internal_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Aviso de Foreign Keys: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- 7. SEGURANÇA E RLS (ROW LEVEL SECURITY) PARA STUDENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to students" ON public.students;
CREATE POLICY "Admins have full access to students"
ON public.students
FOR ALL
TO authenticated
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

DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
CREATE POLICY "Students can view their own record"
ON public.students
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 8. TRIGGER DE SINCRONIZAÇÃO AUTOMÁTICA EM AUTH.USERS (AUTO CADASTRO)
-- Garante que quando um aluno se cadastrar pelo link público, ele é criado
-- tanto em profiles quanto em students com todos os dados.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_name TEXT;
    raw_nick TEXT;
    raw_birth DATE;
    raw_addr TEXT;
    raw_wpp TEXT;
    raw_wpp_norm TEXT;
BEGIN
    raw_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Aluno');
    raw_nick := new.raw_user_meta_data->>'nickname';
    raw_addr := COALESCE(new.raw_user_meta_data->>'address', '');
    raw_wpp := new.raw_user_meta_data->>'whatsapp';
    raw_wpp_norm := new.raw_user_meta_data->>'whatsapp_normalized';
    
    BEGIN
        raw_birth := (new.raw_user_meta_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
        raw_birth := NULL;
    END;

    -- 1. Cria ou atualiza profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        nickname,
        date_of_birth,
        address,
        whatsapp,
        whatsapp_normalized,
        role,
        active,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        new.email,
        raw_name,
        raw_nick,
        raw_birth,
        raw_addr,
        raw_wpp,
        raw_wpp_norm,
        'student',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        nickname = COALESCE(EXCLUDED.nickname, profiles.nickname),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth),
        address = COALESCE(EXCLUDED.address, profiles.address),
        whatsapp = COALESCE(EXCLUDED.whatsapp, profiles.whatsapp),
        whatsapp_normalized = COALESCE(EXCLUDED.whatsapp_normalized, profiles.whatsapp_normalized),
        updated_at = now();

    -- 2. Cria ou atualiza students
    INSERT INTO public.students (
        id,
        user_id,
        full_name,
        nickname,
        date_of_birth,
        address,
        whatsapp,
        whatsapp_normalized,
        registration_type,
        active,
        created_at,
        updated_at
    )
    VALUES (
        new.id,
        new.id,
        raw_name,
        raw_nick,
        raw_birth,
        raw_addr,
        raw_wpp,
        raw_wpp_norm,
        'self_registered',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        full_name = EXCLUDED.full_name,
        nickname = COALESCE(EXCLUDED.nickname, students.nickname),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, students.date_of_birth),
        address = COALESCE(EXCLUDED.address, students.address),
        whatsapp = COALESCE(EXCLUDED.whatsapp, students.whatsapp),
        whatsapp_normalized = COALESCE(EXCLUDED.whatsapp_normalized, students.whatsapp_normalized),
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garante que a trigger está ativa em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
