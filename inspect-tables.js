const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('mensagens', 'mensagens_zap')
      ORDER BY table_name;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

run();
