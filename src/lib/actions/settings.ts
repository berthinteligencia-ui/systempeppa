"use server"

import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { logActivity } from "@/lib/logActivity"
import { resetMonthlyStatus } from "./employees"

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
        payrollReminderDays?: number
    }
    whatsappWebhookUrl?: string
}) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const { settings, whatsappWebhookUrl, ...companyData } = data

    const finalCompanyData: any = { ...companyData, updatedAt: new Date().toISOString() };
    if (whatsappWebhookUrl !== undefined) {
        finalCompanyData.whatsappWebhookUrl = whatsappWebhookUrl;
    }

    check(await supabase.from("Company").update(finalCompanyData).eq("id", companyId))

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

export async function checkAndPerformMonthlyReset() {
    const session = await auth()
    if (!session?.user?.companyId) return
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    // 1. Obter configurações atuais
    const { data: settings } = await supabase
        .from("Settings")
        .select("id, lastResetMonth, lastResetYear")
        .eq("companyId", companyId)
        .maybeSingle()

    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()

    // Se as configurações não existem, criamos e marcamos como resetado (para não resetar retroativamente na primeira vez)
    if (!settings) {
        const id = randomUUID()
        const timestamp = now.toISOString()
        await supabase.from("Settings").insert({
            id,
            companyId,
            lastResetMonth: currentMonth,
            lastResetYear: currentYear,
            createdAt: timestamp,
            updatedAt: timestamp
        })
        return
    }

    // 2. Verificar se precisa resetar
    const needsReset = !settings.lastResetMonth || 
                       !settings.lastResetYear || 
                       settings.lastResetMonth !== currentMonth || 
                       settings.lastResetYear !== currentYear

    if (needsReset) {
        console.log(`[AUTO-RESET] Resetando empresa ${companyId} para o mês ${currentMonth}/${currentYear}`)
        
        // Executa o reset de funcionários
        await resetMonthlyStatus()

        // Atualiza a marca de tempo do último reset
        await supabase.from("Settings")
            .update({
                lastResetMonth: currentMonth,
                lastResetYear: currentYear,
                updatedAt: now.toISOString()
            })
            .eq("id", settings.id)
            
    }
}
