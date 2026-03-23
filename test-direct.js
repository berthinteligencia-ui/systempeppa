const { Pool } = require('pg');
require('dotenv').config();

async function test() {
    const connectionString = process.env.DATABASE_URL;
    console.log("Connection string found:", connectionString ? "YES" : "NO");
    
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Testing connection...");
        const res = await pool.query('SELECT NOW()');
        console.log("Success! Server time:", res.rows[0].now);
        
        console.log("Testing insert into activity_logs...");
        await pool.query(
            `INSERT INTO activity_logs (user_id, user_name, user_email, company_id, action, target, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['test-id', 'Test User', 'test@test.com', 'test-company', 'TEST', 'target', '{}', '127.0.0.1']
        );
        console.log("Insert success!");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

test();
