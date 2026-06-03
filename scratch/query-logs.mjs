const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/activity_logs?company_id=eq.${companyId}&created_at=gte.2026-05-25T00:00:00%2B00:00&created_at=lte.2026-05-25T23:59:59%2B00:00&select=*&order=created_at.desc`;
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
