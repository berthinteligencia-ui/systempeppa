import { Pool } from "pg"

// Remove parâmetros do PgBouncer que o pg não entende
function cleanConnectionString(url: string): string {
    try {
        const u = new URL(url)
        u.searchParams.delete("pgbouncer")
        u.searchParams.delete("connection_limit")
        return u.toString()
    } catch {
        return url
    }
}

// DIRECT_URL usa porta 5432 (conexão direta) — necessário para pg Pool no Vercel
// DATABASE_URL usa porta 6543 (Supavisor/PgBouncer) — apenas para Prisma
const connectionString = cleanConnectionString(
    process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ""
)

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
})

pool.on("error", (err) => console.error("[DB] Pool error:", err.message))

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect()
    try {
        const result = await client.query(sql, params)
        return result.rows as T[]
    } finally {
        client.release()
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params)
    return rows[0] ?? null
}
