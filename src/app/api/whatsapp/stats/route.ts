import { auth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    const companyId = session.user.companyId

    try {
        const stats = await queryOne(
            `SELECT
                COUNT(DISTINCT l.id)::int AS "totalLeads",
                COUNT(m.id)::int          AS "totalMessages",
                COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN l.id END)::int AS "activeConvs"
             FROM leads l
             JOIN "Employee" e ON regexp_replace(COALESCE(e.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(l.celular, ''), '\\D', '', 'g')
             LEFT JOIN mensagens m ON m.lead_id = l.id
             WHERE e."companyId" = $1`,
            [companyId]
        )

        // Tempo médio de resposta (simplificado para mensagens da tabela mensagens)
        const avgRow = await queryOne(
            `SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - first_lead.created_at)) / 60)::int AS avg_minutes
             FROM (
                 SELECT DISTINCT ON (lead_id) lead_id, created_at
                 FROM mensagens
                 WHERE tipo = 'lead'
                 ORDER BY lead_id, created_at ASC
             ) first_lead
             JOIN LATERAL (
                 SELECT created_at
                 FROM mensagens
                 WHERE lead_id = first_lead.lead_id
                   AND tipo = 'user'
                   AND created_at > first_lead.created_at
                 ORDER BY created_at ASC
                 LIMIT 1
             ) reply ON true
             JOIN leads l ON l.id = first_lead.lead_id
             JOIN "Employee" e ON regexp_replace(COALESCE(e.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(l.celular, ''), '\\D', '', 'g')
             WHERE e."companyId" = $1`,
            [companyId]
        )

        return NextResponse.json({
            totalLeads: stats?.totalLeads ?? 0,
            totalMessages: stats?.totalMessages ?? 0,
            avgResponseMinutes: avgRow?.avg_minutes ?? 0,
            activeConvs: stats?.activeConvs ?? 0,
        })
    } catch (err: any) {
        console.error("[STATS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
