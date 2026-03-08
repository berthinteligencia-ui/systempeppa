import { auth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

const WEBHOOK_URL = "https://webhook.berthia.com.br/webhook/folha2"

// GET /api/whatsapp/messages?conversationId=X
// X agora é o lead_id
export async function GET(req: Request) {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get("conversationId")

    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 })

    try {
        const messages = await query(
            `SELECT
                id::text,
                conteudo AS content,
                CASE WHEN tipo = 'lead' THEN 'EMPLOYEE' ELSE 'COMPANY' END AS "senderType",
                created_at AS "createdAt",
                lead_id::text AS "conversationId"
             FROM mensagens
             WHERE lead_id = $1::uuid
             ORDER BY created_at ASC`,
            [leadId]
        )
        return NextResponse.json(messages)
    } catch (err: any) {
        console.error("[MESSAGES_GET]", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}

// POST /api/whatsapp/messages
// Salva apenas na tabela mensagens e dispara o webhook
export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    let body: any
    try { body = await req.json() } catch { return new NextResponse("Invalid JSON", { status: 400 }) }

    const { content, conversationId, employeeId } = body
    if (!content || (!conversationId && !employeeId)) {
        return new NextResponse("Missing content, leadId or employeeId", { status: 400 })
    }

    const now = new Date().toISOString()

    try {
        console.log("[MESSAGES_POST] Input:", { conversationId, employeeId, contentLen: content?.length })

        let lead: any

        if (employeeId) {
            // Busca o funcionário primeiro para ter o telefone e nome
            const employee = await queryOne(
                `SELECT id, name, phone, "companyId" FROM "Employee" WHERE id = $1 AND "companyId" = $2`,
                [employeeId, session.user.companyId]
            )

            if (!employee) return new NextResponse("Employee not found", { status: 404 })

            // Procura lead por telefone
            const phoneClean = (employee.phone || "").replace(/\D/g, "")
            lead = await queryOne(
                `SELECT id, celular, nome FROM leads WHERE regexp_replace(COALESCE(celular, ''), '\\D', '', 'g') = $1 LIMIT 1`,
                [phoneClean]
            )

            // Se não existe lead, cria um
            if (!lead && phoneClean) {
                const leadId = randomUUID()
                await query(
                    `INSERT INTO leads (id, nome, celular, created_at) VALUES ($1, $2, $3, $4)`,
                    [leadId, employee.name, employee.phone, now]
                )
                lead = { id: leadId, celular: employee.phone, nome: employee.name }
                console.log("[MESSAGES_POST] Novo lead criado para funcionário:", leadId)
            }
        } else {
            // Busca o lead por conversationId (que é o lead_id)
            lead = await queryOne(
                `SELECT l.id, l.celular, l.nome
                 FROM leads l
                 JOIN "Employee" e ON regexp_replace(COALESCE(e.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(l.celular, ''), '\\D', '', 'g')
                 WHERE l.id = $1 AND e."companyId" = $2
                 LIMIT 1`,
                [conversationId, session.user.companyId]
            )
        }

        if (!lead) {
            console.warn("[MESSAGES_POST] Lead não encontrado ou sem permissão:", conversationId || employeeId)
            return new NextResponse("Lead not found or unauthorized", { status: 404 })
        }

        console.log("[MESSAGES_POST] Lead encontrado:", { id: lead.id, celular: lead.celular })

        const messageId = randomUUID()

        // Salva apenas na tabela "mensagens"
        await query(
            `INSERT INTO mensagens (id, lead_id, tipo, conteudo, created_at)
             VALUES ($1, $2, 'user', $3, $4)`,
            [messageId, lead.id, content, now]
        )

        // Envia para o webhook
        if (lead.celular) {
            let cleanPhone = lead.celular.replace(/\D/g, "")
            // Adiciona código do país 55 (Brasil) se não houver
            if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
                cleanPhone = "55" + cleanPhone
            }

            console.log("[MESSAGES_POST] Enviando para webhook:", { cleanPhone, url: WEBHOOK_URL })

            try {
                const whResp = await fetch(WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lead_id: lead.id,          // Formato exato solicitado: lead_id
                        celular: cleanPhone,      // Formato exato solicitado: celular
                        mensagem: content         // Formato exato solicitado: mensagem
                    }),
                })

                console.log("[MESSAGES_POST] Webhook response:", {
                    status: whResp.status,
                    ok: whResp.ok
                })

                if (!whResp.ok) {
                    const errorText = await whResp.text().catch(() => "no-body")
                    console.error("[MESSAGES_POST] Webhook erro body:", errorText)
                }
            } catch (err: any) {
                console.error("[MESSAGES_POST] Erro crítico no fetch do webhook:", err.message)
            }
        }

        return NextResponse.json({
            id: messageId,
            content,
            senderType: 'COMPANY',
            createdAt: now,
            conversationId
        })
    } catch (err: any) {
        console.error("[MESSAGES_POST] Erro geral:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
