const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.${companyId}`;
    
    console.log("Reactivating all employees of company 875d4202-fe27-48c5-a9ff-2be84890b7c9...");
    
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            status: "ACTIVE",
            updatedAt: new Date().toISOString()
        })
    });
    
    if (res.ok) {
        const data = await res.json();
        console.log(`Successfully reactivated ${data.length} employees!`);
    } else {
        const err = await res.json();
        console.error("Failed to reactivate employees:", err);
    }
}

check();
