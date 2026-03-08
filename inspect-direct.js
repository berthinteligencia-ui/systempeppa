
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:o72jj2QW5l6YZ4dw@db.wbfchuvzwnzajjjrzjym.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('Connecting to database...');
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mensagens' ORDER BY ordinal_position");
        console.log('COLUMNS_START');
        res.rows.forEach(r => console.log(`${r.column_name}:${r.data_type}`));
        console.log('COLUMNS_END');

        const data = await pool.query('SELECT * FROM mensagens ORDER BY created_at DESC LIMIT 5');
        console.log('DATA_START');
        console.log(JSON.stringify(data.rows, null, 2));
        console.log('DATA_END');

        const count = await pool.query('SELECT COUNT(*) FROM mensagens');
        console.log(`Total messages: ${count.rows[0].count}`);

    } catch (err) {
        console.error('Error during DB inspection:', err);
    } finally {
        await pool.end();
    }
}

main();
