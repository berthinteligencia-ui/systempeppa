import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { FuncionariosClient } from "./client"
import { checkAndRunMonthlyReset } from "@/lib/actions/employees"

export default async function FuncionariosPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  // Check for monthly reset logic (runs only on 1st of month)
  await checkAndRunMonthlyReset()

  const supabase = getSupabaseAdmin()
  const companyId = session.user.companyId

  const [{ data: rawEmployees }, { data: departments }, { data: allComprovantes }] = await Promise.all([
    supabase.from("Employee").select("*, department:Department(*)").eq("companyId", companyId).order("name"),
    supabase.from("Department").select("*").eq("companyId", companyId).order("name"),
    supabase.from("Comprovante").select("cpf, employeeId, fileUrl, extractedAt, amount").eq("companyId", companyId).order("extractedAt", { ascending: false })
  ])

  // Map CPF to latest fileUrl and amount
  const lastComprovanteMap: Record<string, { url: string, amount: number | null }> = {}
  if (allComprovantes) {
    for (const c of allComprovantes) {
      // Prioridade 1: Vínculo por ID
      if (c.employeeId && !lastComprovanteMap[c.employeeId]) {
        lastComprovanteMap[c.employeeId] = { url: c.fileUrl, amount: c.amount ? Number(c.amount) : null }
      }
      // Prioridade 2: Vínculo por CPF limpo (fallback para registros sem employeeId)
      const cleanC = c.cpf ? c.cpf.replace(/\D/g, "") : ""
      if (cleanC && !lastComprovanteMap[cleanC]) {
        lastComprovanteMap[cleanC] = { url: c.fileUrl, amount: c.amount ? Number(c.amount) : null }
      }
    }
  }

  const employees = (rawEmployees ?? []).map((e) => {
    const cleanE = e.cpf ? e.cpf.replace(/\D/g, "") : ""
    const receipt = lastComprovanteMap[e.id] || (cleanE ? lastComprovanteMap[cleanE] : null)

    return { 
      ...e, 
      salary: Number(e.salary),
      lastReceiptUrl: receipt?.url || null,
      lastReceiptAmount: receipt?.amount || null
    }
  })

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
