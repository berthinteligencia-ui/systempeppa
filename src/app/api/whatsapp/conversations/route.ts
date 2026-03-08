import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()

    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const conversations = await query(
            `SELECT
                l.id,
                true AS active,
                l.created_at AS "createdAt",
                COALESCE(m_latest.created_at, l.created_at) AS "updatedAt",
                e."companyId",
                e.id AS "employeeId",
                e.name AS "emp_name",
                e.position AS "emp_position",
                e.phone AS "emp_phone",
                d.name AS "dept_name",
                m_latest.id AS "msg_id",
                m_latest.conteudo AS "msg_content",
                m_latest.created_at AS "msg_createdAt",
                m_latest.tipo AS "msg_tipo"
             FROM leads l
             -- Vincula lead ao funcionário da empresa via telefone
             JOIN "Employee" e ON regexp_replace(COALESCE(e.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(l.celular, ''), '\\D', '', 'g')
             LEFT JOIN "Department" d ON d.id = e."departmentId"
             LEFT JOIN LATERAL (
                 SELECT id, conteudo, created_at, tipo
                 FROM mensagens
                 WHERE lead_id = l.id
                 ORDER BY created_at DESC
                 LIMIT 1
             ) m_latest ON true
             WHERE e."companyId" = $1
             ORDER BY "updatedAt" DESC`,
            [session.user.companyId]
        )

        const result = conversations.map(row => ({
            id: row.id,
            active: row.active,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            companyId: row.companyId,
            employeeId: row.employeeId,
            employee: {
                id: row.employeeId,
                name: row.emp_name,
                position: row.emp_position,
                phone: row.emp_phone,
                department: row.dept_name
            },
            messages: row.msg_id ? [{
                id: row.msg_id,
                content: row.msg_content,
                createdAt: row.msg_createdAt,
                senderType: row.msg_tipo === 'lead' ? 'EMPLOYEE' : 'COMPANY',
            }] : [],
        }))

        return NextResponse.json(result)
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
