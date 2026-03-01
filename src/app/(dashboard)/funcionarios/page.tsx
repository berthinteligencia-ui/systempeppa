import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { FuncionariosClient } from "./client"

export default async function FuncionariosPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const companyId = session.user.companyId

  const [{ data: rawEmployees }, { data: departments }] = await Promise.all([
    supabase.from("Employee").select("*, department:Department(*)").eq("companyId", companyId).order("name"),
    supabase.from("Department").select("*").eq("companyId", companyId).order("name"),
  ])

  const employees = (rawEmployees ?? []).map((e) => ({ ...e, salary: Number(e.salary) }))

  return (
    <div className="space-y-6">
      <FuncionariosClient employees={employees} departments={departments ?? []} />
    </div>
  )
}
