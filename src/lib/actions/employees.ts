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

  const cleanCpf = data.cpf ? data.cpf.replace(/\D/g, "") : null
  check(await supabase.from("Employee").insert({
    id: randomUUID(),
    ...data,
    cpf: cleanCpf,
    pagamento: (data.pagamento || "pendente").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
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
  const cleanCpf = data.cpf ? data.cpf.replace(/\D/g, "") : null
  const updatedRows = check(await supabase.from("Employee").update({
    ...data,
    cpf: cleanCpf,
    pagamento: data.pagamento ? data.pagamento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : undefined,
    hireDate: data.hireDate ? new Date(data.hireDate).toISOString() : undefined,
    departmentId: data.departmentId || null,
    updatedAt: new Date().toISOString(),
  }).eq("id", id).eq("companyId", companyId).select())

  if (!updatedRows || updatedRows.length === 0) {
    // Debugging: Check if the employee exists but has a different companyId
    const { data: checkEmp } = await supabase.from("Employee").select("id, companyId, name").eq("id", id).maybeSingle()
    if (!checkEmp) {
      throw new Error(`Funcionário ID ${id} não encontrado no banco de dados.`)
    }
    if (checkEmp.companyId !== companyId) {
      throw new Error(`O funcionário ${checkEmp.name} (ID ${id}) pertence à empresa ${checkEmp.companyId}, mas você está tentando atualizá-lo como empresa ${companyId}.`)
    }
    throw new Error(`Nenhum registro encontrado para atualizar (ID: ${id}, CompanyID: ${companyId})`)
  }

  // Log activity
  const session = await auth()
  if (session?.user) {
    const { logActivity } = await import("@/lib/logActivity")
    await logActivity({
      userId: session.user.id,
      userName: session.user.name ?? "",
      userEmail: session.user.email ?? "",
      companyId,
      action: "UPDATE_EMPLOYEE",
      target: data.name,
      details: { status: data.status, pagamento: data.pagamento }
    })
  }

  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
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

  // We use upsert with onConflict 'cpf' to update existing records
  // We omit the 'id' if we want the DB to generate it or find it via 'cpf'
  // However, Supabase's upsert with onConflict works best when we don't provide a random ID that would conflict
  
  const records = employees.map((e) => ({
    name: e.nome.trim().toUpperCase(),
    cpf: e.cpf ? e.cpf.replace(/\D/g, "") : null,
    phone: e.telefone || null,
    position: (e.cargo || "A DEFINIR").trim().toUpperCase(),
    salary: e.valor,
    bankName: e.bankName?.trim().toUpperCase() || null,
    bankAgency: e.bankAgency?.trim() || null,
    bankAccount: e.bankAccount?.trim() || null,
    pixKey: e.pixKey?.trim().toUpperCase() || null,
    status: "ACTIVE", 
    companyId,
    departmentId,
    updatedAt: now,
  }))

  const { error } = await supabase.from("Employee").upsert(records, {
    onConflict: "cpf",
    ignoreDuplicates: false, // We want to UPDATE if it exists
  })

  if (error) {
    console.error("[registerBatchFromPayroll] error:", error)
    throw new Error("Falha ao registrar lote: " + error.message)
  }

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
        cpf: e.cpf ? e.cpf.replace(/\D/g, "") : null,
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
  
  // Buscar todos os funcionários da empresa para permitir o "match" mesmo se estiverem formatados no banco
  const { data } = await supabase
    .from("Employee")
    .select("id, name, cpf, phone, position, bankName, bankAgency, bankAccount, pixKey")
    .eq("companyId", companyId)

  if (!data) return null

  // Retorna o primeiro que coincidir com os dígitos do CPF
  return data.find(e => (e.cpf?.replace(/\D/g, "") === cleanCpf)) || null
}

export async function resetDepartmentPaymentStatus(departmentId: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  check(await supabase.from("Employee")
    .update({ pagamento: "pendente", updatedAt: now })
    .eq("companyId", companyId)
    .eq("departmentId", departmentId)
  )
  revalidatePath("/funcionarios")
  return { success: true }
}

export async function resetMonthlyStatus() {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  
  check(await supabase.from("Employee")
    .update({ 
      status: "INACTIVE",
      updatedAt: now 
    })
    .eq("companyId", companyId)
  )
  
  return { success: true }
}

export async function checkAndRunMonthlyReset() {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Only run on the 1st of the month
  if (now.getDate() !== 1) return

  const { data: settings } = await supabase
    .from("Settings")
    .select("lastResetMonth, lastResetYear")
    .eq("companyId", companyId)
    .maybeSingle()

  if (settings?.lastResetMonth === currentMonth && settings?.lastResetYear === currentYear) {
    return // Already run this month
  }

  // Run inactivation
  await resetMonthlyStatus()

  // Update settings
  await supabase
    .from("Settings")
    .upsert({
      companyId,
      lastResetMonth: currentMonth,
      lastResetYear: currentYear,
      updatedAt: now.toISOString()
    }, { onConflict: "companyId" })

  revalidatePath("/funcionarios")
}

export async function updateEmployeeStatus(id: string, status: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  
  const { data: updatedRows, error } = await supabase
    .from("Employee")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .eq("companyId", companyId)
    .select()

  if (error) throw new Error(error.message)
  
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("Não foi possível atualizar o status.")
  }

  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
  return { success: true }
}

export async function updateEmployeePaymentStatus(id: string, pagamento: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const normalized = pagamento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  
  const { data: updatedRows, error } = await supabase
    .from("Employee")
    .update({ pagamento: normalized, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .eq("companyId", companyId)
    .select()

  if (error) throw new Error(error.message)
  
  if (!updatedRows || updatedRows.length === 0) {
    // Debug info for the user
    const { data: checkEmp } = await supabase.from("Employee").select("id, companyId").eq("id", id).maybeSingle()
    if (!checkEmp) throw new Error("Funcionário não encontrado.")
    if (checkEmp.companyId !== companyId) throw new Error("Este funcionário pertence a outra empresa.")
    throw new Error("Não foi possível atualizar o registro.")
  }

  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
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

  const results = await Promise.all(
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

  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    console.error("[updateEmployeesBankBatch] errors:", errors.map(r => r.error))
    throw new Error(`Falha ao atualizar ${errors.length} funcionário(s): ${errors[0].error?.message}`)
  }

  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
  return { success: true, updated: ids.length }
}
