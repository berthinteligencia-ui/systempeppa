
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mensagens' ORDER BY ordinal_position");
        console.log('COLUMNS_START');
        res.rows.forEach(r => console.log(`${r.column_name}:${r.data_type}`));
        console.log('COLUMNS_END');

        const data = await pool.query('SELECT * FROM mensagens ORDER BY created_at DESC LIMIT 1');
        console.log('DATA_START');
        console.log(JSON.stringify(data.rows[0], null, 2));
        console.log('DATA_END');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
