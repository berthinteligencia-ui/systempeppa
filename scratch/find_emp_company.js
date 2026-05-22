const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function find() {
  console.log('--- FINDING COMPANY ---');
  
  const { data, error } = await supabase
    .from('Employee')
    .select('id, name, companyId, Company(id, name)')
    .ilike('name', '%Adenilson Santos Xavier%')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

find();
