const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- NON-PAGE_VIEW LOGS ---');
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    .not('action', 'eq', 'PAGE_VIEW')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }
  
  console.log(`Found ${logs.length} logs.`);
  for (const log of logs) {
    console.log(`[${log.created_at}] Action: ${log.action} | User: ${log.userName} (${log.userEmail}) | Company ID: ${log.companyId} | Target: ${log.target}`);
    if (log.details) {
      console.log(`  Details: ${JSON.stringify(log.details)}`);
    }
  }
}

check();
