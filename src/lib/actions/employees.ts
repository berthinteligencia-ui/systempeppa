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

async function ensureAdmin() {
  const session = await auth()
  const role = session?.user?.role?.toUpperCase()
  if (role !== "ADMIN") {
    throw new Error("Ação permitida apenas para administradores")
  }
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
  pagamento?: string
  bankName?: string
  bankAgency?: string
  bankAccount?: string
  pixKey?: string
}) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  check(await supabase.from("Employee").insert({
    id: randomUUID(),
    ...data,
    pagamento: data.pagamento || "pendente",
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
    pagamento?: string
    bankName?: string
    bankAgency?: string
    bankAccount?: string
    pixKey?: string
  }
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").update({
    ...data,
    pagamento: data.pagamento,
    hireDate: new Date(data.hireDate).toISOString(),
    departmentId: data.departmentId || null,
    updatedAt: new Date().toISOString(),
  }).eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function deleteEmployee(id: string) {
  await ensureAdmin()
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").delete().eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function registerBatchFromPayroll(
  employees: { cpf: string; nome: string; valor: number; telefone?: string; cargo?: string; bankName?: string; bankAgency?: string; bankAccount?: string; pixKey?: string }[],
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
      position: e.cargo || "A definir",
      salary: e.valor,
      bankName: e.bankName || null,
      bankAgency: e.bankAgency || null,
      bankAccount: e.bankAccount || null,
      pixKey: e.pixKey || null,
      status: "ACTIVE", // Re-activate if already exists
      hireDate: now,
      companyId,
      departmentId,
      createdAt: now,
      updatedAt: now,
    })),
    { onConflict: "cpf", ignoreDuplicates: false }
  ))
  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
}

export async function updateEmployeeName(id: string, name: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").update({ name, updatedAt: new Date().toISOString() })
    .eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
}

export async function updateEmployeeSalary(id: string, salary: number) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Employee").update({ salary, updatedAt: new Date().toISOString() })
    .eq("id", id).eq("companyId", companyId))
  revalidatePath("/funcionarios")
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
    bankName?: string
    bankAgency?: string
    bankAccount?: string
    pixKey?: string
  }[]
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const withCpf = employees.filter((e) => e.cpf)
  const withoutCpf = employees.filter((e) => !e.cpf)

  if (withCpf.length > 0) {
    // De-duplicate by CPF to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueByCpf = Array.from(
      withCpf.reduce((map, emp) => {
        map.set(emp.cpf!, emp)
        return map
      }, new Map<string, typeof withCpf[0]>()).values()
    )

    check(await supabase.from("Employee").upsert(
      uniqueByCpf.map((e) => ({
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
        bankName: e.bankName || null,
        bankAgency: e.bankAgency || null,
        bankAccount: e.bankAccount || null,
        pixKey: e.pixKey || null,
        status: "ACTIVE", // Re-activate or set as active
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
        bankName: e.bankName || null,
        bankAgency: e.bankAgency || null,
        bankAccount: e.bankAccount || null,
        pixKey: e.pixKey || null,
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
  await ensureAdmin()
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
    .select("id, name, cpf, phone, position, bankName, bankAgency, bankAccount, pixKey")
    .eq("cpf", cleanCpf)
    .eq("companyId", companyId)
    .maybeSingle()
  return data
}

export async function resetMonthlyStatus() {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  
  check(await supabase.from("Employee")
    .update({ 
      status: "INACTIVE", 
      pagamento: "pendente",
      updatedAt: now 
    })
    .eq("companyId", companyId)
  )
  
  return { success: true }
}

export async function updateEmployeesBankBatch(
  ids: string[],
  data: {
    bankName: string
    bankAgency?: string
    bankAccount?: string
    pixKey?: string
  }
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const isMentoreOrPix = data.bankName === "MENTORE" || data.bankName === "PIX";
  const agency = isMentoreOrPix ? null : (data.bankAgency || null);
  const account = isMentoreOrPix ? null : (data.bankAccount || null);

  await Promise.all(
    ids.map((id) =>
      supabase
        .from("Employee")
        .update({
          bankName: data.bankName,
          bankAgency: agency,
          bankAccount: account,
          pixKey: data.pixKey || null,
          updatedAt: now,
        })
        .eq("id", id)
        .eq("companyId", companyId)
    )
  )

  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
  return { success: true }
}
