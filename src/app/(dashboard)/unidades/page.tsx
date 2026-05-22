import { getSupabaseAdmin, fetchFullList } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UnidadesClient } from "./client"

export default async function UnidadesPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const companyId = session.user.companyId

  const [{ data: depts }, empList] = await Promise.all([
    supabase.from("Department").select("*").eq("companyId", companyId).order("name"),
    fetchFullList<any>((from, to) =>
      supabase
        .from("Employee")
        .select("departmentId")
        .eq("companyId", companyId)
        .eq("status", "ACTIVE")
        .range(from, to)
    ),
  ])

  const allEmps = empList ?? []
  const unassignedCount = allEmps.filter(e => !e.departmentId).length

  const direct = (depts ?? []).map(d => ({
    ...d,
    _count: { employees: allEmps.filter(e => e.departmentId === d.id).length }
  }))

  // Soma recursiva de descendentes para que o pai exiba o total consolidado
  function countDescendants(deptId: string): number {
    return direct
      .filter(d => d.parentId === deptId)
      .reduce((sum, child) => sum + child._count.employees + countDescendants(child.id), 0)
  }

  const departments = direct.map(d => ({
    ...d,
    _count: {
      // Departamentos raiz (sem pai) absorvem os funcionários sem unidade para bater com o dashboard
      employees: d._count.employees + countDescendants(d.id) + (!d.parentId ? unassignedCount : 0)
    }
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
