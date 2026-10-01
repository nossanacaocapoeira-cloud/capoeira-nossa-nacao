import { createClient } from '@supabase/supabase-js';

const url = 'https://vukrtgmjehumqdzvyqum.supabase.co';
const key = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';
const supabase = createClient(url, key);

async function testAuth() {
  const email = 'nossanacaocapoeira@gmail.com';
  // Test signIn with common passwords or check error message
  const res = await supabase.auth.signInWithPassword({
    email,
    password: 'password123'
  });
  console.log('SignIn result:', res.error?.message, res.error?.status);
}

testAuth();
