import { query } from "@/lib/db"

interface LogParams {
    userId: string
    userName: string
    userEmail: string
    companyId: string
    action: string
    target?: string
    details?: object
    ipAddress?: string
}

export async function logActivity(params: LogParams): Promise<void> {
    try {
        await query(
            `INSERT INTO activity_logs (user_id, user_name, user_email, company_id, action, target, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                params.userId,
                params.userName,
                params.userEmail,
                params.companyId,
                params.action,
                params.target ?? null,
                params.details ? JSON.stringify(params.details) : null,
                params.ipAddress ?? null,
            ]
        )
    } catch (err: any) {
        // Não deixar erro de log quebrar o fluxo principal
        console.error("[logActivity] Erro ao registrar log:", err.message)
    }
}
