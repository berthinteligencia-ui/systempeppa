import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const query = `SELECT 1 ) t; 
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "birthDate" timestamp without time zone; 
    ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "motherName" text; 
    SELECT 1 AS status; 
    --`;
  
  try {
    console.log("Applying Employee table column updates via injected RPC...");
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: query
    });
    
    if (error) {
      console.error('Error applying migration:', error);
      return;
    }
    console.log('Migration statement executed successfully. Result:', data);
    
    // Verify
    console.log("\nVerifying columns of Employee table:");
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
      query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Employee'"
    });
    if (colErr) {
      console.error('Error querying columns:', colErr);
    } else {
      console.table(cols);
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  }
}

run();
