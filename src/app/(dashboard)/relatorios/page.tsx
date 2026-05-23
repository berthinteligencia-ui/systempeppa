import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getSupabaseAdmin, fetchFullList } from "@/lib/supabase-admin"
import { RelatoriosClient } from "./client"

export const dynamic = "force-dynamic"

export default async function RelatoriosPage() {
    const session = await auth()
    if (!session?.user?.companyId) redirect("/login")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const [rawAnalyses, rawDepartments, rawEmployees] = await Promise.all([
        supabase
            .from("PayrollAnalysis")
            .select("*, department:Department(name)")
            .eq("companyId", companyId)
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .then(r => r.data ?? []),

        supabase
            .from("Department")
            .select("id, name, parentId")
            .eq("companyId", companyId)
            .order("name")
            .then(r => r.data ?? []),

        fetchFullList<any>((from, to) =>
            supabase
                .from("Employee")
                .select("id, departmentId, pagamento, bankName, status, salary")
                .eq("companyId", companyId)
                .range(from, to)
        ),
    ])

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Relatórios Gerenciais</h1>
                <p className="text-slate-500">Visão consolidada de custos, funcionários e indicadores financeiros.</p>
            </div>

            <RelatoriosClient
                analyses={rawAnalyses}
                departments={rawDepartments}
                employees={rawEmployees ?? []}
            />
        </div>
    )
}
