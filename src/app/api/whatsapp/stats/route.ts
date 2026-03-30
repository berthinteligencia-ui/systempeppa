export const dynamic = "force-dynamic"
export const revalidate = 0
import { auth } from "@/lib/auth"
import { queryOne } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const stats = await queryOne(
            `SELECT
                COUNT(DISTINCT COALESCE(lead_id::text, id::text))::int AS "totalLeads",
                COUNT(id)::int                                          AS "totalMessages",
                COUNT(DISTINCT lead_id)::int                           AS "activeConvs"
             FROM mensagens_zap`
        )

        const avgRow = await queryOne(
            `SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - first_lead.created_at)) / 60)::int AS avg_minutes
             FROM (
                 SELECT DISTINCT ON (lead_id) lead_id, created_at
                 FROM mensagens_zap
                 WHERE tipo = 'lead' AND lead_id IS NOT NULL
                 ORDER BY lead_id, created_at ASC
             ) first_lead
             JOIN LATERAL (
                 SELECT created_at
                 FROM mensagens_zap
                 WHERE lead_id = first_lead.lead_id
                   AND tipo = 'user'
                   AND created_at > first_lead.created_at
                 ORDER BY created_at ASC
                 LIMIT 1
             ) reply ON true`
        )

        return NextResponse.json({
            totalLeads: stats?.totalLeads ?? 0,
            totalMessages: stats?.totalMessages ?? 0,
            avgResponseMinutes: avgRow?.avg_minutes ?? 0,
            activeConvs: stats?.activeConvs ?? 0,
        }, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[STATS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
