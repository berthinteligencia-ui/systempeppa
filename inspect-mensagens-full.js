
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT * FROM mensagens LIMIT 1");
        if (res.rows.length > 0) {
            console.log('Keys in "mensagens" row:');
            console.log(Object.keys(res.rows[0]).join(', '));
            console.log('\nFull row:');
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('Table "mensagens" is empty.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
