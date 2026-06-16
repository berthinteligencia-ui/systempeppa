import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from systempeppa/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

async function run() {
  const cpfs = ["05125676543", "03119223506", "10198845502", "00317597507"];
  const url = `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/Employee?cpf=in.(${cpfs.join(',')})`;
  
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const data = await res.json();

  console.log("--- Detalhes dos Funcionários no Banco ---");
  if (!Array.isArray(data)) {
    console.error("Erro ou resposta inválida:", data);
    return;
  }

  for (const emp of data) {
    console.log(`CPF: ${emp.cpf}`);
    console.log(`Nome no Banco: "${emp.name}"`);
    console.log("Char Codes:", [...emp.name].map(c => c.charCodeAt(0)));
  }
}

run();
