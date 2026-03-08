
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:o72jj2QW5l6YZ4dw@db.wbfchuvzwnzajjjrzjym.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('--- TABLE: leads ---');
        const leadsData = await pool.query('SELECT * FROM leads LIMIT 10');
        console.log(JSON.stringify(leadsData.rows, null, 2));

        console.log('\n--- TABLE: Employee ---');
        const employeeData = await pool.query('SELECT id, name, phone, "companyId" FROM "Employee" LIMIT 10');
        console.log(JSON.stringify(employeeData.rows, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

main();
