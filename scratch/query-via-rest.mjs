const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function check() {
    const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
    
    let allEmployees = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?companyId=eq.${companyId}&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Prefer': 'count=exact'
            }
        });
        
        // Get total count from Content-Range header
        const contentRange = res.headers.get('content-range');
        console.log(`Fetch offset ${offset}: range header: ${contentRange}`);
        
        const data = await res.json();
        allEmployees = allEmployees.concat(data);
        
        if (data.length < limit) {
            hasMore = false;
        } else {
            offset += limit;
        }
    }

    console.log(`Total employees found in DB: ${allEmployees.length}`);
    
    const statusCounts = {};
    allEmployees.forEach(e => {
        statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    console.log("Status breakdown:", statusCounts);

    const activeEmployees = allEmployees.filter(e => e.status === "ACTIVE");
    console.log(`Active employees count: ${activeEmployees.length}`);
    if (activeEmployees.length > 0) {
        console.log("First 10 active employees:");
        activeEmployees.slice(0, 10).forEach(e => {
            console.log(`- ID: ${e.id}, Name: ${e.name}, DeptID: ${e.departmentId}`);
        });
    }
}

check();
