import { Client } from 'pg'

// Supabase transaction pooler SA region (IPv4)
const client = new Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.wbfchuvzwnzajjjrzjym',
  password: 'ykDzrU6ByNbUujeA',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

const sql = `
ALTER TABLE "PayrollAnalysis"
  ADD COLUMN IF NOT EXISTS "totalEmployees" INTEGER,
  ADD COLUMN IF NOT EXISTS "observations"   TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;

UPDATE "PayrollAnalysis" SET "status" = 'ABERTO' WHERE "status" = 'OPEN';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PayrollAnalysis_closedByUserId_fkey'
  ) THEN
    ALTER TABLE "PayrollAnalysis"
      ADD CONSTRAINT "PayrollAnalysis_closedByUserId_fkey"
      FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`

try {
  await client.connect()
  console.log('✓ Conectado ao banco Supabase')

  await client.query(sql)
  console.log('✓ Migration aplicada com sucesso!')

  const { rows } = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'PayrollAnalysis'
    ORDER BY ordinal_position
  `)

  console.log('\nColunas em PayrollAnalysis:')
  rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`))

  await client.end()
  process.exit(0)
} catch (err) {
  console.error('Erro:', err.message)
  process.exit(1)
}
