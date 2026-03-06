"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

export async function runBackup() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    try {
        const [
            { data: company },
            { data: users },
            { data: employees },
            { data: departments },
            { data: banks },
            { data: payrollAnalyses },
            { data: conversations },
            { data: messages },
        ] = await Promise.all([
            supabase.from("Company").select("*, settings:Settings(*)").eq("id", companyId).maybeSingle(),
            supabase.from("User").select("*").eq("companyId", companyId),
            supabase.from("Employee").select("*").eq("companyId", companyId),
            supabase.from("Department").select("*").eq("companyId", companyId),
            supabase.from("Bank").select("*"),
            supabase.from("PayrollAnalysis").select("*").eq("companyId", companyId),
            supabase.from("Conversation").select("*").eq("companyId", companyId),
            supabase.from("Message").select("*, conversation:Conversation!inner(companyId)").eq("conversation.companyId", companyId),
        ])

        const backupData = {
            metadata: {
                version: "1.0",
                timestamp: new Date().toISOString(),
                companyId,
                companyName: (company as any)?.name,
            },
            data: { company, users, employees, departments, banks, payrollAnalyses, conversations, messages },
        }

        const timestamp = new Date().getTime()
        const fileName = `${companyId}/backup_${timestamp}.json`
        const fileContent = JSON.stringify(backupData, null, 2)
        const fileSize = Buffer.byteLength(fileContent)

        const { error: uploadError } = await supabase.storage
            .from("backups")
            .upload(fileName, fileContent, { contentType: "application/json", upsert: true })

        if (uploadError) throw new Error(`Erro ao salvar backup no storage: ${uploadError.message}`)

        const now = new Date().toISOString()
        await supabase.from("Backup").insert({
            id: randomUUID(),
            fileName,
            fileSize,
            companyId,
            status: "SUCCESS",
            createdAt: now,
        })

        revalidatePath("/(dashboard)/configuracoes")
        return { success: true, fileName }
    } catch (err: any) {
        console.error("[BACKUP] Falha crítica:", err)
        throw new Error(err.message || "Erro interno no backup")
    }
}

export async function listBackups() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const supabase = getSupabaseAdmin()
    const { data } = await supabase
        .from("Backup")
        .select("*")
        .eq("companyId", session.user.companyId)
        .order("createdAt", { ascending: false })
        .limit(10)

    return data ?? []
}

export async function getBackupUrl(fileName: string) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const supabase = getSupabaseAdmin()
    const { data } = await supabase.storage.from("backups").createSignedUrl(fileName, 3600)
    return data?.signedUrl || null
}

export async function deleteBackup(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const supabase = getSupabaseAdmin()
    const { data: backup } = await supabase
        .from("Backup")
        .select("*")
        .eq("id", id)
        .eq("companyId", session.user.companyId)
        .maybeSingle()

    if (!backup) throw new Error("Backup não encontrado")

    await supabase.storage.from("backups").remove([backup.fileName])
    await supabase.from("Backup").delete().eq("id", id)

    revalidatePath("/(dashboard)/configuracoes")
}
