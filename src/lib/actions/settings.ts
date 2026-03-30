"use server"

import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { logActivity } from "@/lib/logActivity"

export async function getCompanySettings() {
    const session = await auth()
    if (!session?.user?.companyId) return null
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const { data: company } = await supabase
        .from("Company")
        .select("*, settings:Settings(*)")
        .eq("id", companyId)
        .single()

    if (!company) return null

    const settings = Array.isArray(company.settings) ? company.settings[0] : company.settings

    if (!settings) {
        const now = new Date().toISOString()
        const { data: newSettings } = await supabase
            .from("Settings")
            .insert({
                id: randomUUID(),
                companyId,
                createdAt: now,
                updatedAt: now,
            })
            .select()
            .single()
        return { ...company, settings: newSettings }
    }

    return { ...company, settings }
}

export async function updateCompanySettings(data: {
    name?: string
    cnpj?: string
    whatsapp?: string
    email?: string
    address?: string
    city?: string
    state?: string
    settings?: {
        whatsappNotifications?: boolean
        autoBackup?: boolean
        whatsappWebhookUrl?: string
        payrollReminderDays?: number
    }
}) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const { settings, ...companyData } = data

    check(await supabase.from("Company").update({ ...companyData, updatedAt: new Date().toISOString() }).eq("id", companyId))

    if (settings) {
        // Fetch existing settings to get the ID if it exists
        const { data: existing } = await supabase
            .from("Settings")
            .select("id")
            .eq("companyId", companyId)
            .single()

        check(await supabase.from("Settings").upsert(
            { ...settings, id: existing?.id || randomUUID(), companyId, updatedAt: new Date().toISOString() },
            { onConflict: "companyId" }
        ))
    }

    await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? "",
        userEmail: session.user.email ?? "",
        companyId,
        action: "SAVE_SETTINGS",
        target: "Configurações da Empresa",
    })

    revalidatePath("/(dashboard)/configuracoes")
    revalidatePath("/dashboard")

    const { data: result } = await supabase
        .from("Company")
        .select("*, settings:Settings(*)")
        .eq("id", companyId)
        .single()

    if (!result) return null
    const s = Array.isArray(result.settings) ? result.settings[0] : result.settings
    return { ...result, settings: s }
}
