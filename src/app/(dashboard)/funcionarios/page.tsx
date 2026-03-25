import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { FuncionariosClient } from "./client"

export default async function FuncionariosPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const companyId = session.user.companyId

  const [{ data: rawEmployees }, { data: departments }, { data: allComprovantes }] = await Promise.all([
    supabase.from("Employee").select("*, department:Department(*)").eq("companyId", companyId).order("name"),
    supabase.from("Department").select("*").eq("companyId", companyId).order("name"),
    supabase.from("Comprovante").select("cpf, fileUrl, extractedAt").eq("companyId", companyId).order("extractedAt", { ascending: false })
  ])

  // Map CPF to latest fileUrl
  const lastComprovanteMap: Record<string, string> = {}
  if (allComprovantes) {
    for (const c of allComprovantes) {
      if (!lastComprovanteMap[c.cpf]) {
        lastComprovanteMap[c.cpf] = c.fileUrl
      }
    }
  }

  const employees = (rawEmployees ?? []).map((e) => ({ 
    ...e, 
    salary: Number(e.salary),
    lastReceiptUrl: lastComprovanteMap[e.cpf.replace(/\D/g, "")] || null
  }))

  return (
    <div className="space-y-6">
      <FuncionariosClient
        employees={employees}
        departments={departments ?? []}
        userRole={session.user.role}
      />
    </div>
  )
}
