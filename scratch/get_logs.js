const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
  console.log('--- RECENT ACTIVITY LOGS ---');
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  for (const log of logs) {
    // Stringify BigInt id if present
    const id = log.id ? log.id.toString() : '';
    console.log(`[${log.created_at}] Action: ${log.action} | User: ${log.userName} (${log.userEmail}) | Company ID: ${log.companyId}`);
    if (log.details) {
      console.log(`  Details: ${JSON.stringify(log.details)}`);
    }
  }
}

checkLogs();
