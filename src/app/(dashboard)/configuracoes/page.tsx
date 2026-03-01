import { getCompanySettings } from "@/lib/actions/settings"
import { SettingsClient } from "./client"

export default async function SettingsPage() {
    const company = await getCompanySettings()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Configurações do Sistema</h2>
                <p className="text-sm text-slate-500">Gerencie os dados da sua empresa e preferências do sistema</p>
            </div>

            <SettingsClient initialData={company} />
        </div>
    )
}
