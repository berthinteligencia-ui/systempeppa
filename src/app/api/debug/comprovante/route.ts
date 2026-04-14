import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/debug/comprovante?employeeId=xxx
 * Retorna todos os comprovantes do funcionário + diagnóstico completo.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const employeeId = req.nextUrl.searchParams.get("employeeId")
    const cpf        = req.nextUrl.searchParams.get("cpf") ?? ""

    // 1. Total de comprovantes da empresa
    const { count: total } = await supabase
      .from("Comprovante")
      .select("id", { count: "exact", head: true })
      .eq("companyId", companyId)

    // 2. Busca por employeeId (se fornecido)
    let byEmployeeId: any[] = []
    if (employeeId) {
      const { data, error } = await supabase
        .from("Comprovante")
        .select("*")
        .eq("companyId", companyId)
        .eq("employeeId", employeeId)
        .order("extractedAt", { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      byEmployeeId = data ?? []
    }

    // 3. Busca por CPF (se fornecido)
    let byCpf: any[] = []
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "")
      const { data, error } = await supabase
        .from("Comprovante")
        .select("*")
        .eq("companyId", companyId)
        .eq("cpf", cleanCpf)
        .order("extractedAt", { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      byCpf = data ?? []
    }

    // 4. Últimos 5 comprovantes da empresa (qualquer funcionário)
    const { data: latest } = await supabase
      .from("Comprovante")
      .select("id, employeeId, cpf, fileName, situacao, fileUrl, extractedAt")
      .eq("companyId", companyId)
      .order("extractedAt", { ascending: false })
      .limit(5)

    return NextResponse.json({
      companyId,
      totalNaEmpresa: total,
      byEmployeeId,
      byCpf,
      ultimosCinco: latest ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
