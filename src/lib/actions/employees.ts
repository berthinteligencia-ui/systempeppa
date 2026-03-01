"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

import { randomUUID } from "crypto"

async function getCompanyId() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autenticado")
  return session.user.companyId
}

export async function createEmployee(data: {
  name: string
  position: string
  salary: number
  hireDate: string
  departmentId?: string
  cpf?: string
  email?: string
  phone?: string
}) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  check(await supabase.from("Employee").insert({
    id: randomUUID(),
    ...data,
    hireDate: new Date(data.hireDate).toISOString(),
    departmentId: data.departmentId || null,
    companyId,
    createdAt: now,
    updatedAt: now,
  }))
  revalidatePath("/funcionarios")
}

export async function updateEmployee(
  id: string,
  data: {
    name: string
    position: string
    salary: number
    hireDate: string
    departmentId?: string
    cpf?: string
    email?: string
    phone?: string
    status: string
  }
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").update({
    ...data,
    hireDate: new Date(data.hireDate).toISOString(),
    departmentId: data.departmentId || null,
    updatedAt: new Date().toISOString(),
  }).eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function deleteEmployee(id: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").delete().eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function registerBatchFromPayroll(
  employees: { cpf: string; nome: string; valor: number }[],
  departmentId: string
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  check(await supabase.from("Employee").upsert(
    employees.map((e) => ({
      id: randomUUID(),
      name: e.nome,
      cpf: e.cpf,
      position: "A definir",
      salary: e.valor,
      hireDate: now,
      companyId,
      departmentId,
      createdAt: now,
      updatedAt: now,
    })),
    { onConflict: "cpf", ignoreDuplicates: true }
  ))
  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
}

export async function deleteEmployeesBatch(ids: string[]) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").delete().in("id", ids).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function getEmployeeByCpf(cpf: string) {
  const companyId = await getCompanyId()
  const cleanCpf = cpf.replace(/\D/g, "")
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from("Employee")
    .select("id, name, cpf")
    .eq("cpf", cleanCpf)
    .eq("companyId", companyId)
    .maybeSingle()
  return data
}
