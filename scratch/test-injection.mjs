import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // We inject: SELECT 1 ) t; SELECT 2 as val; --
  // The full string executed will be:
  // SELECT json_agg(t) FROM ( SELECT 1 ) t; SELECT 2 as val; -- ) t
  const injectedQuery = "SELECT 1 ) t; SELECT 2 as val; --";
  
  try {
    console.log("Testing SQL injection in exec_sql...");
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: injectedQuery
    });
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Result:', data);
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  }
}

run();
