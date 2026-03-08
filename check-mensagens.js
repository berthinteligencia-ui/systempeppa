
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('Tables in public schema:');
        res.rows.forEach(r => console.log(`- ${r.table_name}`));

        // Also check if 'mensagens' table exists and has data
        const mensagensTable = res.rows.find(r => r.table_name === 'mensagens');
        if (mensagensTable) {
            console.log('\nFound "mensagens" table! Checking for data...');
            const data = await pool.query('SELECT * FROM mensagens LIMIT 5');
            console.log(JSON.stringify(data.rows, null, 2));
        } else {
            console.log('\nNo "mensagens" table found.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
