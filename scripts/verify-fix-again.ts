import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function verify() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const directUrl = process.env.DIRECT_URL;

  console.log("Supabase URL:", supabaseUrl);
  console.log("Direct URL Host:", directUrl?.split('@')[1]);

  // Method 1: Direct PG
  try {
    const pgClient = new Client({ connectionString: directUrl });
    await pgClient.connect();
    const res = await pgClient.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'n8n_chat_histories' AND column_name = 'created_at'");
    console.log("Direct PG Result:", res.rows);
    await pgClient.end();
  } catch (err: any) {
    console.error("Direct PG Error:", err.message);
  }

  // Method 2: Supabase RPC (if exists)
  try {
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'n8n_chat_histories' AND column_name = 'created_at'"
    });
    if (error) console.error("Supabase RPC Error:", error);
    else console.log("Supabase RPC Result:", data);
  } catch (err: any) {
    console.error("Supabase RPC Catch:", err.message);
  }
}

verify();
