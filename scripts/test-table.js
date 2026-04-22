const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    console.log("Testing access to n8n_chat_histories...");
    const { data, error } = await supabase.from('n8n_chat_histories').select('*').limit(1);
    
    if (error) {
      console.error("Error fetching table:", error.message);
    } else {
      console.log("Success! Row count (max 1):", data.length);
      if (data.length > 0) {
        console.log("Sample row keys:", Object.keys(data[0]));
      }
    }
  } catch (err) {
    console.error("Catch Error:", err.message);
  }
}

run();
