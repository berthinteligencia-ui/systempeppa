import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { FolhaPagamentoClient } from "./client"

export default async function FolhaPagamentoPage() {
    const session = await auth()
    if (!session?.user?.companyId) redirect("/login")

    const supabase = getSupabaseAdmin()
    const { data: departments } = await supabase
        .from("Department")
        .select("*")
        .eq("companyId", session.user.companyId)
        .order("name")

    return (
        <div className="space-y-6">
            <FolhaPagamentoClient departments={departments ?? []} />
        </div>
    )
}
