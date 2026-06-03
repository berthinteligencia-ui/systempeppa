const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    // Fetch all companies
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Company?select=id,name`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const companies = await res.json();
    console.log(`Found ${companies.length} companies:`);
    
    for (const company of companies) {
        // Fetch count of active/inactive employees
        const empUrl = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.${company.id}&select=status`;
        const empRes = await fetch(empUrl, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const emps = await empRes.json();
        const counts = {};
        emps.forEach(e => {
            counts[e.status] = (counts[e.status] || 0) + 1;
        });
        console.log(`- Company: ${company.name} (ID: ${company.id})`);
        console.log(`  Employees: ${emps.length}, Status breakdown:`, counts);
    }
}

check();
