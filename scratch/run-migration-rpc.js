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
  const sql = `SELECT 1 ) t;
ALTER TABLE "PayrollAnalysis"
  ADD COLUMN "totalEmployees" INTEGER,
  ADD COLUMN "observations"   TEXT,
  ADD COLUMN "closedAt"       TIMESTAMP(3),
  ADD COLUMN "closedByUserId" TEXT;

UPDATE "PayrollAnalysis" SET "status" = 'ABERTO' WHERE "status" = 'OPEN';

ALTER TABLE "PayrollAnalysis"
  ADD CONSTRAINT "PayrollAnalysis_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

NOTIFY pgrst, 'reload schema';

SELECT 1 AS status; --`;
  
  console.log("Calling RPC exec_sql to run DDL migration and reload schema cache...");
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
