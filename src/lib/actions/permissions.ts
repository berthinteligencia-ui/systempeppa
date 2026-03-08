"use server"

import { auth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { revalidatePath } from "next/cache"

export type PermissionMap = Record<string, boolean>
export type AllPermissions = Record<string, PermissionMap> // role -> feature -> bool

export const ALL_FEATURES = [
    { key: "funcionarios",   label: "Funcionários" },
    { key: "unidades",       label: "Unidades" },
    { key: "nfs",            label: "Notas Fiscais" },
    { key: "folha_pagamento",label: "Folha de Pagamento" },
    { key: "comprovante",    label: "Comprovante" },
    { key: "whatsapp",       label: "WhatsApp Business" },
    { key: "relatorios",     label: "Relatórios" },
    { key: "bancos",         label: "Bancos" },
]

export const CONTROLLABLE_ROLES = ["RH", "GESTOR", "FUNCIONARIO"] as const

// Permissões padrão quando não há registro no banco
const DEFAULT_PERMISSIONS: Record<string, PermissionMap> = {
    RH:          { funcionarios: true, unidades: true, nfs: true, folha_pagamento: true, comprovante: true, whatsapp: true, relatorios: true, bancos: true },
    GESTOR:      { funcionarios: false, unidades: true, nfs: false, folha_pagamento: false, comprovante: true, whatsapp: true, relatorios: true, bancos: false },
    FUNCIONARIO: { funcionarios: false, unidades: false, nfs: false, folha_pagamento: false, comprovante: true, whatsapp: false, relatorios: false, bancos: false },
}

export async function getRolePermissions(companyId: string): Promise<AllPermissions> {
    const rows = await query<{ role: string; permissions: PermissionMap }>(
        `SELECT role, permissions FROM role_permissions WHERE company_id = $1`,
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
        `INSERT INTO role_permissions (company_id, role, permissions, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (company_id, role) DO UPDATE
         SET permissions = $3::jsonb, updated_at = NOW()`,
        [companyId, role, JSON.stringify(permissions)]
    )

    revalidatePath("/configuracoes")
}
