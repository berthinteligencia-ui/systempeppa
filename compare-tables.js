
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:o72jj2QW5l6YZ4dw@db.wbfchuvzwnzajjjrzjym.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('--- TABLE: Message ---');
        const messageData = await pool.query('SELECT * FROM "Message" ORDER BY "createdAt" DESC LIMIT 5');
        console.log(JSON.stringify(messageData.rows, null, 2));

        console.log('\n--- TABLE: mensagens ---');
        const mensagensData = await pool.query('SELECT * FROM mensagens ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(mensagensData.rows, null, 2));

        const countMessage = await pool.query('SELECT COUNT(*) FROM "Message"');
        const countMensagens = await pool.query('SELECT COUNT(*) FROM mensagens');
        console.log(`\nTotals -> Message: ${countMessage.rows[0].count}, mensagens: ${countMensagens.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
