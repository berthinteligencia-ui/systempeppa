"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

export async function runBackup() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    try {
        // 1. Coletar dados de todas as tabelas relevantes para a empresa
        // Nota: Em uma implementação real, poderíamos iterar sobre todos os modelos do Prisma
        // Para este MVP, vamos focar nos dados principais.
        const [
            company,
            users,
            employees,
            departments,
            banks,
            payrollAnalyses,
            conversations,
            messages
        ] = await Promise.all([
            prisma.company.findUnique({ where: { id: companyId }, include: { settings: true } }),
            prisma.user.findMany({ where: { companyId } }),
            prisma.employee.findMany({ where: { companyId } }),
            prisma.department.findMany({ where: { companyId } }),
            prisma.bank.findMany(), // Bancos são globais no schema atual
            prisma.payrollAnalysis.findMany({ where: { companyId } }),
            prisma.conversation.findMany({ where: { companyId }, include: { messages: true } }),
            prisma.message.findMany({
                where: {
                    conversation: { companyId }
                }
            })
        ])

        const backupData = {
            metadata: {
                version: "1.0",
                timestamp: new Date().toISOString(),
                companyId,
                companyName: company?.name
            },
            data: {
                company,
                users,
                employees,
                departments,
                banks,
                payrollAnalyses,
                conversations,
                messages
            }
        }

        const fileName = `backup_${companyId}_${new Date().getTime()}.json`
        const fileContent = JSON.stringify(backupData, null, 2)

        // 2. Upload para o Supabase Storage (Bucket: backups)
        const { error: uploadError } = await supabase.storage
            .from("backups")
            .upload(fileName, fileContent, {
                contentType: "application/json",
                upsert: true
            })

        if (uploadError) {
            // Se o bucket não existir, tentamos criar (embora o ideal seja criado manualmente)
            console.error("[BACKUP] Erro no upload:", uploadError)
            throw new Error(`Erro ao salvar backup: ${uploadError.message}`)
        }

        return { success: true, fileName }
    } catch (err: any) {
        console.error("[BACKUP] Falha crítica:", err)
        throw new Error(err.message || "Erro interno no backup")
    }
}

export async function listBackups() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase.storage
        .from("backups")
        .list("", {
            limit: 10,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
            search: companyId
        })

    if (error) throw error
    return data || []
}

export async function getBackupUrl(fileName: string) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const supabase = getSupabaseAdmin()
    const { data } = await supabase.storage
        .from("backups")
        .createSignedUrl(fileName, 3600) // URL válida por 1 hora

    return data?.signedUrl || null
}
