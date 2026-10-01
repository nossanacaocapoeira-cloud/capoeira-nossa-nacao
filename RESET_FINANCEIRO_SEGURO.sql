-- ==============================================================================
-- RESET FINANCEIRO SEGURO
-- ==============================================================================
-- Este script realiza a limpeza EXCLUSIVA das tabelas financeiras transacionais:
-- - public.financial_movements (histórico/movimentações de mensalidades)
-- - public.payments (pagamentos de mensalidades)
-- - public.monthly_fees (mensalidades)
--
-- PRESERVAÇÃO INTEGRAL (100% INTOCADOS):
-- - public.students / public.profiles (33 alunos mantidos)
-- - auth.users (contas de login e senhas intactas)
-- - nomes, apelidos, e-mails, telefones, aniversários, endereços, responsáveis
-- - configurações individuais: monthly_fee_amount, due_day, is_scholarship
-- - catálogo de produtos (public.products) e débitos de produtos (public.product_debts)
-- ==============================================================================

BEGIN;

-- 1. Limpa histórico de movimentações financeiras das mensalidades
DELETE FROM public.financial_movements 
WHERE reference_type = 'monthly_fee' OR reference_type IS NULL;

-- 2. Limpa pagamentos efetuados de mensalidades
DELETE FROM public.payments 
WHERE payment_type = 'monthly_fee' OR monthly_fee_id IS NOT NULL;

-- 3. Limpa todas as mensalidades registradas
DELETE FROM public.monthly_fees;

-- Confirma a transação com segurança absoluta
COMMIT;

-- ==============================================================================
-- FIM DO RESET FINANCEIRO SEGURO
-- Após executar este script, todos os alunos começarão com "SEM MENSALIDADE"
-- em todos os meses, preservando o valor configurado de cada um para os novos lançamentos.
-- ==============================================================================
