import dotenv from 'dotenv';
dotenv.config();

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;

async function check() {
    console.log("URL:", NEXT_PUBLIC_SUPABASE_URL);
    console.log("Anon Key:", NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error("Missing environment variables!");
        return;
    }
    
    const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Company?select=id,name&limit=1`;
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': NEXT_PUBLIC_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            }
        });
        if (!res.ok) {
            console.error(`Error response: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error("Body:", text);
            return;
        }
        const data = await res.json();
        console.log("Success! Data received:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch failed:", err.message);
    }
}

check();
