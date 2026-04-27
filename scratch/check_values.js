
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkValues() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('Employee')
    .select('id, name, pagamento')
    .limit(10);
    
  if (error) {
    console.error('Error fetching employees:', error);
    return;
  }
  
  console.log('Current pagamento values:');
  data.forEach(emp => {
    console.log(`- ${emp.name}: "${emp.pagamento}"`);
  });
}

checkValues();
