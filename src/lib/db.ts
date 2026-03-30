import { Pool } from "pg"

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
})

pool.on("error", (err) => console.error("[DB] Pool error:", err.message))

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect()
    try {
        const result = await client.query(sql, params)
        return result.rows as T[]
    } catch (err: any) {
        console.error("[DB_QUERY_ERROR]", err.message)
        throw err
    } finally {
        client.release()
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params)
    return rows[0] ?? null
}
