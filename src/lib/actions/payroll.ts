"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { randomUUID } from "crypto"

async function getCompanyId() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autenticado")
    return session.user.companyId
}

export async function savePayrollAnalysis(data: {
    id?: string
    month: number
    year: number
    departmentId?: string | null
    total: number
    analysisData: any
}): Promise<{ id: string }> {
    const companyId = await getCompanyId()
    const supabase = getSupabaseAdmin()

    const now = new Date().toISOString()
    const payload = {
        month: data.month,
        year: data.year,
        departmentId: data.departmentId || null,
        companyId,
        total: data.total,
        data: data.analysisData,
        status: "OPEN",
        updatedAt: now,
    }

    let savedId: string

    if (data.id) {
        // Re-save de uma folha já existente → atualiza o registro pelo ID
        check(await supabase.from("PayrollAnalysis").update(payload).eq("id", data.id).eq("companyId", companyId))
        savedId = data.id
    } else {
        // Nova folha → sempre insere um novo registro
        savedId = randomUUID()
        check(await supabase.from("PayrollAnalysis").insert(
            { ...payload, id: savedId, departmentId: data.departmentId ?? null, createdAt: now }
        ))
    }

    // Reativa funcionários encontrados na folha, mas mantém pagamento como pendente
    const foundIds: string[] = (data.analysisData?.found ?? [])
        .map((e: any) => e.id)
        .filter(Boolean)

    if (foundIds.length > 0) {
        await supabase.from("Employee")
            .update({ status: "ACTIVE", pagamento: "pendente", updatedAt: now })
            .in("id", foundIds)
            .eq("companyId", companyId)
    }

    revalidatePath("/folha-pagamento")
    revalidatePath("/funcionarios")
    revalidatePath("/dashboard")

    return { id: savedId }
}

export async function listPayrollAnalyses() {
    const companyId = await getCompanyId()
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
        .from("PayrollAnalysis")
        .select("*, department:Department(name)")
        .eq("companyId", companyId)
        .order("createdAt", { ascending: false })
    return (data ?? []).map(r => ({ ...r, total: Number(r.total) }))
}

export async function getPayrollAnalysis(id: string) {
    const companyId = await getCompanyId()
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
        .from("PayrollAnalysis")
        .select("*")
        .eq("id", id)
        .eq("companyId", companyId)
        .maybeSingle()
    if (!data) return null
    return { ...data, total: Number(data.total) }
}

export async function deletePayrollAnalysis(id: string) {
    const companyId = await getCompanyId()
    const supabase = getSupabaseAdmin()
    check(await supabase.from("PayrollAnalysis").delete().eq("id", id).eq("companyId", companyId))
    revalidatePath("/folha-pagamento")
    revalidatePath("/relatorios")
    revalidatePath("/dashboard")
}
