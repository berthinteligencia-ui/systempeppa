// Configuração compartilhada de permissões — sem "use server"

export type PermissionMap = Record<string, boolean>
export type AllPermissions = Record<string, PermissionMap>

export const ALL_FEATURES = [
    { key: "funcionarios",    label: "Funcionários" },
    { key: "unidades",        label: "Unidades" },
    { key: "nfs",             label: "Notas Fiscais" },
    { key: "folha_pagamento", label: "Folha de Pagamento" },
    { key: "comprovante",     label: "Comprovante" },
    { key: "whatsapp",        label: "WhatsApp Business" },
    { key: "relatorios",      label: "Relatórios" },
    { key: "bancos",          label: "Bancos" },
] as const

export const CONTROLLABLE_ROLES = ["RH", "GESTOR", "FUNCIONARIO"] as const

export const DEFAULT_PERMISSIONS: Record<string, PermissionMap> = {
    RH:          { funcionarios: true,  unidades: true,  nfs: true,  folha_pagamento: true,  comprovante: true, whatsapp: true,  relatorios: true,  bancos: true },
    GESTOR:      { funcionarios: false, unidades: true,  nfs: false, folha_pagamento: false, comprovante: true, whatsapp: true,  relatorios: true,  bancos: false },
    FUNCIONARIO: { funcionarios: false, unidades: false, nfs: false, folha_pagamento: false, comprovante: true, whatsapp: false, relatorios: false, bancos: false },
}
