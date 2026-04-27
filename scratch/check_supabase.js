const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`Checking connection to: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check Employee count
    const { count, error, status } = await supabase.from('Employee').select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error querying Employee table:', error.message);
    } else {
      console.log(`Employee Table: OK (Status ${status})`);
      console.log(`Total Employees: ${count}`);
    }

    // List some tables to be sure
    const { data: tables, error: tableError } = await supabase.rpc('get_tables'); // This might not exist, let's try a simple query
    
    const { data: companies, error: compError } = await supabase.from('Company').select('id, name').limit(5);
    if (compError) {
      console.error('Error querying Company table:', compError.message);
    } else {
      console.log('Company Table: OK');
      console.log('Companies:', companies.map(c => c.name).join(', '));
    }

  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

checkConnection();
