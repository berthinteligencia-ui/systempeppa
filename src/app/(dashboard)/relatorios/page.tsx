import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { RelatoriosClient } from "./client"

export default async function RelatoriosPage() {
    const session = await auth()
    if (!session?.user?.companyId) redirect("/login")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    // Fetch all analyses with department name
    const { data: analyses } = await supabase
        .from("PayrollAnalysis")
        .select("*, department:Department(name)")
        .eq("companyId", companyId)
        .order("year", { ascending: false })
        .order("month", { ascending: false })

    const { data: departments } = await supabase
        .from("Department")
        .select("id, name")
        .eq("companyId", companyId)

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Relatórios Gerenciais</h1>
                <p className="text-slate-500">Visão consolidada de custos e indicadores financeiros da folha de pagamento.</p>
            </div>

            <RelatoriosClient
                analyses={analyses ?? []}
                departments={departments ?? []}
            />
        </div>
    )
}
