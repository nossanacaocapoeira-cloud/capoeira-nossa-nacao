export const COMPLETE_SUPABASE_SQL = `-- ==============================================================================
-- CAPOEIRA NOSSA NAÇÃO - SISTEMA COMPLETO DE ALUNOS, MENSALIDADES E DÉBITOS
-- SCRIPT SQL COMPLETO PARA EXECUÇÃO NO SUPABASE SQL EDITOR
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  email TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  whatsapp_normalized TEXT NOT NULL,
  guardian_name TEXT,
  guardian_phone TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA: MONTHLY_FEES (MENSALIDADES)
CREATE TABLE IF NOT EXISTS public.monthly_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL, -- Ex: "Setembro/2026" ou "2026-09"
  description TEXT NOT NULL DEFAULT 'Mensalidade Capoeira',
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  remaining_amount NUMERIC(10,2) NOT NULL CHECK (remaining_amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  paid_at TIMESTAMPTZ
);

-- 4. TABELA: PRODUCTS (CATÁLOGO DE PRODUTOS)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Outros',
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABELA: PRODUCT_DEBTS (PRODUTOS EM DÉBITO)
CREATE TABLE IF NOT EXISTS public.product_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  remaining_amount NUMERIC(10,2) NOT NULL CHECK (remaining_amount >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  paid_at TIMESTAMPTZ
);

-- 6. TABELA: PAYMENTS (PAGAMENTOS E BAIXAS)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('monthly_fee', 'product', 'adjustment')),
  monthly_fee_id UUID REFERENCES public.monthly_fees(id) ON DELETE SET NULL,
  product_debt_id UUID REFERENCES public.product_debts(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  recorded_by_email TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABELA: FINANCIAL_MOVEMENTS (AUDITORIA E HISTÓRICO IMUTÁVEL)
CREATE TABLE IF NOT EXISTS public.financial_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('MONTHLY_FEE_CREATED', 'PRODUCT_DEBT_CREATED', 'PAYMENT', 'ADJUSTMENT', 'CANCELLATION')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('monthly_fee', 'product_debt', 'payment', 'adjustment')),
  reference_id UUID,
  description TEXT NOT NULL,
  previous_amount NUMERIC(10,2),
  movement_amount NUMERIC(10,2) NOT NULL,
  new_amount NUMERIC(10,2),
  performed_by UUID REFERENCES auth.users(id),
  performed_by_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABELA: INTERNAL_NOTES (OBSERVAÇÕES INTERNAS - APENAS ADMIN)
CREATE TABLE IF NOT EXISTS public.internal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABELA: SYSTEM_SETTINGS (CONFIGURAÇÕES DO SISTEMA)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Inserir configurações padrão se não existirem
INSERT INTO public.system_settings (key, value)
VALUES 
  ('financial_defaults', '{"default_fee_amount": 50.00, "default_due_day": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 10. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_student_id ON public.monthly_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_status ON public.monthly_fees(status);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_due_date ON public.monthly_fees(due_date);
CREATE INDEX IF NOT EXISTS idx_monthly_fees_reference_month ON public.monthly_fees(reference_month);
CREATE INDEX IF NOT EXISTS idx_product_debts_student_id ON public.product_debts(student_id);
CREATE INDEX IF NOT EXISTS idx_product_debts_status ON public.product_debts(status);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_movements_student_id ON public.financial_movements(student_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.financial_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_internal_notes_student_id ON public.internal_notes(student_id);

-- 11. FUNÇÃO SEGURA: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. TRIGGER: CRIAÇÃO AUTOMÁTICA DE PROFILE A PARTIR DE auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_nickname TEXT;
  v_dob DATE;
  v_address TEXT;
  v_whatsapp TEXT;
  v_whatsapp_norm TEXT;
  v_guardian_name TEXT;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Aluno');
  v_nickname  := COALESCE(new.raw_user_meta_data->>'nickname', v_full_name);
  v_address   := COALESCE(new.raw_user_meta_data->>'address', 'Não informado');
  v_whatsapp  := COALESCE(new.raw_user_meta_data->>'whatsapp', 'Não informado');
  v_whatsapp_norm := COALESCE(new.raw_user_meta_data->>'whatsapp_normalized', regexp_replace(v_whatsapp, '\\D', '', 'g'));
  v_guardian_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'guardian_name', '')), '');
  
  BEGIN
    v_dob := (new.raw_user_meta_data->>'date_of_birth')::date;
  EXCEPTION WHEN OTHERS THEN
    v_dob := CURRENT_DATE - INTERVAL '18 years';
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    nickname,
    email,
    date_of_birth,
    address,
    whatsapp,
    whatsapp_normalized,
    guardian_name,
    role,
    active
  ) VALUES (
    new.id,
    v_full_name,
    v_nickname,
    new.email,
    v_dob,
    v_address,
    v_whatsapp,
    v_whatsapp_norm,
    v_guardian_name,
    'student', -- Todo cadastro público nasce OBRIGATORIAMENTE como student
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 14. POLÍTICAS RLS: PROFILES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 15. POLÍTICAS RLS: MONTHLY_FEES
DROP POLICY IF EXISTS "monthly_fees_select" ON public.monthly_fees;
CREATE POLICY "monthly_fees_select" ON public.monthly_fees
  FOR SELECT USING (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "monthly_fees_admin_insert" ON public.monthly_fees;
CREATE POLICY "monthly_fees_admin_insert" ON public.monthly_fees
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "monthly_fees_admin_update" ON public.monthly_fees;
CREATE POLICY "monthly_fees_admin_update" ON public.monthly_fees
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "monthly_fees_admin_delete" ON public.monthly_fees;
CREATE POLICY "monthly_fees_admin_delete" ON public.monthly_fees
  FOR DELETE USING (public.is_admin());

-- 16. POLÍTICAS RLS: PRODUCTS
DROP POLICY IF EXISTS "products_select_active" ON public.products;
CREATE POLICY "products_select_active" ON public.products
  FOR SELECT USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all" ON public.products
  FOR ALL USING (public.is_admin());

-- 17. POLÍTICAS RLS: PRODUCT_DEBTS
DROP POLICY IF EXISTS "product_debts_select" ON public.product_debts;
CREATE POLICY "product_debts_select" ON public.product_debts
  FOR SELECT USING (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "product_debts_admin_insert" ON public.product_debts;
CREATE POLICY "product_debts_admin_insert" ON public.product_debts
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_debts_admin_update" ON public.product_debts;
CREATE POLICY "product_debts_admin_update" ON public.product_debts
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "product_debts_admin_delete" ON public.product_debts;
CREATE POLICY "product_debts_admin_delete" ON public.product_debts
  FOR DELETE USING (public.is_admin());

-- 18. POLÍTICAS RLS: PAYMENTS
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "payments_admin_insert" ON public.payments;
CREATE POLICY "payments_admin_insert" ON public.payments
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payments_admin_update" ON public.payments;
CREATE POLICY "payments_admin_update" ON public.payments
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "payments_admin_delete" ON public.payments;
CREATE POLICY "payments_admin_delete" ON public.payments
  FOR DELETE USING (public.is_admin());

-- 19. POLÍTICAS RLS: FINANCIAL_MOVEMENTS
DROP POLICY IF EXISTS "financial_movements_select" ON public.financial_movements;
CREATE POLICY "financial_movements_select" ON public.financial_movements
  FOR SELECT USING (student_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "financial_movements_admin_insert" ON public.financial_movements;
CREATE POLICY "financial_movements_admin_insert" ON public.financial_movements
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "financial_movements_admin_delete" ON public.financial_movements;
CREATE POLICY "financial_movements_admin_delete" ON public.financial_movements
  FOR DELETE USING (public.is_admin());

-- 20. POLÍTICAS RLS: INTERNAL_NOTES (SOMENTE ADMIN)
DROP POLICY IF EXISTS "internal_notes_admin_all" ON public.internal_notes;
CREATE POLICY "internal_notes_admin_all" ON public.internal_notes
  FOR ALL USING (public.is_admin());

-- 21. POLÍTICAS RLS: SYSTEM_SETTINGS
DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
CREATE POLICY "system_settings_select" ON public.system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_settings_admin" ON public.system_settings;
CREATE POLICY "system_settings_admin" ON public.system_settings
  FOR ALL USING (public.is_admin());

-- 22. PRODUTOS INICIAIS DA ACADEMIA
INSERT INTO public.products (name, category, description, price, active)
VALUES
  ('Camiseta Oficial Capoeira Nossa Nação', 'Camisetas', 'Camiseta de algodão com estampa da academia', 80.00, true),
  ('Calça de Capoeira Tradicional', 'Calças', 'Calça helanca branca reforçada para treino e roda', 150.00, true),
  ('Abadá Branco Oficial', 'Abadás', 'Abadá padrão para eventos, batizados e graduações', 120.00, true),
  ('Corda de Graduação', 'Acessórios', 'Corda trançada artesanal para graduação de capoeira', 60.00, true),
  ('Uniforme Completo (Abadá + Camiseta)', 'Uniformes', 'Kit promocional de uniforme para novos alunos', 180.00, true)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- COMO PROMOVER UM USUÁRIO A ADMINISTRADOR:
-- No SQL Editor do Supabase, execute:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'nossanacaocapoeira@gmail.com';
-- ==============================================================================
`;

export const SUPABASE_SCHEMA_SQL = COMPLETE_SUPABASE_SQL;
