import { createClient } from '@supabase/supabase-js';

async function auditTables() {
  const url = 'https://vukrtgmjehumqdzvyqum.supabase.co';
  const key = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';
  const supabase = createClient(url, key);

  console.log('--- AUDITORIA DE LEITURA (url: vukrtgmjehumqdzvyqum) ---');

  // 1. public.students
  try {
    const res = await supabase.from('students').select('*');
    console.log('students count:', res.data?.length, 'error:', res.error?.message, 'status:', res.status);
    if (res.data && res.data.length > 0) {
      console.log('students sample:', res.data[0]);
    }
  } catch (e: any) {
    console.log('students exception:', e.message);
  }

  // 2. public.profiles
  try {
    const res = await supabase.from('profiles').select('*');
    console.log('profiles count:', res.data?.length, 'error:', res.error?.message);
    if (res.data) {
      const roles = res.data.map(p => p.role);
      console.log('profiles roles distribution:', roles.reduce((acc: any, r: string) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {}));
      console.log('profiles sample:', res.data[0]);
    }
  } catch (e: any) {
    console.log('profiles exception:', e.message);
  }

  // 3. monthly_fees
  try {
    const res = await supabase.from('monthly_fees').select('*');
    console.log('monthly_fees count:', res.data?.length, 'error:', res.error?.message);
  } catch (e: any) {
    console.log('monthly_fees exception:', e.message);
  }

  // 4. payments
  try {
    const res = await supabase.from('payments').select('*');
    console.log('payments count:', res.data?.length, 'error:', res.error?.message);
  } catch (e: any) {
    console.log('payments exception:', e.message);
  }

  // 5. product_debts
  try {
    const res = await supabase.from('product_debts').select('*');
    console.log('product_debts count:', res.data?.length, 'error:', res.error?.message);
  } catch (e: any) {
    console.log('product_debts exception:', e.message);
  }

  // 6. financial_movements
  try {
    const res = await supabase.from('financial_movements').select('*');
    console.log('financial_movements count:', res.data?.length, 'error:', res.error?.message);
  } catch (e: any) {
    console.log('financial_movements exception:', e.message);
  }
}

auditTables();
