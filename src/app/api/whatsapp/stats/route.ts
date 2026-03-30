export const dynamic = "force-dynamic"
import { auth } from "@/lib/auth"
import { queryOne } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    const companyId = session.user.companyId

    try {
        // Totais a partir de mensagens_zap vinculadas à empresa via leads → Employee
        const stats = await queryOne(
            `SELECT
                COUNT(DISTINCT mz.lead_id)::int  AS "totalLeads",
                COUNT(mz.id)::int                AS "totalMessages",
                COUNT(DISTINCT CASE WHEN mz.lead_id IS NOT NULL THEN mz.lead_id END)::int AS "activeConvs"
             FROM mensagens_zap mz
             LEFT JOIN leads l ON l.id = mz.lead_id
             LEFT JOIN "Employee" e
               ON e."companyId" = $1
               AND regexp_replace(COALESCE(e.phone,''), '\\D','','g')
                = regexp_replace(COALESCE(
                    mz.numero_funcionario,
                    l.celular,
                    ''
                  ), '\\D','','g')
             WHERE e."companyId" = $1 OR (
                 -- inclui mensagens sem funcionário correspondente mas com lead da empresa
                 e.id IS NULL AND mz.lead_id IS NOT NULL
             )`,
            [companyId]
        )

        // Tempo médio de resposta (1ª mensagem do lead → 1ª resposta da empresa)
        const avgRow = await queryOne(
            `SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - first_lead.created_at)) / 60)::int AS avg_minutes
             FROM (
                 SELECT DISTINCT ON (lead_id) lead_id, created_at
                 FROM mensagens_zap
                 WHERE tipo = 'lead'
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
             ) reply ON true
             LEFT JOIN leads l ON l.id = first_lead.lead_id
             LEFT JOIN "Employee" e
               ON e."companyId" = $1
               AND regexp_replace(COALESCE(e.phone,''), '\\D','','g')
                = regexp_replace(COALESCE(l.celular,''), '\\D','','g')
             WHERE e."companyId" = $1 OR e.id IS NULL`,
            [companyId]
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
