import { Pool } from "pg"

// Remove pgbouncer/pooler params that native 'pg' doesn't support
function cleanConnectionString(url: string): string {
    if (!url) return url
    try {
        const u = new URL(url)
        u.searchParams.delete("pgbouncer")
        u.searchParams.delete("connection_limit")
        return u.toString()
    } catch {
        // Fallback for simple strings: remove common params manually
        return url.replace(/pgbouncer=true&?/, '').replace(/connection_limit=\d+&?/, '').replace(/\?$/, '');
    }
}

// Em produção (Vercel), recomendamos usar o Transaction Mode Pooler (6543)
// se a conexão direta (5432) falhar com ENOTFOUND.
const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ""
const connectionString = cleanConnectionString(rawUrl)

if (!connectionString) {
    console.error("[DB] CRITICAL: No database connection URL found in environment variables.")
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
})

pool.on("error", (err) => {
    console.error("[DB] GLOBAL POOL ERROR:", err.message)
    if (err.message.includes("ENOTFOUND")) {
        console.error("[DB] DNS Lookup failed. Host might be incorrect or unreachable on Vercel.")
    }
})

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    let client
    try {
        client = await pool.connect()
        const result = await client.query(sql, params)
        return result.rows as T[]
    } catch (error: any) {
        console.error("[DB_QUERY_ERROR]", error.message)
        if (error.message.includes("ENOTFOUND")) {
            const host = connectionString.match(/@([^:/]+)/)?.[1]
            console.error(`[DB] Could not resolve host: ${host}. Try using the Pooler URL (port 6543) in Vercel.`)
        }
        throw error
    } finally {
        if (client) client.release()
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params)
    return rows[0] ?? null
}
