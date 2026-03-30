export const dynamic = "force-dynamic"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const companyId = session.user.companyId

    try {
        // Agrupa por numero_funcionario (ou lead_id como fallback)
        // Pega a mensagem mais recente de cada contato
        const conversations = await query(
            `SELECT DISTINCT ON (grp_key)
                grp_key                     AS id,
                mz.lead_id::text            AS "lead_id",
                mz.conteudo                 AS "msg_content",
                mz.tipo                     AS "msg_tipo",
                mz.created_at               AS "updatedAt",
                mz.numero_funcionario       AS "contact_phone",
                l.nome                      AS "lead_nome",
                l.celular                   AS "lead_celular",
                e.id                        AS "employeeId",
                e.name                      AS "emp_name",
                e.position                  AS "emp_position",
                e.phone                     AS "emp_phone",
                e.email                     AS "emp_email",
                e.cpf                       AS "emp_cpf",
                e.salary                    AS "emp_salary",
                e.pagamento                 AS "emp_pagamento",
                e."hireDate"               AS "emp_hireDate",
                e."bankName"               AS "emp_bankName",
                e."bankAgency"             AS "emp_bankAgency",
                e."bankAccount"            AS "emp_bankAccount",
                d.name                      AS "dept_name"
             FROM (
                SELECT *,
                  COALESCE(
                    numero_funcionario,
                    lead_id::text,
                    id::text
                  ) AS grp_key
                FROM mensagens_zap
             ) mz
             LEFT JOIN leads l ON l.id = mz.lead_id
             LEFT JOIN "Employee" e
               ON e."companyId" = $1
               AND regexp_replace(COALESCE(e.phone,''), '\\D','','g')
                = regexp_replace(COALESCE(mz.numero_funcionario, l.celular, ''), '\\D','','g')
             LEFT JOIN "Department" d ON d.id = e."departmentId"
             ORDER BY grp_key, mz.created_at DESC`,
            [companyId]
        )

        const result = conversations.map(row => ({
            id: row.id,
            active: true,
            updatedAt: row.updatedAt,
            companyId: companyId,
            employeeId: row.employeeId ?? null,
            isEmployee: !!row.employeeId,
            employee: {
                id: row.employeeId,
                name: row.emp_name ?? row.lead_nome ?? row.contact_phone ?? "—",
                position: row.emp_position ?? null,
                phone: row.emp_phone ?? row.lead_celular ?? row.contact_phone,
                email: row.emp_email ?? null,
                cpf: row.emp_cpf ?? null,
                salary: row.emp_salary ? Number(row.emp_salary) : null,
                pagamento: row.emp_pagamento ?? null,
                hireDate: row.emp_hireDate ?? null,
                bankName: row.emp_bankName ?? null,
                bankAgency: row.emp_bankAgency ?? null,
                bankAccount: row.emp_bankAccount ?? null,
                department: row.dept_name ?? null,
            },
            messages: [{
                id: row.lead_id ?? row.id,
                content: row.msg_content,
                createdAt: row.updatedAt,
                senderType: row.msg_tipo === "lead" ? "EMPLOYEE" : "COMPANY",
            }],
        }))

        return NextResponse.json(result, {
            headers: { "Cache-Control": "no-store" }
        })
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
