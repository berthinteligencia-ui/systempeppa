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

        // 4. Agrupa mensagens por contato (numero_funcionario ou lead_id)
        const grouped: Record<string, any[]> = {}
        for (const msg of messages ?? []) {
            const key = msg.numero_funcionario || msg.lead_id || msg.id
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(msg)
        }

        // 5. Monta resultado
        const result = Object.entries(grouped).map(([key, msgs]) => {
            const latest = msgs[0]
            const lead = latest.lead_id ? leadsMap[latest.lead_id] : null

            // Tenta encontrar funcionário pelo numero_funcionario ou celular do lead
            const contactPhone = normPhone(latest.numero_funcionario) || normPhone(lead?.celular)
            const emp = contactPhone ? empByPhone[contactPhone] : null

            return {
                id: key,
                active: true,
                updatedAt: latest.created_at,
                companyId,
                employeeId: emp?.id ?? null,
                isEmployee: !!emp,
                employee: {
                    id: emp?.id ?? null,
                    name: emp?.name ?? lead?.nome ?? latest.numero_funcionario ?? "—",
                    position: emp?.position ?? null,
                    phone: emp?.phone ?? lead?.celular ?? latest.numero_funcionario,
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

        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[CONVERSATIONS_GET] Erro:", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
