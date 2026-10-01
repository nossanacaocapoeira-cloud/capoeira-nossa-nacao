async function inspectSchema() {
  const key = 'sb_publishable_UgTfdxst97cv_RI1fc8PUg_D6Qa0OO1';
  const urls = [
    'https://vukrtgmjehumqdzvyqum.supabase.co',
    'https://qxuzpeqsejcyhvzxoict.supabase.co'
  ];

  for (const url of urls) {
    console.log(`\n=== Checking OpenAPI for ${url} ===`);
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      console.log(`Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const spec = await res.json();
        const tables = Object.keys(spec.definitions || spec.components?.schemas || {});
        console.log(`Tables found (${tables.length}):`, tables);
      } else {
        const txt = await res.text();
        console.log(`Response:`, txt);
      }
    } catch (e: any) {
      console.log(`Error:`, e.message);
    }
  }
}

inspectSchema();
