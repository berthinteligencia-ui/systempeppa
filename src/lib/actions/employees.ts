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
  employees: { cpf: string; nome: string; valor: number; telefone?: string }[],
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
      phone: e.telefone || null,
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

export async function updateEmployeesPhone(updates: { id: string; phone: string }[]) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  await Promise.all(
    updates.map((u) =>
      supabase.from("Employee").update({ phone: u.phone, updatedAt: new Date().toISOString() })
        .eq("id", u.id).eq("companyId", companyId)
    )
  )
  revalidatePath("/funcionarios")
}

export async function importEmployees(
  employees: {
    name: string
    cpf?: string
    phone?: string
    email?: string
    position?: string
    salary?: number
    departmentId?: string
  }[]
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const withCpf = employees.filter((e) => e.cpf)
  const withoutCpf = employees.filter((e) => !e.cpf)

  if (withCpf.length > 0) {
    check(await supabase.from("Employee").upsert(
      withCpf.map((e) => ({
        id: randomUUID(),
        name: e.name,
        cpf: e.cpf,
        phone: e.phone || null,
        email: e.email || null,
        position: e.position || "A definir",
        salary: e.salary ?? 0,
        hireDate: now,
        companyId,
        departmentId: e.departmentId || null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })),
      { onConflict: "cpf", ignoreDuplicates: false }
    ))
  }

  if (withoutCpf.length > 0) {
    check(await supabase.from("Employee").insert(
      withoutCpf.map((e) => ({
        id: randomUUID(),
        name: e.name,
        cpf: null,
        phone: e.phone || null,
        email: e.email || null,
        position: e.position || "A definir",
        salary: e.salary ?? 0,
        hireDate: now,
        companyId,
        departmentId: e.departmentId || null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      }))
    ))
  }

  revalidatePath("/funcionarios")
  return { imported: employees.length }
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
    .select("id, name, cpf, phone")
    .eq("cpf", cleanCpf)
    .eq("companyId", companyId)
    .maybeSingle()
  return data
}
