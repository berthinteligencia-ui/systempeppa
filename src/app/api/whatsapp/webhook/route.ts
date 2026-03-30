import { query, queryOne } from "@/lib/db"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

// Recebe mensagens do WhatsApp via berthia.com.br
// Configure o provider para enviar POST para: /api/whatsapp/webhook

export async function POST(req: Request) {
    let body: any
    try {
        body = await req.json()
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 })
    }

    console.log("[WEBHOOK_IN] Payload:", JSON.stringify(body))

    // Aceita diferentes formatos de payload
    const phone: string =
        body.phone ?? body.from ?? body.sender ?? body.numero ??
        body.remoteJid?.replace("@s.whatsapp.net", "") ?? ""

    const messageText: string =
        body.message ?? body.text ?? body.body ?? body.mensagem ??
        body.data?.message ?? body.data?.text ?? ""

    if (!phone || !messageText) {
        return new NextResponse(JSON.stringify({ error: "Missing phone or message" }), { status: 400 })
    }

    const phoneClean = phone.replace(/\D/g, "")
    const phoneWithoutPrefix = phoneClean.startsWith("55") ? phoneClean.substring(2) : phoneClean

    try {
        // Busca funcionário pelo telefone (normaliza dígitos)
        // Tenta encontrar pelo número completo ou sem o prefixo 55
        const employee = await queryOne(
            `SELECT id, name, "companyId" FROM "Employee"
             WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = RIGHT($1, 10)
             LIMIT 1`,
            [phoneClean]
        )

        if (!employee) {
            console.warn("[WEBHOOK_IN] Funcionário não encontrado para phone:", phoneClean)
            return new NextResponse(JSON.stringify({ error: "Employee not found", phone: phoneClean }), { status: 404 })
        }

        // Busca lead correspondente
        let lead = await queryOne(
            `SELECT id, celular, nome FROM leads
             WHERE RIGHT(regexp_replace(COALESCE(celular, ''), '\\D', '', 'g'), 10) = RIGHT($1, 10)
             LIMIT 1`,
            [phoneClean]
        )

        const now = new Date().toISOString()
        const messageId = randomUUID()

        // Se o lead não existe, cria um novo a partir das informações do funcionário
        if (!lead) {
            console.log("[WEBHOOK_IN] Criando novo lead para phone:", phoneClean)
            const newLeadId = randomUUID()
            await query(
                `INSERT INTO leads (id, nome, celular, created_at) VALUES ($1, $2, $3, $4)`,
                [newLeadId, employee.name, phoneClean, now]
            )
            lead = { id: newLeadId, celular: phoneClean, nome: employee.name }
        }

        // Salva na tabela "mensagens_zap" incluindo dados do funcionário
        const phoneNorm = phoneClean
        await query(
            `INSERT INTO mensagens_zap (id, lead_id, tipo, conteudo, created_at, numero_funcionario, funcionario)
             VALUES ($1, $2, 'lead', $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [messageId, lead.id, messageText, now, phoneNorm, employee ? 'true' : 'false']
        )

        console.log("[WEBHOOK_IN] Mensagem salva em mensagens_zap:", messageId)

        return NextResponse.json({ ok: true, messageId })
    } catch (err: any) {
        console.error("[WEBHOOK_IN] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ status: "webhook ativo", endpoint: "/api/whatsapp/webhook" })
}
