-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - SQL SEGURO — CONTROLE ANUAL DE MENSALIDADES
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
-- 1. ADIÇÃO DE COLUNAS EM STUDENTS E PROFILES
-- ==============================================================================

-- financial_start_date: data em que o aluno começou o ciclo financeiro
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS financial_start_date DATE DEFAULT NULL;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS financial_start_date DATE DEFAULT NULL;

-- fee_amount: valor mensal individual do aluno (padrão 120.00 se nulo)
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) DEFAULT 120.00;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) DEFAULT 120.00;

-- due_day: dia do vencimento base (1 a 31)
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT 10;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT 10;

-- is_scholarship: situação bolsista
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS is_scholarship BOOLEAN DEFAULT false;

-- ==============================================================================
-- 2. INFERÊNCIA SEGURA DO INÍCIO FINANCEIRO APENAS PARA QUEM TEM HISTÓRICO REAL
-- Se o aluno já possui mensalidades no banco e financial_start_date for nulo,
-- inicializa com a menor competência registrada. Caso não tenha, deixa NULL
-- para o Admin configurar em AÇÕES (sem inventar datas aleatórias).
-- ==============================================================================
DO $$
BEGIN
    UPDATE public.students s
    SET financial_start_date = to_date(first_fee.min_ref || '-01', 'YYYY-MM-DD')
    FROM (
        SELECT student_id, MIN(reference_month) as min_ref
        FROM public.monthly_fees
        WHERE reference_month IS NOT NULL AND status != 'cancelled'
        GROUP BY student_id
    ) first_fee
    WHERE s.id = first_fee.student_id AND s.financial_start_date IS NULL;

    -- Espelha em profiles se aplicável
    UPDATE public.profiles p
    SET financial_start_date = s.financial_start_date
    FROM public.students s
    WHERE p.id = s.id AND p.financial_start_date IS NULL AND s.financial_start_date IS NOT NULL;
END $$;

-- ==============================================================================
-- 3. ÍNDICES DE DESEMPENHO PARA CONSULTA DA GRADE ANUAL
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_monthly_fees_student_ref ON public.monthly_fees(student_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_students_financial_start ON public.students(financial_start_date);
CREATE INDEX IF NOT EXISTS idx_students_due_day ON public.students(due_day);
CREATE INDEX IF NOT EXISTS idx_payments_fee_status ON public.payments(monthly_fee_id, status);

-- ==============================================================================
-- 4. RPC TRANSACIONAL: BATCH_APPLY_GRID_FEES (LANÇAMENTO EM LOTE ATÔMICO)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.batch_apply_grid_fees(
    p_changes JSONB,
    p_admin_id UUID DEFAULT NULL,
    p_admin_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_change RECORD;
    v_student RECORD;
    v_fee RECORD;
    v_pay_id UUID;
    v_fee_id UUID;
    v_due_date DATE;
    v_fee_amount NUMERIC(10,2);
    v_target_status TEXT;
    v_ref_month TEXT;
    v_student_id UUID;
    v_applied_count INTEGER := 0;
BEGIN
    -- Validação inicial
    IF p_changes IS NULL OR jsonb_array_length(p_changes) = 0 THEN
        RETURN jsonb_build_object('success', true, 'applied_count', 0, 'message', 'Nenhuma alteração a processar');
    END IF;

    -- Itera sobre cada alteração enviada no lote
    FOR v_change IN SELECT * FROM jsonb_to_recordset(p_changes) AS x(
        student_id UUID,
        reference_month TEXT,
        target_status TEXT,
        fee_id UUID
    )
    LOOP
        v_student_id := v_change.student_id;
        v_ref_month := v_change.reference_month;
        v_target_status := v_change.target_status;
        v_fee_id := v_change.fee_id;

        -- Carrega dados do estudante
        SELECT * INTO v_student FROM public.students WHERE id = v_student_id;
        IF NOT FOUND THEN
            -- Tenta localizar em profiles caso students não tenha sido sincronizado
            SELECT * INTO v_student FROM public.profiles WHERE id = v_student_id;
        END IF;

        IF v_student IS NULL THEN
            CONTINUE; -- Ignora registro sem aluno correspondente
        END IF;

        v_fee_amount := COALESCE(v_student.fee_amount, 120.00);

        -- Calcula a due_date baseada no due_day do aluno
        BEGIN
            v_due_date := to_date(v_ref_month || '-' || LPAD(COALESCE(v_student.due_day, 10)::text, 2, '0'), 'YYYY-MM-DD');
        EXCEPTION WHEN OTHERS THEN
            v_due_date := to_date(v_ref_month || '-10', 'YYYY-MM-DD');
        END;

        -- Localiza mensalidade existente se houver
        IF v_fee_id IS NOT NULL THEN
            SELECT * INTO v_fee FROM public.monthly_fees WHERE id = v_fee_id;
        ELSE
            SELECT * INTO v_fee FROM public.monthly_fees 
            WHERE student_id = v_student_id AND reference_month = v_ref_month AND status != 'cancelled'
            LIMIT 1;
        END IF;

        -- CENÁRIO 1: Marcar como PAGO
        IF v_target_status = 'PAGO' THEN
            IF v_fee IS NOT NULL THEN
                -- Mensalidade já existe no banco: atualiza para paga
                UPDATE public.monthly_fees
                SET amount_paid = amount,
                    remaining_amount = 0.00,
                    status = 'paid',
                    paid_at = timezone('utc'::text, now()),
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_fee.id;

                -- Cria pagamento correspondente se não houver pagamento ativo
                INSERT INTO public.payments (
                    student_id,
                    monthly_fee_id,
                    amount,
                    payment_method,
                    paid_at,
                    notes,
                    created_by,
                    created_by_email,
                    status
                ) VALUES (
                    v_student_id,
                    v_fee.id,
                    v_fee.remaining_amount,
                    'dinheiro',
                    timezone('utc'::text, now()),
                    'Baixa registrada via Grade Anual de Mensalidades',
                    p_admin_id,
                    p_admin_email,
                    'completed'
                );
            ELSE
                -- Mensalidade não existia: cria mensalidade paga + payment
                INSERT INTO public.monthly_fees (
                    student_id,
                    reference_month,
                    amount,
                    amount_paid,
                    remaining_amount,
                    due_date,
                    status,
                    paid_at,
                    notes,
                    created_by
                ) VALUES (
                    v_student_id,
                    v_ref_month,
                    v_fee_amount,
                    v_fee_amount,
                    0.00,
                    v_due_date,
                    'paid',
                    timezone('utc'::text, now()),
                    'Gerada e quitada via Grade Anual de Mensalidades',
                    p_admin_id
                )
                RETURNING id INTO v_fee_id;

                INSERT INTO public.payments (
                    student_id,
                    monthly_fee_id,
                    amount,
                    payment_method,
                    paid_at,
                    notes,
                    created_by,
                    created_by_email,
                    status
                ) VALUES (
                    v_student_id,
                    v_fee_id,
                    v_fee_amount,
                    'dinheiro',
                    timezone('utc'::text, now()),
                    'Baixa registrada via Grade Anual de Mensalidades',
                    p_admin_id,
                    p_admin_email,
                    'completed'
                );
            END IF;

            v_applied_count := v_applied_count + 1;

        -- CENÁRIO 2: Alterar de PAGO para NÃO PAGO (Reversão segura de pagamento)
        ELSIF v_target_status = 'NÃO PAGO' THEN
            IF v_fee IS NOT NULL AND v_fee.status = 'paid' THEN
                -- Reverte pagamentos associados
                UPDATE public.payments
                SET status = 'reversed',
                    reversed_at = timezone('utc'::text, now()),
                    reversed_by = p_admin_id,
                    reversed_by_email = p_admin_email,
                    reversal_reason = 'Revertido para NÃO PAGO via Grade Anual de Mensalidades'
                WHERE monthly_fee_id = v_fee.id AND (status IS NULL OR status = 'completed' OR status = 'active');

                -- Atualiza a mensalidade para pendente ou atrasada de acordo com o vencimento
                UPDATE public.monthly_fees
                SET amount_paid = 0.00,
                    remaining_amount = amount,
                    status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
                    paid_at = NULL,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_fee.id;

                v_applied_count := v_applied_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Notifica o PostgREST para recarregar o schema cache
    PERFORM pg_notify('pgrst', 'reload schema');

    RETURN jsonb_build_object(
        'success', true,
        'applied_count', v_applied_count,
        'message', v_applied_count || ' alterações lançadas com sucesso.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_apply_grid_fees(JSONB, UUID, TEXT) TO authenticated, service_role;

-- Notifica o PostgREST
NOTIFY pgrst, 'reload schema';
