const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    CREATE OR REPLACE FUNCTION public.temp_fix_chat_histories() 
    RETURNS text AS $$ 
    BEGIN 
      ALTER TABLE n8n_chat_histories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(); 
      RETURN 'OK'; 
    END; 
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  try {
    console.log("Applying DDL workaround via RPC...");
    const { data: r1, error: e1 } = await supabase.rpc('exec_sql', { query_text: sql });
    
    if (e1) {
      console.error("Error creating function:", e1.message);
      return;
    }
    console.log("Function created successfully.");

    process.stdout.write("Calling function... ");
    const { data: r2, error: e2 } = await supabase.rpc('temp_fix_chat_histories');
    
    if (e2) {
      console.error("\nError calling function:", e2.message);
    } else {
      console.log("\nSuccess! Result:", r2);
    }

    // Cleanup
    await supabase.rpc('exec_sql', { query_text: "DROP FUNCTION public.temp_fix_chat_histories()" });

  } catch (err) {
    console.error("General Error:", err.message);
  }
}

run();
