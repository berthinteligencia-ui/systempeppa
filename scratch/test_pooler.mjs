import pg from 'pg';
const { Client } = pg;

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'sa-east-1'
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.wbfchuvzwnzajjjrzjym:o72jj2QW5l6YZ4dw@${host}:6543/postgres`;
  
  console.log(`Testing region: ${region} (${host})...`);
  const client = new Client({ 
    connectionString, 
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  
  try {
    await client.connect();
    console.log(`[SUCCESS] Connected to Supabase via ${region} pooler!`);
    const res = await client.query("SELECT current_database(), current_user;");
    console.log("QueryResult:", res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.log(`[FAIL] ${region}: ${err.message}`);
    return false;
  }
}

async function main() {
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`\nFound correct region: ${region}`);
      process.exit(0);
    }
  }
  console.log("\nAll regions failed.");
}

main();
