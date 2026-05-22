const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function fetchFullList(buildUrl) {
    const allData = [];
    let from = 0;
    const chunkSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const url = buildUrl(from, from + chunkSize - 1);
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const data = await res.json();
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData.push(...data);
            if (data.length < chunkSize) {
                hasMore = false;
            } else {
                from += chunkSize;
            }
        }
    }
    return allData;
}

async function check() {
    // 1. Get the departments
    const deptUrl = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Department?select=*`;
    const deptRes = await fetch(deptUrl, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const depts = await deptRes.json();
    console.log('--- DEPARTMENTS ---');
    console.log(depts.map(d => ({ id: d.id, name: d.name })));

    const planalto = depts.find(d => d.name.toLowerCase().includes('planalto'));
    if (!planalto) {
        console.log('Planalto department not found!');
        return;
    }
    console.log(`\nSelected Department: ${planalto.name} (ID: ${planalto.id})`);

    // 2. Count using standard HEAD count=exact
    const headRes = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?departmentId=eq.${planalto.id}&status=eq.ACTIVE&select=id`, {
        method: 'HEAD',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'count=exact'
        }
    });
    const countHeader = headRes.headers.get('content-range');
    console.log(`\nExact Count Header (HEAD): ${countHeader}`);

    // 3. Fetch all active employees using paginated helper
    console.log('\nFetching all active employees in Planalto using paginated logic...');
    const employees = await fetchFullList((from, to) => {
        return `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?departmentId=eq.${planalto.id}&status=eq.ACTIVE&select=id,name,status&order=name.asc&offset=${from}&limit=1000`;
    });

    console.log(`Total retrieved active employees in Planalto: ${employees.length}`);
    if (employees.length > 0) {
        console.log(`First employee: ${employees[0].name}`);
        console.log(`Last employee: ${employees[employees.length - 1].name}`);
    }
}

check().catch(console.error);
