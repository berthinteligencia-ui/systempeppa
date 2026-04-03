export const dynamic = "force-dynamic"
export const revalidate = 0

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    const companyId = session.user.companyId

    try {
        // 1. Busca todas as mensagens com lead info
        const { data: messages, error: msgError } = await supabaseAdmin
            .from("mensagens_zap")
            .select("id, lead_id, conteudo, tipo, created_at, numero_funcionario")
            .order("created_at", { ascending: false })

        if (msgError) throw new Error(msgError.message)

        // 2. Busca leads referenciados
        const leadIds = [...new Set((messages ?? []).map(m => m.lead_id).filter(Boolean))]
        const leadsMap: Record<string, any> = {}
        if (leadIds.length > 0) {
            const { data: leads } = await supabaseAdmin
                .from("leads")
                .select("id, nome, celular")
                .in("id", leadIds)
            for (const l of leads ?? []) leadsMap[l.id] = l
        }

        // 3. Busca funcionários da empresa com departamento
        const { data: employees } = await supabaseAdmin
            .from("Employee")
            .select("id, name, position, phone, email, cpf, salary, pagamento, hireDate, bankName, bankAgency, bankAccount, departmentId, Department(name)")
            .eq("companyId", companyId)

        const empList = employees ?? []

        // Normaliza telefone: remove não-dígitos, pega últimos 10 dígitos
        const normPhone = (p: string | null | undefined) =>
            (p ?? "").replace(/\D/g, "").slice(-10)

        // Monta mapa: telefone normalizado → employee
        const empByPhone: Record<string, any> = {}
        for (const e of empList) {
            const n = normPhone(e.phone)
            if (n) empByPhone[n] = e
        }

        // 4. Agrupa mensagens por telefone normalizado (últimos 10 dígitos)
        //    Garante que o mesmo contato apareça como UMA única conversa
        const grouped: Record<string, any[]> = {}
        for (const msg of messages ?? []) {
            const lead = msg.lead_id ? leadsMap[msg.lead_id] : null
            const rawPhone = msg.numero_funcionario || lead?.celular || ""
            const key = normPhone(rawPhone) || msg.lead_id || msg.id
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(msg)
        }

        // 5. Monta resultado — uma entrada por contato, ordenada pela mensagem mais recente
        const result = Object.entries(grouped)
            .map(([key, msgs]) => {
                // Ordena para garantir que latest seja de fato o mais recente
                const sorted = [...msgs].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                const latest = sorted[0]
                const lead = latest.lead_id ? leadsMap[latest.lead_id] : null

                const contactPhone = normPhone(latest.numero_funcionario) || normPhone(lead?.celular) || key
                const emp = empByPhone[contactPhone] ?? null

                return {
                    id: key,
                    active: true,
                    updatedAt: latest.created_at,
                    companyId,
                    employeeId: emp?.id ?? null,
                    isEmployee: !!emp,
                    employee: {
                        id: emp?.id ?? null,
                        name: emp?.name ?? lead?.nome ?? key,
                        position: emp?.position ?? null,
                        phone: emp?.phone ?? lead?.celular ?? key,
                        email: emp?.email ?? null,
                        cpf: emp?.cpf ?? null,
                        salary: emp?.salary ? Number(emp.salary) : null,
                        pagamento: emp?.pagamento ?? null,
                        hireDate: emp?.hireDate ?? null,
                        bankName: emp?.bankName ?? null,
                        bankAgency: emp?.bankAgency ?? null,
                        bankAccount: emp?.bankAccount ?? null,
                        department: (emp?.Department as any)?.name ?? null,
                    },
                    messages: [{
                        id: latest.id,
                        content: latest.conteudo,
                        createdAt: latest.created_at,
                        senderType: latest.tipo === "lead" ? "EMPLOYEE" : "COMPANY",
                    }],
                }
            })
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
