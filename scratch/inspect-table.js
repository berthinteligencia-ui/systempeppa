const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  let directUrl = process.env.DIRECT_URL || "";
  directUrl = directUrl.replace(/\\r|\\n/g, "").trim();

  console.log("Using Connection String:", directUrl.replace(/:[^:@]+@/, ':****@'));

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'PayrollAnalysis';
    `);
    console.log("Columns of PayrollAnalysis:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("DB Query Error:", err);
  } finally {
    await client.end();
  }
}

main();
