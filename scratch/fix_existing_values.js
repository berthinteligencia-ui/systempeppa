const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixValues() {
  const { data, error } = await supabase
    .from('Employee')
    .select('id, pagamento');

  if (error) {
    console.error("Error fetching employees:", error);
    return;
  }

  console.log(`Found ${data.length} employees`);

  for (const emp of data) {
    if (emp.pagamento && emp.pagamento !== emp.pagamento.toLowerCase()) {
      const lower = emp.pagamento.toLowerCase();
      console.log(`Updating ${emp.id}: ${emp.pagamento} -> ${lower}`);
      const { error: updateError } = await supabase
        .from('Employee')
        .update({ pagamento: lower })
        .eq('id', emp.id);
      
      if (updateError) {
        console.error(`Error updating ${emp.id}:`, updateError);
      }
    }
  }
  console.log("Done!");
}

fixValues();
