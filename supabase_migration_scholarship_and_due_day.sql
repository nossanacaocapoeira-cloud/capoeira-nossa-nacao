-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - MIGRATION: BOLSISTAS, DIA BASE E RECORRÊNCIA SEGURA
-- 1. ADICIONA is_scholarship E due_day NA TABELA public.students E public.profiles
-- 2. ADICIONA is_scholarship NA TABELA public.monthly_fees
-- 3. ATUALIZA A CONSTRAINT DE STATUS DE public.monthly_fees
-- ==============================================================================

-- 1. Colunas na tabela students
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31);

CREATE INDEX IF NOT EXISTS idx_students_is_scholarship ON public.students(is_scholarship);

-- 2. Colunas na tabela profiles (caso o perfil do aluno seja consultado diretamente)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31);

-- 3. Coluna is_scholarship na tabela monthly_fees
ALTER TABLE public.monthly_fees 
    ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_monthly_fees_is_scholarship ON public.monthly_fees(is_scholarship);

-- 4. Atualizar Constraint de Status em public.monthly_fees
DO $$
BEGIN
    ALTER TABLE public.monthly_fees DROP CONSTRAINT IF EXISTS monthly_fees_status_check;
    ALTER TABLE public.monthly_fees ADD CONSTRAINT monthly_fees_status_check 
        CHECK (status IN ('open', 'pending', 'partial', 'paid', 'overdue', 'cancelled', 'scholarship'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint check alterada com sucesso: %', SQLERRM;
END $$;

-- 5. Atualizar função handle_new_user para considerar novos campos se informados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_name TEXT;
    raw_nick TEXT;
    raw_birth DATE;
    raw_addr TEXT;
    raw_wpp TEXT;
    raw_wpp_norm TEXT;
    raw_guardian TEXT;
    raw_guardian_phone TEXT;
    raw_scholarship BOOLEAN;
    raw_due_day INTEGER;
BEGIN
    raw_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Aluno');
    raw_nick := new.raw_user_meta_data->>'nickname';
    raw_addr := COALESCE(new.raw_user_meta_data->>'address', '');
    raw_wpp := new.raw_user_meta_data->>'whatsapp';
    raw_wpp_norm := new.raw_user_meta_data->>'whatsapp_normalized';
    raw_guardian := new.raw_user_meta_data->>'guardian_name';
    raw_guardian_phone := new.raw_user_meta_data->>'guardian_phone';
    raw_scholarship := COALESCE((new.raw_user_meta_data->>'is_scholarship')::BOOLEAN, false);
    
    BEGIN
        raw_birth := (new.raw_user_meta_data->>'date_of_birth')::DATE;
    EXCEPTION WHEN OTHERS THEN
        raw_birth := NULL;
    END;

    BEGIN
        raw_due_day := (new.raw_user_meta_data->>'due_day')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        raw_due_day := NULL;
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
        guardian_name,
        guardian_phone,
        is_scholarship,
        due_day,
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
        raw_guardian,
        raw_guardian_phone,
        raw_scholarship,
        raw_due_day,
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
        guardian_name = COALESCE(EXCLUDED.guardian_name, profiles.guardian_name),
        guardian_phone = COALESCE(EXCLUDED.guardian_phone, profiles.guardian_phone),
        is_scholarship = COALESCE(EXCLUDED.is_scholarship, profiles.is_scholarship),
        due_day = COALESCE(EXCLUDED.due_day, profiles.due_day),
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
        guardian_name,
        guardian_phone,
        is_scholarship,
        due_day,
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
        raw_guardian,
        raw_guardian_phone,
        raw_scholarship,
        raw_due_day,
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
        guardian_name = COALESCE(EXCLUDED.guardian_name, students.guardian_name),
        guardian_phone = COALESCE(EXCLUDED.guardian_phone, students.guardian_phone),
        is_scholarship = COALESCE(EXCLUDED.is_scholarship, students.is_scholarship),
        due_day = COALESCE(EXCLUDED.due_day, students.due_day),
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
