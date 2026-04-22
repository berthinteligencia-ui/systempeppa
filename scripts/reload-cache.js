const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    console.log("Checking all schemas for n8n_chat_histories...");
    const { data: schemas, error: schemaErr } = await supabase.rpc('exec_sql', {
      query_text: "SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'n8n_chat_histories' AND column_name = 'created_at'"
    });
    
    if (schemaErr) console.error("Error checking schemas:", schemaErr);
    else console.log("Schemas/Columns found:", JSON.stringify(schemas, null, 2));

    console.log("Attempting to reload PostgREST schema cache...");
    // This requires specific permissions, but worth a try
    const { error: reloadErr } = await supabase.rpc('exec_sql', {
      query_text: "NOTIFY pgrst, 'reload schema';"
    });
    
    if (reloadErr) console.error("Error reloading cache:", reloadErr);
    else console.log("Cache reload signal sent.");

  } catch (err) {
    console.error("Catch Error:", err.message);
  }
}

run();
