import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function run() {
  try {
    console.log('Testando RPC exec_sql com SELECT...');
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: 'SELECT current_database(), current_user;'
    });
    
    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Result:', data);
    }
    
    console.log('Listando colunas de n8n_chat_histories...');
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
      query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'n8n_chat_histories';"
    });
    
    if (colErr) {
      console.error('Col Error:', colErr);
    } else {
      console.log('Columns:', cols);
    }

  } catch (err: any) {
    console.error('Fatal Erro:', err.message);
  }
}

run();
