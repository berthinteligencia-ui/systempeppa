import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'"
    });
    
    if (error) {
      console.error('Error querying routines:', error);
    } else {
      console.log('Available functions:');
      console.table(data);
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  }
}

run();
