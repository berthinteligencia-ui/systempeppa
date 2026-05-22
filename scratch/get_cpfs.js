const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCpfs() {
  console.log('--- DB CPFS INSPECTION ---');
  
  // We can fetch up to 3000 employees by paginating or fetching in chunks
  const allEmployees = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('Employee')
      .select('id, name, cpf, companyId')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error('Error fetching employees:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    allEmployees.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  
  console.log(`Total employees fetched: ${allEmployees.length}`);
  
  const nullCpfs = allEmployees.filter(e => !e.cpf);
  console.log(`Employees with NULL CPF: ${nullCpfs.length}`);
  
  const nonNullCpfs = allEmployees.filter(e => e.cpf);
  console.log(`Employees with non-null CPF: ${nonNullCpfs.length}`);
  
  // Check format of CPFs
  const shortCpfs = nonNullCpfs.filter(e => e.cpf.length < 11);
  const leadingZeroCpfs = nonNullCpfs.filter(e => e.cpf.startsWith('000000'));
  
  console.log(`CPFs shorter than 11 chars: ${shortCpfs.length}`);
  console.log(`CPFs starting with 6+ zeros (like 000000xxxxx): ${leadingZeroCpfs.length}`);
  if (leadingZeroCpfs.length > 0) {
    console.log('Sample leading zero CPFs:');
    leadingZeroCpfs.slice(0, 15).forEach(e => {
      console.log(`- ID: ${e.id} | Name: ${e.name} | CPF: ${e.cpf} | CompanyID: ${e.companyId}`);
    });
  }

  // Count duplicate CPFs globally
  const cpfToEmp = new Map();
  const duplicates = [];
  for (const emp of nonNullCpfs) {
    if (cpfToEmp.has(emp.cpf)) {
      duplicates.push({ cpf: emp.cpf, emp1: cpfToEmp.get(emp.cpf), emp2: emp });
    } else {
      cpfToEmp.set(emp.cpf, emp);
    }
  }
  
  console.log(`Duplicate CPFs found: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('Sample duplicates:');
    duplicates.slice(0, 10).forEach(d => {
      console.log(`CPF: ${d.cpf}`);
      console.log(`  1: ${d.emp1.name} (Company: ${d.emp1.companyId})`);
      console.log(`  2: ${d.emp2.name} (Company: ${d.emp2.companyId})`);
    });
  }
}

inspectCpfs();
