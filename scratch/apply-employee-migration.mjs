import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const createFuncSql = `
    CREATE OR REPLACE FUNCTION public.temp_add_employee_columns() 
    RETURNS text AS $$ 
    BEGIN 
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "birthDate" timestamp without time zone; 
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "motherName" text; 
      RETURN 'OK'; 
    END; 
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  try {
    console.log("Creating temporary migration function...");
    const { data: createRes, error: createErr } = await supabase.rpc('exec_sql', { query_text: createFuncSql });
    if (createErr) {
      console.error("Error creating migration function:", createErr);
      return;
    }
    console.log("Migration function created successfully.");

    console.log("Running migration function...");
    const { data: runRes, error: runErr } = await supabase.rpc('temp_add_employee_columns');
    if (runErr) {
      console.error("Error running migration:", runErr);
    } else {
      console.log("Migration result:", runRes);
    }

    console.log("Cleaning up temporary migration function...");
    const { data: dropRes, error: dropErr } = await supabase.rpc('exec_sql', { query_text: "DROP FUNCTION public.temp_add_employee_columns()" });
    if (dropErr) {
      console.error("Error dropping migration function:", dropErr);
    } else {
      console.log("Cleaned up successfully.");
    }

    // Verify columns
    console.log("\nVerifying updated columns for Employee table:");
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
      query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Employee'"
    });
    if (colErr) {
      console.error('Error querying columns:', colErr);
    } else {
      console.table(cols);
    }

  } catch (err) {
    console.error("Fatal:", err.message);
  }
}

run();
