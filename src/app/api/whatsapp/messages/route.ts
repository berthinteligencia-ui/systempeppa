export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

const CRM_WEBHOOK_URL = "https://webhook.berthia.com.br/webhook/enviacrmzap"

const normPhone = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10)

export async function GET(req: Request) {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")

    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })
    if (!conversationId) return new NextResponse("Missing conversationId", { status: 400 })

    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)

        let query = supabaseAdmin
            .from("mensagens_zap")
            .select("id, conteudo, tipo, created_at, lead_id, numero_funcionario")
            .order("created_at", { ascending: true })

        if (isUuid) {
            query = query.eq("lead_id", conversationId)
        } else {
            query = query.eq("numero_funcionario", conversationId)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)

        const messages = (data ?? []).map(m => ({
            id: m.id,
            content: m.conteudo,
            senderType: m.tipo === "lead" ? "EMPLOYEE" : "COMPANY",
            createdAt: m.created_at,
            conversationId,
        }))

        return NextResponse.json(messages, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[MESSAGES_GET]", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    let body: any
    try { body = await req.json() } catch { return new NextResponse("Invalid JSON", { status: 400 }) }

    const { content, conversationId, employeeId } = body
    if (!content || (!conversationId && !employeeId)) {
        return new NextResponse("Missing content or conversationId", { status: 400 })
    }

    const now = new Date().toISOString()

    try {
        let lead: any = null

        if (employeeId) {
            const { data: emp } = await supabaseAdmin
                .from("Employee")
                .select("id, name, phone, companyId")
                .eq("id", employeeId)
                .eq("companyId", session.user.companyId)
                .single()

            if (!emp) return new NextResponse("Employee not found", { status: 404 })

            const phoneClean = normPhone(emp.phone)
            const { data: existingLead } = await supabaseAdmin
                .from("leads")
                .select("id, celular, nome")
                .filter("celular", "ilike", `%${phoneClean.slice(-8)}%`)
                .limit(1)
                .maybeSingle()

            lead = existingLead
            if (!lead && phoneClean) {
                const leadId = randomUUID()
                await supabaseAdmin.from("leads").insert({ id: leadId, nome: emp.name, celular: emp.phone, created_at: now })
                lead = { id: leadId, celular: emp.phone, nome: emp.name }
            }
        } else {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)
            if (isUuid) {
                const { data } = await supabaseAdmin.from("leads").select("id, celular, nome").eq("id", conversationId).maybeSingle()
                lead = data
            } else {
                // Se não é UUID, assume que é telefone (numero_funcionario)
                const phoneClean = normPhone(conversationId)
                if (phoneClean) {
                    const { data: existingLead } = await supabaseAdmin
                        .from("leads")
                        .select("id, celular, nome")
                        .filter("celular", "ilike", `%${phoneClean.slice(-8)}%`)
                        .limit(1)
                        .maybeSingle()

                    lead = existingLead
                    if (!lead) {
                        // Cria lead se não existir
                        const leadId = randomUUID()
                        await supabaseAdmin.from("leads").insert({
                            id: leadId,
                            nome: conversationId,
                            celular: conversationId,
                            created_at: now
                        })
                        lead = { id: leadId, celular: conversationId, nome: conversationId }
                    }
                }
            }
        }

        if (!lead) return new NextResponse("Lead not found", { status: 404 })

        // Normaliza o telefone do lead para numero_funcionario (chave de agrupamento das conversas)
        const phoneNorm = lead.celular ? lead.celular.replace(/\D/g, "").slice(-10) : null

        const messageId = randomUUID()
        await supabaseAdmin.from("mensagens_zap").insert({
            id: messageId,
            lead_id: lead.id,
            numero_funcionario: phoneNorm || null,
            tipo: "user",
            conteudo: content,
            created_at: now,
        })

        if (lead.celular) {
            let phone = lead.celular.replace(/\D/g, "")
            if (phone.length <= 11) phone = "55" + phone

            const { data: company } = await supabaseAdmin
                .from("Company")
                .select("webhookToken")
                .eq("id", session.user.companyId)
                .single()

            try {
                await fetch(CRM_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token: company?.webhookToken || null,
                        lead_id: lead.id,
                        celular: phone,
                        mensagem: content,
                    }),
                })
            } catch (e: any) { console.error("[MESSAGES_POST] Webhook erro:", e.message) }
        }

        return NextResponse.json({ id: messageId, content, senderType: "COMPANY", createdAt: now, conversationId })
    } catch (err: any) {
        console.error("[MESSAGES_POST] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
