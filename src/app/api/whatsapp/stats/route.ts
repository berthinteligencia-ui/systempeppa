export const dynamic = "force-dynamic"
export const revalidate = 0

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { count: totalMessages } = await supabaseAdmin
            .from("mensagens_zap")
            .select("*", { count: "exact", head: true })

        const { data: leadIds } = await supabaseAdmin
            .from("mensagens_zap")
            .select("lead_id")
            .not("lead_id", "is", null)

        const uniqueLeads = new Set((leadIds ?? []).map(r => r.lead_id)).size

        return NextResponse.json({
            totalLeads: uniqueLeads,
            totalMessages: totalMessages ?? 0,
            avgResponseMinutes: 0,
            activeConvs: uniqueLeads,
        }, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[STATS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
