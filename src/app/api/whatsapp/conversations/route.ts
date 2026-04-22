export const dynamic = "force-dynamic"
export const revalidate = 0

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

function extractContent(message: any): string {
    if (!message) return ""
    const raw = message.content
    if (!raw) return ""
    if (typeof raw !== "string") return String(raw)
    try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.text === "string") return parsed.text
    } catch { /* plain string */ }
    return raw
}

function extractType(message: any): "human" | "ai" | "tool" {
    const t = message?.type
    if (t === "human") return "human"
    if (t === "ai") return "ai"
    return "tool"
}

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    const companyId = session.user.companyId

    try {
        // Tabela n8n_chat_histories tem colunas: id (int), session_id, message (jsonb)
        // Sem coluna created_at — usa id como proxy de ordem cronológica
        const { data: chatRows, error: chatError } = await supabaseAdmin
            .from("n8n_chat_histories")
            .select("id, session_id, message")
            .order("id", { ascending: true })
            .limit(5000)

        if (chatError) throw new Error(chatError.message)

        // Agrupa por session_id mantendo ordem por id
        const sessions: Record<string, any[]> = {}
        for (const row of chatRows ?? []) {
            const sid = String(row.session_id ?? "").trim()
            if (!sid) continue
            if (!sessions[sid]) sessions[sid] = []
            sessions[sid].push(row)
        }

        // Para cada sessão, verifica empresa via resposta de tool (consulta_funcionario)
        const result: any[] = []

        for (const [sessionId, messages] of Object.entries(sessions)) {
            let empData: any = null
            for (const row of messages) {
                const msg = row.message
                if (msg?.type !== "tool") continue
                try {
                    const parsed = JSON.parse(msg.content ?? "[]")
                    const arr = Array.isArray(parsed) ? parsed : [parsed]
                    const found = arr.find((e: any) => e?.companyId === companyId)
                    if (found) { empData = found; break }
                } catch { /* continua */ }
            }

            if (!empData) continue

            const visible = messages.filter(r => {
                const t = extractType(r.message)
                return t === "human" || t === "ai"
            })

            if (visible.length === 0) continue

            const latest = visible[visible.length - 1]

            result.push({
                id: sessionId,
                active: true,
                updatedAt: new Date().toISOString(),
                companyId,
                employeeId: empData.id ?? null,
                isEmployee: true,
                messageCount: visible.length,
                employee: {
                    id: empData.id ?? null,
                    name: empData.name ?? sessionId,
                    position: empData.position ?? null,
                    phone: empData.phone ?? sessionId,
                    email: empData.email ?? null,
                    cpf: empData.cpf ?? null,
                    salary: empData.salary ? Number(empData.salary) : null,
                    pagamento: empData.pagamento ?? null,
                    hireDate: empData.hireDate ?? null,
                    bankName: empData.bankName ?? null,
                    bankAgency: empData.bankAgency ?? null,
                    bankAccount: empData.bankAccount ?? null,
                    department: empData.department ?? null,
                },
                messages: [{
                    id: String(latest.id),
                    content: extractContent(latest.message),
                    createdAt: new Date().toISOString(),
                    senderType: extractType(latest.message) === "ai" ? "COMPANY" : "EMPLOYEE",
                }],
            })
        }

        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
