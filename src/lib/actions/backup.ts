"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function runBackup() {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    try {
        // 1. Coletar dados de todas as tabelas relevantes para a empresa
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
            prisma.bank.findMany(),
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

        const timestamp = new Date().getTime()
        const fileName = `${companyId}/backup_${timestamp}.json` // Usando sub pasta por empresa
        const fileContent = JSON.stringify(backupData, null, 2)
        const fileSize = Buffer.byteLength(fileContent)

        // 2. Upload para o Supabase Storage (Bucket: backups)
        const { error: uploadError } = await supabase.storage
            .from("backups")
            .upload(fileName, fileContent, {
                contentType: "application/json",
                upsert: true
            })

        if (uploadError) {
            console.error("[BACKUP] Erro no upload:", uploadError)
            throw new Error(`Erro ao salvar backup no storage: ${uploadError.message}`)
        }

        // 3. Registrar no banco de dados
        await prisma.backup.create({
            data: {
                fileName,
                fileSize,
                companyId,
                status: "SUCCESS"
            }
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

    const companyId = session.user.companyId

    // Retorna do banco de dados (mais rápido e permite metadados)
    return await prisma.backup.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10
    })
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

export async function deleteBackup(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const backup = await prisma.backup.findUnique({
        where: { id, companyId }
    })

    if (!backup) throw new Error("Backup não encontrado")

    // 1. Remover do Storage
    const { error: storageError } = await supabase.storage
        .from("backups")
        .remove([backup.fileName])

    if (storageError) {
        console.error("[BACKUP] Erro ao remover do storage:", storageError)
        // Mesmo com erro no storage, prosseguimos para limpar o DB se o arquivo não existir mais
    }

    // 2. Remover do Banco
    await prisma.backup.delete({
        where: { id }
    })

    revalidatePath("/(dashboard)/configuracoes")
}
