import pg from 'pg';
const { Client } = pg;

const hosts = ["db.wbfchuvzwnzajjjrzjym.supabase.co"];
const users = ["postgres", "postgres.wbfchuvzwnzajjjrzjym"];
const passwords = ["ykDzrU6ByNbUujeA", "o72jj2QW5l6YZ4dw"];
const ports = [5432, 6543];

async function testCombination(host, port, user, password) {
  const connectionString = `postgresql://${user}:${password}@${host}:${port}/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log(`[SUCCESS] Connection works for: ${user} / ${password} @ ${port}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`[FAIL] Port: ${port}, User: ${user}, Pwd: ${password} -> Error: ${err.message}`);
    return false;
  }
}

async function main() {
  for (const host of hosts) {
    for (const port of ports) {
      for (const user of users) {
        for (const password of passwords) {
          const success = await testCombination(host, port, user, password);
          if (success) {
            console.log("\nFound working credentials!");
            process.exit(0);
          }
        }
      }
    }
  }
  console.log("\nNo combinations worked.");
}

main();
