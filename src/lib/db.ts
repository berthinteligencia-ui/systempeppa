import { createClient } from "@supabase/supabase-js"

// Cliente admin com service role key — bypassa RLS, usa HTTP (funciona no Vercel)
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

// Compatibilidade com código legado que usa query() e queryOne()
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const { data, error } = await supabaseAdmin.rpc("exec_sql", {
        query_text: sql,
        query_params: params ?? [],
    })
    if (error) throw new Error(error.message)
    return (data as T[]) ?? []
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params)
    return rows[0] ?? null
}
