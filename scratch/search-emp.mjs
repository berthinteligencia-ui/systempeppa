const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.${companyId}&name=ilike.*Kauan*`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log("=== SEARCH KAUAN ===");
    console.log(JSON.stringify(data, null, 2));
}

check();
