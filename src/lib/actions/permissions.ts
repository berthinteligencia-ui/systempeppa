"use server"

import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"
import { CONTROLLABLE_ROLES, DEFAULT_PERMISSIONS, type AllPermissions, type PermissionMap } from "@/lib/permissions-config"

export async function getRolePermissions(companyId: string): Promise<AllPermissions> {
    try {
        const supabase = getSupabaseAdmin()
        const { data: rows, error } = await supabase
            .from("role_permissions")
            .select("role, permissions")
            .eq("company_id", companyId)

        if (error) throw error

        const result: AllPermissions = {}
        for (const role of CONTROLLABLE_ROLES) {
            const row = (rows ?? []).find((r: any) => r.role === role)
            result[role] = row ? (row.permissions as PermissionMap) : { ...DEFAULT_PERMISSIONS[role] }
        }
        return result
    } catch (err: any) {
        console.error("[getRolePermissions] Error:", err?.message)
        // Fallback to defaults so the page still loads
        const result: AllPermissions = {}
        for (const role of CONTROLLABLE_ROLES) {
            result[role] = { ...DEFAULT_PERMISSIONS[role] }
        }
        return result
    }
}

export async function updateRolePermissions(role: string, permissions: PermissionMap): Promise<void> {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    if (session.user.role !== "ADMIN") throw new Error("Apenas ADMINs podem alterar permissões")
    if (!CONTROLLABLE_ROLES.includes(role as any)) throw new Error("Role inválido")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
        .from("role_permissions")
        .upsert(
            { company_id: companyId, role, permissions, updated_at: new Date().toISOString() },
            { onConflict: "company_id,role" }
        )

    if (error) throw new Error(error.message)

    revalidatePath("/configuracoes")
}
