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
}) {
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

    if (data.id) {
        check(await supabase.from("PayrollAnalysis").update(payload).eq("id", data.id).eq("companyId", companyId))
    } else {
        const id = randomUUID()
        check(await supabase.from("PayrollAnalysis").upsert(
            { ...payload, id, departmentId: data.departmentId ?? null, createdAt: now },
            { onConflict: "month,year,departmentId,companyId" }
        ))
    }

    revalidatePath("/folha-pagamento")
    revalidatePath("/dashboard")
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
}
