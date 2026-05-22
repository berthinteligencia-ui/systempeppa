const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- DB DIAGNOSIS ---');
  
  // Get all companies
  const { data: companies, error: compErr } = await supabase
    .from('Company')
    .select('id, name');
    
  if (compErr) {
    console.error('Error fetching companies:', compErr);
    return;
  }
  
  console.log(`Total Companies: ${companies.length}`);
  
  // Count employees per company
  for (const c of companies) {
    const { count, error: countErr } = await supabase
      .from('Employee')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', c.id);
      
    if (countErr) {
      console.error(`Error counting employees for company ${c.name} (${c.id}):`, countErr);
    } else {
      console.log(`- Company: ${c.name} (ID: ${c.id}) -> ${count} employees`);
    }
  }

  // Count total employees
  const { count: totalEmployees, error: errTotal } = await supabase
    .from('Employee')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal Employees in DB: ${totalEmployees}`);

  // Count employees with null CPFs
  const { count: nullCpfCount, error: errNullCpf } = await supabase
    .from('Employee')
    .select('*', { count: 'exact', head: true })
    .is('cpf', null);
  console.log(`Employees with NULL CPF: ${nullCpfCount}`);
  
  // Check the global uniqueness or duplicates
  const { data: employees, error: errEmp } = await supabase
    .from('Employee')
    .select('cpf, companyId');
    
  if (errEmp) {
    console.error('Error fetching all CPFs:', errEmp);
    return;
  }
  
  const cpfs = employees.map(e => e.cpf).filter(Boolean);
  const uniqueCpfs = new Set(cpfs);
  console.log(`Total non-null CPFs: ${cpfs.length}`);
  console.log(`Unique non-null CPFs: ${uniqueCpfs.size}`);
  
  if (cpfs.length !== uniqueCpfs.size) {
    console.log('WARNING: There are duplicates in non-null CPFs in the database!');
  }
}

check();
