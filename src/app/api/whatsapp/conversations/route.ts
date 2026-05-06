export const dynamic = "force-dynamic"
export const revalidate = 0

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

function extractContent(message: any): string {
    if (!message) return ""
    const raw = message.content
    if (!raw) return ""
    if (Array.isArray(raw)) {
        const parts = raw
            .filter((p: any) => p?.type === "text" || typeof p === "string")
            .map((p: any) => (typeof p === "string" ? p : (p.text ?? "")))
        return parts.join("\n").trim()
    }
    if (typeof raw !== "string") return String(raw)
    try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.text === "string") return parsed.text
        if (typeof parsed?.content === "string") return parsed.content
    } catch { /* plain string */ }
    return raw
}

function extractType(message: any): "human" | "ai" | "tool" {
    const t = (message?.type ?? "").toLowerCase()
        .replace("message", "")
        .trim()
    if (t === "human" || t === "user") return "human"
    if (t === "ai" || t === "assistant" || t === "bot") return "ai"
    return "tool"
}

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    const companyId = session.user.companyId

    try {
        // 1. Busca todos os funcionários da empresa (para usar como map de fallback)
        const { data: employees, error: empError } = await supabaseAdmin
            .from("Employee")
            .select("id, name, position, phone, email, cpf, salary, pagamento, hireDate, bankName, bankAgency, bankAccount, departmentId")
            .eq("companyId", companyId)

        if (empError) throw new Error(empError.message)

        const empMap = new Map<string, any>()
        const empBySuffix = new Map<string, any>()

        for (const emp of employees || []) {
            empMap.set(emp.id, emp)
            if (emp.phone) {
                const suffix = String(emp.phone).replace(/\D/g, "").slice(-8)
                if (suffix.length >= 6) {
                    empBySuffix.set(suffix, emp)
                }
            }
        }

        // 2. Busca chat histories do n8n
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

        const result: any[] = []
        const processedSessionIds = new Set<string>()

        // 3. Processa conversas do n8n
        for (const [sessionId, messages] of Object.entries(sessions)) {
            let empData: any = null
            
            // Tenta achar a empresa via resposta de tool (consulta_funcionario)
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

            // Fallback: tenta achar pelo telefone cadastrado do funcionário
            if (!empData) {
                const suffix = sessionId.replace(/\D/g, "").slice(-8)
                if (suffix.length >= 6 && empBySuffix.has(suffix)) {
                    empData = empBySuffix.get(suffix)
                }
            }

            if (!empData) continue // Não pertence a esta empresa

            const visible = messages.filter(r => {
                const t = extractType(r.message)
                return t === "human" || t === "ai"
            })

            if (visible.length === 0) continue

            const latest = visible[visible.length - 1]
            processedSessionIds.add(sessionId)

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
                    createdAt: new Date().toISOString(), // aproximação pois não temos created_at no n8n_chat_histories
                    senderType: extractType(latest.message) === "ai" ? "COMPANY" : "EMPLOYEE",
                }],
            })
        }

        // 4. Busca conversas legado (mensagens_zap)
        if (empBySuffix.size > 0) {
            const { data: zapRows, error: zapError } = await supabaseAdmin
                .from("mensagens_zap")
                .select("id, lead_id, numero_funcionario, tipo, conteudo, created_at, leads(id, celular, nome)")
                .order("created_at", { ascending: false })
                .limit(2000)

            if (!zapError && zapRows) {
                const legacySessions: Record<string, any[]> = {}

                for (const row of zapRows) {
                    const sid = row.lead_id
                    if (!sid) continue
                    if (processedSessionIds.has(sid)) continue
                    
                    const phone = row.numero_funcionario || (row.leads as any)?.celular || ""
                    const suffix = phone.replace(/\D/g, "").slice(-8)

                    if (suffix.length >= 6 && empBySuffix.has(suffix)) {
                        if (!legacySessions[sid]) legacySessions[sid] = []
                        legacySessions[sid].push(row)
                    }
                }

                for (const [sid, messages] of Object.entries(legacySessions)) {
                    const latest = messages[0]
                    const phone = latest.numero_funcionario || (latest.leads as any)?.celular || ""
                    const suffix = phone.replace(/\D/g, "").slice(-8)
                    const empData = empBySuffix.get(suffix)

                    if (!empData) continue
                    
                    // Prevenir duplicatas se a mesma pessoa usar fluxos mistos e tiver o número como session_id
                    const cleanPhone = phone.replace(/\D/g, "")
                    if (processedSessionIds.has(cleanPhone) || processedSessionIds.has("55" + cleanPhone)) continue

                    result.push({
                        id: sid,
                        active: true,
                        updatedAt: latest.created_at,
                        companyId,
                        employeeId: empData.id ?? null,
                        isEmployee: true,
                        messageCount: messages.length,
                        employee: {
                            id: empData.id ?? null,
                            name: empData.name ?? (latest.leads as any)?.nome ?? phone,
                            position: empData.position ?? null,
                            phone: empData.phone ?? phone,
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
                            content: latest.conteudo || "",
                            createdAt: latest.created_at,
                            senderType: latest.tipo === "lead" ? "EMPLOYEE" : "COMPANY",
                        }],
                    })
                }
            }
        }

        // 5. Ordena todas as conversas da mais recente para a mais antiga
        result.sort((a, b) => {
            const dateA = new Date(a.updatedAt || 0).getTime()
            const dateB = new Date(b.updatedAt || 0).getTime()
            return dateB - dateA
        })

        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
