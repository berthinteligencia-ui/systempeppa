const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?name=ilike.*Kauan*`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log("=== ALL KAUAN EMPLOYEES ===");
    data.forEach(e => {
        console.log(`- ID: ${e.id}, Name: ${e.name}, CompanyId: ${e.companyId}, Status: ${e.status}, CPF: ${e.cpf}`);
    });
}

check();
