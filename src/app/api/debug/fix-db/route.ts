import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const { error } = await supabaseAdmin.from("n8n_chat_histories").select("created_at").limit(1)
        
        if (error && error.message.includes("column n8n_chat_histories.created_at does not exist")) {
            console.log("Adding column created_at...")
            // We use the rpc "exec_sql" if available, or try to find another way.
            // Since standard Supabase JS client doesn't support DDL directly without RPC,
            // we have to hope exec_sql works or the user has another helper.
            
            const { error: sqlError } = await supabaseAdmin.rpc("exec_sql", {
                query_text: "ALTER TABLE n8n_chat_histories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"
            })
            
            if (sqlError) throw sqlError
            return NextResponse.json({ message: "Coluna adicionada com sucesso via RPC!" })
        }
        
        return NextResponse.json({ message: "A coluna já existe ou outro erro ocorreu.", error })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
