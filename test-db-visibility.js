const { Pool } = require('pg');
require('dotenv').config();

function cleanConnectionString(url) {
    try {
        const u = new URL(url);
        u.searchParams.delete("pgbouncer");
        u.searchParams.delete("connection_limit");
        return u.toString();
    } catch {
        return url;
    }
}

const pool = new Pool({
    connectionString: cleanConnectionString(process.env.DATABASE_URL),
    ssl: { rejectUnauthorized: false },
});

async function test() {
    try {
        const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables in public schema:", rows.map(r => r.table_name).join(", "));
        
        try {
            const { rows: permRows } = await pool.query("SELECT * FROM role_permissions");
            console.log("role_permissions accessible!");
        } catch (e) {
            console.error("role_permissions NOT accessible:", e.message);
        }
    } catch (e) {
        console.error("Pool query failed:", e.message);
    } finally {
        await pool.end();
    }
}

test();
