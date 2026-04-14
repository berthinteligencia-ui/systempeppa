import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { listPayrollAnalyses } from "@/lib/actions/payroll"
import { ComprovanteClient } from "./client"

export default async function ComprovantePage() {
    const session = await auth()
    if (!session?.user?.companyId) redirect("/login")

    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const [{ data: depts }, fechamentos, { data: banks }] = await Promise.all([
        supabase.from("Department").select("id, name").eq("companyId", companyId).order("name"),
        listPayrollAnalyses(),
        supabase.from("Bank").select("id, name, code").eq("active", true).order("name")
    ])

    return (
        <ComprovanteClient 
            departments={depts ?? []} 
            fechamentos={fechamentos} 
            banks={banks ?? []}
            companyId={companyId}
            userRole={session.user.role}
        />
    )
}
