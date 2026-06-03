const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
    
    // Fetch Settings
    const settingsUrl = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Settings?companyId=eq.${companyId}`;
    const settingsRes = await fetch(settingsUrl, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const settingsData = await settingsRes.json();
    console.log("=== SETTINGS ===");
    console.log(JSON.stringify(settingsData, null, 2));
}

check();
