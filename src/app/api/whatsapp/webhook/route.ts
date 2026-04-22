import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
    let body: any
    try { body = await req.json() } catch {
        return new NextResponse("Invalid JSON", { status: 400 })
    }

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
    const phoneLast10 = phoneClean.slice(-10)

    try {
        // Busca funcionário pelo telefone (últimos 10 dígitos)
        const { data: employees } = await supabaseAdmin
            .from("Employee")
            .select("id, name, companyId, phone")

        const employee = (employees ?? []).find(e =>
            (e.phone ?? "").replace(/\D/g, "").slice(-10) === phoneLast10
        )

        if (!employee) {
            console.warn("[WEBHOOK_IN] Funcionário não encontrado:", phoneClean)
            return new NextResponse(JSON.stringify({ error: "Employee not found", phone: phoneClean }), { status: 404 })
        }

        // Busca lead pelo telefone
        const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("id, celular, nome")

        const lead = (leads ?? []).find(l =>
            (l.celular ?? "").replace(/\D/g, "").slice(-10) === phoneLast10
        )

        const now = new Date().toISOString()
        let leadId = lead?.id

        if (!leadId) {
            leadId = randomUUID()
            await supabaseAdmin.from("leads").insert({
                id: leadId,
                nome: employee.name,
                celular: phoneClean,
                created_at: now,
            })
        }

        const messageId = randomUUID()
        await supabaseAdmin.from("mensagens_zap").insert({
            id: messageId,
            lead_id: leadId,
            tipo: "lead",
            conteudo: messageText,
            created_at: now,
            numero_funcionario: phoneClean,
            funcionario: "true",
        })

        // Busca webhookToken da empresa para repassar ao n8n
        const { data: companyData } = await supabaseAdmin
            .from("Company")
            .select("webhookToken")
            .eq("id", employee.companyId)
            .maybeSingle()

        // Dispara n8n workflow de forma assíncrona (fire-and-forget)
        fetch("https://teste.berthia.com.br/webhook/secretaria-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employeeId: employee.id,
                employeeName: employee.name,
                companyId: employee.companyId,
                phone: phoneClean,
                leadId,
                messageText,
                messageId,
                webhookToken: companyData?.webhookToken ?? "",
            }),
        }).catch(err => console.error("[WEBHOOK_N8N] Erro ao chamar n8n:", err.message))

        return NextResponse.json({ ok: true, messageId })
    } catch (err: any) {
        console.error("[WEBHOOK_IN] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ status: "webhook ativo", endpoint: "/api/whatsapp/webhook" })
}
