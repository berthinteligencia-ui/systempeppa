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

    const [{ data: depts }, fechamentos, { data: comprovantes }] = await Promise.all([
        supabase.from("Department").select("id, name").eq("companyId", companyId).order("name"),
        listPayrollAnalyses(),
        supabase.from("Comprovante").select("*, employee:Employee(name, departmentId)").eq("companyId", companyId).order("extractedAt", { ascending: false })
    ])

    return (
        <ComprovanteClient 
            departments={depts ?? []} 
            fechamentos={fechamentos} 
            comprovantes={comprovantes ?? []}
            companyId={companyId}
            userRole={session.user.role}
        />
    )
}
