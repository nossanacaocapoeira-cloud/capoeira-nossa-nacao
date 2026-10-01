import { createClient } from '@supabase/supabase-js';

const key = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';
const urls = [
  'https://vukrtgmjehumqdzvyqum.supabase.co',
  'https://qxuzpeqsejcyhvzxoict.supabase.co'
];

async function test() {
  for (const url of urls) {
    console.log(`\nTesting client with URL: ${url}`);
    const client = createClient(url, key);
    
    // Test auth settings
    const authRes = await client.auth.getSession();
    console.log('Auth getSession:', authRes);

    // Test students
    const sRes = await client.from('students').select('*');
    console.log('students select:', sRes.status, sRes.error?.message, 'count:', sRes.data?.length);

    // Test profiles
    const pRes = await client.from('profiles').select('*');
    console.log('profiles select:', pRes.status, pRes.error?.message, 'count:', pRes.data?.length);

    // Test monthly_fees
    const mRes = await client.from('monthly_fees').select('*');
    console.log('monthly_fees select:', mRes.status, mRes.error?.message, 'count:', mRes.data?.length);
  }
}

test();
