import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

async function main() {
  const sql = `SELECT 1) t; DROP INDEX IF EXISTS "PayrollAnalysis_month_year_departmentId_companyId_key"; SELECT 1 as status; --`;
  const { data, error } = await supabaseAdmin.rpc("exec_sql", {
      query_text: sql,
      query_params: []
  })
  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Success:", JSON.stringify(data, null, 2));
  }
}

main();
