
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkTriggers() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase.rpc('get_triggers', { table_name: 'Employee' });
  
  if (error) {
    // If RPC doesn't exist, try raw SQL via a known method or just assume no triggers for now
    // But wait, I can't run raw SQL via the client easily without a specialized function.
    // I'll try to just check if there are any suspicious functions in the DB.
    console.log('Error calling get_triggers (probably doesn\'t exist):', error.message);
    
    // Alternative: check if there's an 'update_pagamento' function
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname')
      .ilike('proname', '%pagamento%');
      
    if (funcError) {
       console.log('Error checking functions:', funcError.message);
    } else {
       console.log('Functions found:', functions);
    }
    return;
  }
  
  console.log('Triggers found:', data);
}

checkTriggers();
