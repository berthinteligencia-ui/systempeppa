import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UnidadesClient } from "./client"

export default async function UnidadesPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const companyId = session.user.companyId

  const [{ data: depts }, { data: empList }] = await Promise.all([
    supabase.from("Department").select("*").eq("companyId", companyId).order("name"),
    supabase.from("Employee").select("departmentId").eq("companyId", companyId),
  ])

  const departments = (depts ?? []).map(d => ({
    ...d,
    _count: { employees: (empList ?? []).filter(e => e.departmentId === d.id).length }
  }))

  return (
    <div className="space-y-6">
      <UnidadesClient
        departments={departments}
        userRole={session.user.role}
      />
    </div>
  )
}
