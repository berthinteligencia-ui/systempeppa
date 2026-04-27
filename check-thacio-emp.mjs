const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.e06722a2-e731-42b8-bf3e-2b1cf6d10fba&limit=5`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

check();
