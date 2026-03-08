import { getCompanySettings } from "@/lib/actions/settings"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { getRolePermissions } from "@/lib/actions/permissions"
import { SettingsClient } from "./client"

export default async function SettingsPage() {
    const session = await auth()
    const company = await getCompanySettings()

    let users: any[] = []
    let initialPermissions = {}
    if (session?.user?.role === "ADMIN" && session?.user?.companyId) {
        const supabase = getSupabaseAdmin()
        const [{ data }, perms] = await Promise.all([
            supabase.from("User").select("id, name, email, role, active").eq("companyId", session.user.companyId).order("name"),
            getRolePermissions(session.user.companyId),
        ])
        users = data ?? []
        initialPermissions = perms
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Configurações do Sistema</h2>
                <p className="text-sm text-slate-500">Gerencie os dados da sua empresa e preferências do sistema</p>
            </div>

            <SettingsClient
                initialData={company}
                initialUsers={users}
                currentUserId={session?.user?.id ?? ""}
                initialPermissions={initialPermissions}
            />
        </div>
    )
}
