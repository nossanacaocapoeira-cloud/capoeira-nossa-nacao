-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - SCRIPT DE AUDITORIA E LIMPEZA FINANCEIRA DE TESTES
-- ==============================================================================
-- REGRA DE SEGURANÇA MÁXIMA:
-- 1. NENHUM ALUNO SERÁ APAGADO OU MODIFICADO.
-- 2. TABELAS PROIBIDAS DE SOFRER DELETE/TRUNCATE:
--    - public.students (PRESERVADA 100%)
--    - public.profiles (PRESERVADA 100%)
--    - auth.users      (PRESERVADA 100%)
-- 3. APENAS DADOS FINANCEIROS/HISTÓRICOS DE TESTE PODEM SER LIMPOS.
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: AUDITORIA PRÉVIA (EXECUTE PRIMEIRO PARA VER A CONTAGEM ATUAL)
-- ==============================================================================
SELECT 
    'public.profiles (Alunos/Admins)' AS tabela,
    COUNT(*) AS total_registros,
    COUNT(*) FILTER (WHERE role = 'student' OR role IS NULL) AS alunos,
    COUNT(*) FILTER (WHERE role = 'admin') AS administradores
FROM public.profiles
UNION ALL
SELECT 
    'public.monthly_fees' AS tabela,
    COUNT(*) AS total_registros,
    COUNT(*) FILTER (WHERE status = 'paid') AS pagas,
    COUNT(*) FILTER (WHERE status != 'paid') AS abertas
FROM public.monthly_fees
UNION ALL
SELECT 
    'public.payments' AS tabela,
    COUNT(*) AS total_registros,
    COUNT(*) FILTER (WHERE status = 'active' OR status IS NULL) AS ativos,
    COUNT(*) FILTER (WHERE status = 'reversed') AS revertidos
FROM public.payments
UNION ALL
SELECT 
    'public.financial_movements' AS tabela,
    COUNT(*) AS total_registros,
    COUNT(*) AS ativos,
    0 AS revertidos
FROM public.financial_movements
UNION ALL
SELECT 
    'public.product_debts' AS tabela,
    COUNT(*) AS total_registros,
    COUNT(*) FILTER (WHERE status = 'paid') AS quitados,
    COUNT(*) FILTER (WHERE status != 'paid') AS abertos
FROM public.product_debts;

-- ==============================================================================
-- PARTE 2: LIMPEZA CONTROLADA DOS LANÇAMENTOS FINANCEIROS DE TESTE
-- Execute somente após conferir a contagem da Parte 1.
-- ==============================================================================
-- Esta transação limpa o histórico de movimentações, pagamentos e mensalidades
-- de teste, deixando o sistema zerado para novos lançamentos pela Grade Anual.
-- NENHUM registro de aluno (public.profiles ou public.students) é tocado!
-- Configurações individuais (valor mensal, dia base, bolsista) são 100% PRESERVADAS.
-- ==============================================================================

BEGIN;

-- 1. Remove histórico de movimentações financeiras geradas em testes
DELETE FROM public.financial_movements;

-- 2. Remove registros de pagamentos de teste
DELETE FROM public.payments;

-- 3. Remove mensalidades geradas em testes
DELETE FROM public.monthly_fees;

-- ==============================================================================
-- PARTE 3: CONFERÊNCIA IMEDIATA DENTRO DA TRANSAÇÃO (SEGURANÇA)
-- ==============================================================================
-- Garante que os alunos continuam intactos antes de efetivar o COMMIT
DO $$
DECLARE
    v_total_students INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_students FROM public.profiles WHERE role = 'student' OR role IS NULL;
    IF v_total_students = 0 THEN
        RAISE EXCEPTION 'ABORTANDO: A tabela profiles não possui alunos! Nenhuma alteração foi gravada.';
    END IF;
    RAISE NOTICE 'AUDITORIA DE SEGURANÇA: % alunos preservados com sucesso.', v_total_students;
END $$;

COMMIT;

-- ==============================================================================
-- PARTE 4: AUDITORIA PÓS-LIMPEZA
-- ==============================================================================
SELECT 
    'public.profiles (PRESERVADO)' AS tabela,
    COUNT(*) AS total_registros
FROM public.profiles
UNION ALL
SELECT 
    'public.monthly_fees (LIMPO)' AS tabela,
    COUNT(*) AS total_registros
FROM public.monthly_fees
UNION ALL
SELECT 
    'public.payments (LIMPO)' AS tabela,
    COUNT(*) AS total_registros
FROM public.payments
UNION ALL
SELECT 
    'public.financial_movements (LIMPO)' AS tabela,
    COUNT(*) AS total_registros
FROM public.financial_movements;
