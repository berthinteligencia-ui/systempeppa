const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function main() {
  const sql = `SELECT 1) t;
    SELECT json_agg(r)::text FROM (
      SELECT routine_name, routine_definition, data_type 
      FROM information_schema.routines 
      WHERE routine_name = 'exec_sql'
    ) r; --`;
  
  console.log("Calling RPC exec_sql with query:", sql);
  const { data, error } = await supabaseAdmin.rpc("exec_sql", {
      query_text: sql,
      query_params: []
  });
  
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Success:", JSON.stringify(data, null, 2));
  }
}

main();
