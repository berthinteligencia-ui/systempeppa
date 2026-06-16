const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.production explicitly
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

async function main() {
  let directUrl = process.env.DIRECT_URL || "";
  directUrl = directUrl.replace(/\\r|\\n/g, "").trim(); // clean any escape sequence characters

  console.log("Using Connection String:", directUrl.replace(/:[^:@]+@/, ':****@')); // hide password in logs

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query(`
      SELECT routine_definition, data_type 
      FROM information_schema.routines 
      WHERE routine_name = 'exec_sql';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("DB Query Error:", err);
  } finally {
    await client.end();
  }
}

main();
