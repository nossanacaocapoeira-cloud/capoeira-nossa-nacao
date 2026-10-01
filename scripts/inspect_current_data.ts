import { createClient } from '@supabase/supabase-js';

const url = 'https://vukrtgmjehumqdzvyqum.supabase.co';
const key = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';
const supabase = createClient(url, key);

async function inspectData() {
  console.log('--- INSPECTING CURRENT DATABASE ---');
  
  // 1. Profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log('Profiles count:', profiles?.length, 'error:', pErr?.message);
  if (profiles && profiles.length > 0) {
    console.log('Sample profile fields:', Object.keys(profiles[0]));
    const studentProfiles = profiles.filter(p => p.role === 'student' || !p.role);
    console.log('Profiles with role student or null:', studentProfiles.length);
  }

  // 2. Students
  const { data: students, error: sErr } = await supabase.from('students').select('*');
  console.log('Students count:', students?.length, 'error:', sErr?.message);
  if (students && students.length > 0) {
    console.log('Sample student fields:', Object.keys(students[0]));
  }

  // 3. Monthly Fees
  const { data: fees, error: fErr } = await supabase.from('monthly_fees').select('*');
  console.log('Monthly fees count:', fees?.length, 'error:', fErr?.message);
  if (fees && fees.length > 0) {
    console.log('Sample monthly_fee fields:', Object.keys(fees[0]));
    console.log('Distinct reference_months:', Array.from(new Set(fees.map(f => f.reference_month))));
    console.log('Fee statuses:', Array.from(new Set(fees.map(f => f.status))));
  }

  // 4. Payments
  const { data: payments, error: payErr } = await supabase.from('payments').select('*');
  console.log('Payments count:', payments?.length, 'error:', payErr?.message);
  if (payments && payments.length > 0) {
    console.log('Sample payment fields:', Object.keys(payments[0]));
  }

  // 5. Product debts
  const { data: debts, error: dErr } = await supabase.from('product_debts').select('*');
  console.log('Product debts count:', debts?.length, 'error:', dErr?.message);

  // 6. Admin action log
  const { data: logs, error: lErr } = await supabase.from('admin_action_log').select('*');
  console.log('Admin action log count:', logs?.length, 'error:', lErr?.message);
}

inspectData();
