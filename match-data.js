
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const msg = await pool.query('SELECT lead_id, conteudo FROM mensagens ORDER BY created_at DESC LIMIT 1');
        if (msg.rows.length === 0) {
            console.log('No messages found in "mensagens"');
            return;
        }

        const leadId = msg.rows[0].lead_id;
        console.log(`Checking lead_id: ${leadId} (Message: "${msg.rows[0].conteudo}")`);

        const employee = await pool.query('SELECT id, name FROM "Employee" WHERE id = $1', [leadId]);
        if (employee.rows.length > 0) {
            console.log(`Match found! Employee name: ${employee.rows[0].name}`);
        } else {
            console.log('No matching employee found for this lead_id.');

            // Try searching by phone
            const msgWithPhone = await pool.query('SELECT lead_id, conteudo, created_at FROM mensagens WHERE lead_id IS NOT NULL ORDER BY created_at DESC LIMIT 5');
            console.log('Recent messages with lead_id:');
            console.log(JSON.stringify(msgWithPhone.rows, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
