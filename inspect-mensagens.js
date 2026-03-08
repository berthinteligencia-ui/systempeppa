
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mensagens' ORDER BY ordinal_position");
        console.log('Columns in "mensagens" table:');
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));

        const data = await pool.query('SELECT * FROM mensagens ORDER BY created_at DESC LIMIT 5');
        console.log('\nSample data:');
        console.log(JSON.stringify(data.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
