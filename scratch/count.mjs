const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = '875d4202-fe27-48c5-a9ff-2be84890b7c9';
    const planaltoId = '25379475-7772-4b98-942e-0d0f63f5e8a0';

    // Query like page.tsx
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.${companyId}&select=*,department:Department(*)&order=name.asc`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const emps = await res.json();
    console.log('Query returned total employees:', emps.length);

    // Count how many are ACTIVE and in PLANALTO in this returned list
    const filtered = emps.filter(e => e.status === 'ACTIVE' && e.departmentId === planaltoId);
    console.log('ACTIVE in PLANALTO in returned list:', filtered.length);
}

check();
