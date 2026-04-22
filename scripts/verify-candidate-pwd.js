const { Client } = require('pg');

const connectionString = "postgresql://postgres:o72jj2QW5l6YZ4dw@db.wbfchuvzwnzajjjrzjym.supabase.co:5432/postgres";

async function checkSchema() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL with candidate password!");

    const res = await client.query(`
      SELECT table_schema, table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'n8n_chat_histories'
      ORDER BY table_schema, column_name;
    `);

    console.log("Found Columns for n8n_chat_histories:");
    if (res.rows.length === 0) {
      console.log("No table named 'n8n_chat_histories' found.");
    } else {
      console.table(res.rows);
    }

  } catch (err) {
    console.error("Query Error:", err.message);
  } finally {
    await client.end();
  }
}

checkSchema();
