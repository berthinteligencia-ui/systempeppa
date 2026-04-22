const { Client } = require('pg');
require('dotenv').config();

// Use DIRECT_URL for direct DDL if available, otherwise DATABASE_URL
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function checkSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    const res = await client.query(`
      SELECT table_schema, table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'n8n_chat_histories'
      ORDER BY table_schema, column_name;
    `);

    console.log("Found Columns for n8n_chat_histories:");
    if (res.rows.length === 0) {
      console.log("No table named 'n8n_chat_histories' found in any schema.");
    } else {
      console.table(res.rows);
    }

    // Also check if any table exists with a similar name
    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name ILIKE '%chat%'
    `);
    console.log("Tables with 'chat' in name:");
    console.table(tablesRes.rows);

  } catch (err) {
    console.error("Query Error:", err.message);
  } finally {
    await client.end();
  }
}

checkSchema();
