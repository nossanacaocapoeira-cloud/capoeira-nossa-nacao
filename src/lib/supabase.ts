import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuração oficial definitiva — Capoeira Nossa Nação
export const supabaseUrl = 'https://vukrtgmjehumqdzvyqum.supabase.co';
export const supabasePublishableKey = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';

export const isSupabaseConfigured = true;

// Diagnóstico de conexão direta conforme solicitado
export async function testSupabaseConnection() {
  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/settings`,
      {
        headers: {
          apikey: supabasePublishableKey,
        },
      }
    );

    console.log('Supabase connection test status:', response.status);
    const body = await response.text();
    console.log('Supabase connection test success:', response.ok);

    if (!response.ok) {
      console.error('Supabase connection test failed:', body);
    }
    return response.ok;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
}

// Execução imediata do teste diagnóstico
if (typeof window !== 'undefined') {
  testSupabaseConnection();
}

// Cliente único oficial do Supabase
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function getSupabaseConfig(): { url: string; key: string } {
  return {
    url: supabaseUrl,
    key: supabasePublishableKey,
  };
}

