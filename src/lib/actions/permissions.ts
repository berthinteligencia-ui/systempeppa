"use server"

import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { CONTROLLABLE_ROLES, DEFAULT_PERMISSIONS, type AllPermissions, type PermissionMap } from "@/lib/permissions-config"

export async function getRolePermissions(companyId: string): Promise<AllPermissions> {
    const rows = await query<{ role: string; permissions: PermissionMap }>(
        `SELECT role, permissions FROM public.role_permissions WHERE company_id = $1`,
        [companyId]
    )
    const result: AllPermissions = {}
    for (const role of CONTROLLABLE_ROLES) {
        const row = rows.find(r => r.role === role)
        result[role] = row ? row.permissions : { ...DEFAULT_PERMISSIONS[role] }
    }
    return result
}

export async function updateRolePermissions(role: string, permissions: PermissionMap): Promise<void> {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    if (session.user.role !== "ADMIN") throw new Error("Apenas ADMINs podem alterar permissões")
    if (!CONTROLLABLE_ROLES.includes(role as any)) throw new Error("Role inválido")

    const companyId = session.user.companyId

    await query(
        `INSERT INTO public.role_permissions (company_id, role, permissions, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (company_id, role) DO UPDATE
         SET permissions = $3::jsonb, updated_at = NOW()`,
        [companyId, role, JSON.stringify(permissions)]
    )

    revalidatePath("/configuracoes")
}
