import { supabaseAdmin } from "@/lib/db"

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
        await supabaseAdmin.from("activity_logs").insert({
            user_id: params.userId,
            user_name: params.userName,
            user_email: params.userEmail,
            company_id: params.companyId,
            action: params.action,
            target: params.target ?? null,
            details: params.details ? JSON.stringify(params.details) : null,
            ip_address: params.ipAddress ?? null,
        })
    } catch (err: any) {
        console.error("[logActivity] Erro ao registrar log:", err.message)
    }
}
