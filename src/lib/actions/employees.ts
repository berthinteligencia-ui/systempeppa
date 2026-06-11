"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

import { randomUUID } from "crypto"
import { toTitleCase } from "@/lib/utils/departments"

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
  birthDate?: string | null
  motherName?: string | null
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
    name: toTitleCase(data.name.trim()),
    cpf: cleanCpf,
    birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : null,
    motherName: data.motherName ? data.motherName.trim() : null,
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
    birthDate?: string | null
    motherName?: string | null
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
    name: toTitleCase(data.name.trim()),
    cpf: cleanCpf,
    birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : null,
    motherName: data.motherName ? data.motherName.trim() : null,
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

export async function deleteUnassignedEmployees() {
  await ensureAdmin()
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("Employee")
    .delete()
    .eq("companyId", companyId)
    .is("departmentId", null)
    .select("id")
  if (error) throw new Error(error.message)
  revalidatePath("/funcionarios")
  revalidatePath("/unidades")
  revalidatePath("/dashboard")
  return { deleted: (data ?? []).length }
}

export async function registerBatchFromPayroll(
  employees: { cpf: string; nome: string; valor: number; telefone?: string; cargo?: string; bankName?: string; bankAgency?: string; bankAccount?: string; pixKey?: string }[],
  departmentId: string
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  // De-duplicate by CPF to avoid conflict on the same upsert batch
  const uniqueByCpf = Array.from(
    employees.reduce((map, e) => {
      const key = e.cpf ? e.cpf.replace(/\D/g, "") : `__no_cpf_${Math.random()}`
      if (!map.has(key)) map.set(key, e)
      return map
    }, new Map<string, typeof employees[0]>()).values()
  )

  const records = uniqueByCpf.map((e) => ({
    id: randomUUID(),           // Required: PostgreSQL has no auto-default for cuid()
    name: toTitleCase(e.nome.trim()),
    cpf: e.cpf ? e.cpf.replace(/\D/g, "") : null,
    phone: e.telefone || null,
    position: (e.cargo || "A DEFINIR").trim().toUpperCase(),
    salary: e.valor,
    bankName: e.bankName?.trim().toUpperCase() || null,
    bankAgency: e.bankAgency?.trim() || null,
    bankAccount: e.bankAccount?.trim() || null,
    pixKey: e.pixKey?.trim().toUpperCase() || null,
    status: "ACTIVE",
    hireDate: now,
    companyId,
    departmentId,
    createdAt: now,
    updatedAt: now,
  }))

  const { error } = await supabase.from("Employee").upsert(records, {
    onConflict: "cpf",
    ignoreDuplicates: false,
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
  check(await supabase.from("Employee").update({ name: toTitleCase(name.trim()), updatedAt: new Date().toISOString() })
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

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function formatCpf(c: string | null | undefined) {
  if (!c || c.length !== 11) return c ?? "—"
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

function getDeptPathInList(deptId: string | null, depts: any[]): string {
  if (!deptId) return ""
  const dept = depts.find(d => d.id === deptId)
  if (!dept) return ""
  const parent = dept.parentId ? depts.find(d => d.id === dept.parentId) : null
  return [parent?.name, dept.name].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")
}

async function getOrCreateDepartmentPath(
  companyId: string,
  unidadeName?: string,
  departamentoName?: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const uName = unidadeName?.trim().toUpperCase()
  const dName = departamentoName?.trim()

  if (!uName && !dName) return null

  const insertDept = async (id: string, name: string, parentId: string | null) => {
    const base = {
      id,
      name,
      companyId,
      parentId,
      createdAt: now,
      updatedAt: now
    }
    const { error } = await supabase.from("Department").insert({ ...base, nivel: parentId ? "SUBUNIDADE" : "PRINCIPAL" })
    if (error) {
      if (error.message?.includes("nivel") || error.message?.includes("cache")) {
        const { error: fallbackErr } = await supabase.from("Department").insert(base)
        if (fallbackErr) throw new Error(fallbackErr.message)
      } else {
        throw new Error(error.message)
      }
    }
  }

  // Case 1: Only departamento is provided
  if (!uName && dName) {
    const cleanName = dName.toUpperCase()
    const { data: dept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .is("parentId", null)
      .ilike("name", cleanName)
      .maybeSingle()
    if (selErr) throw new Error(selErr.message)
    if (dept) return dept.id

    const newId = randomUUID()
    await insertDept(newId, cleanName, null)
    return newId
  }

  let parentId: string | null = null
  if (uName) {
    const { data: parentDept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .is("parentId", null)
      .ilike("name", uName)
      .maybeSingle()

    if (selErr) throw new Error(selErr.message)

    if (parentDept) {
      parentId = parentDept.id
    } else {
      const newParentId = randomUUID()
      await insertDept(newParentId, uName, null)
      parentId = newParentId
    }
  }

  if (dName && parentId) {
    const { data: subDept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .eq("parentId", parentId)
      .ilike("name", dName)
      .maybeSingle()

    if (selErr) throw new Error(selErr.message)

    if (subDept) {
      return subDept.id
    } else {
      const newSubId = randomUUID()
      await insertDept(newSubId, dName, parentId)
      return newSubId
    }
  }

  return parentId
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
    birthDate?: string | null
    motherName?: string | null
    unidade?: string
    departamento?: string
  }[]
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  // Fetch all departments once to use for in-memory resolution & comparison
  const { data: dbDepts, error: deptsError } = await supabase
    .from("Department")
    .select("*")
    .eq("companyId", companyId)
  if (deptsError) throw new Error(`Erro ao buscar departamentos: ${deptsError.message}`)
  const deptsList = dbDepts ?? []

  const withCpf = employees.filter((e) => e.cpf)
  const withoutCpf = employees.filter((e) => !e.cpf)

  let inserted = 0
  let updated = 0
  let skippedDuplicates = 0

  const resolvedDeptsCache = new Map<string, string>()
  const getOrCreateDeptWithCache = async (unidade?: string, departamento?: string) => {
    const key = [unidade, departamento].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")
    if (!key) return null
    if (resolvedDeptsCache.has(key)) {
      return resolvedDeptsCache.get(key)!
    }
    const deptId = await getOrCreateDepartmentPath(companyId, unidade, departamento)
    if (deptId) {
      resolvedDeptsCache.set(key, deptId)
    }
    return deptId
  }

  if (withCpf.length > 0) {
    // Dedup within the spreadsheet itself (last row wins when same CPF appears twice)
    const deduped = Array.from(
      withCpf.reduce((map, emp) => {
        map.set(emp.cpf!.replace(/\D/g, ""), emp)
        return map
      }, new Map<string, typeof withCpf[0]>()).values()
    )
    skippedDuplicates = withCpf.length - deduped.length

    const cleanCpfs = deduped.map((e) => e.cpf!.replace(/\D/g, ""))

    // Query CPFs globally (no companyId filter) because cpf has a GLOBAL @unique constraint.
    const existingRows: { cpf: string; companyId: string; departmentId: string | null }[] = []
    for (const chunk of chunkArr(cleanCpfs, 100)) {
      const { data, error } = await supabase
        .from("Employee")
        .select("cpf, companyId, departmentId")
        .in("cpf", chunk)
      if (error) throw new Error(`Erro ao verificar CPFs existentes: ${error.message}`)
      existingRows.push(...(data ?? []))
    }

    // Resolve departments and check for divergence
    for (const e of deduped) {
      const cleanCpf = e.cpf!.replace(/\D/g, "")
      const existingEmp = existingRows.find(r => r.cpf === cleanCpf)

      if (existingEmp && existingEmp.companyId === companyId) {
        const sheetPath = e.departmentId
          ? getDeptPathInList(e.departmentId, deptsList)
          : [e.unidade, e.departamento].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")

        const dbPath = getDeptPathInList(existingEmp.departmentId, deptsList)

        if (existingEmp.departmentId !== null && sheetPath && dbPath !== sheetPath) {
          e.departmentId = e.departmentId || await getOrCreateDeptWithCache(e.unidade, e.departamento) || undefined
        } else if (existingEmp.departmentId === null && sheetPath) {
          e.departmentId = e.departmentId || await getOrCreateDeptWithCache(e.unidade, e.departamento) || undefined
        } else if (existingEmp.departmentId !== null) {
          e.departmentId = existingEmp.departmentId
        }
      } else if (!existingEmp) {
        const sheetPath = e.departmentId
          ? getDeptPathInList(e.departmentId, deptsList)
          : [e.unidade, e.departamento].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")
        if (sheetPath) {
          e.departmentId = await getOrCreateDeptWithCache(e.unidade, e.departamento) || undefined
        }
      }
    }

    // CPFs owned by THIS company → update them
    const sameCompanyCpfs = new Set(
      existingRows.filter((e) => e.companyId === companyId).map((e) => e.cpf as string)
    )
    // CPFs owned by ANOTHER company → skip entirely (inserting would violate global unique)
    const otherCompanyCpfs = new Set(
      existingRows.filter((e) => e.companyId !== companyId).map((e) => e.cpf as string)
    )

    const toInsert = deduped.filter((e) => !sameCompanyCpfs.has(e.cpf!.replace(/\D/g, "")) && !otherCompanyCpfs.has(e.cpf!.replace(/\D/g, "")))
    const toUpdate = deduped.filter((e) => sameCompanyCpfs.has(e.cpf!.replace(/\D/g, "")))
    skippedDuplicates += otherCompanyCpfs.size > 0 ? [...otherCompanyCpfs].filter(c => deduped.some(e => e.cpf!.replace(/\D/g, "") === c)).length : 0

    // Insert in chunks of 100 to avoid large payload failures
    for (const chunk of chunkArr(toInsert, 100)) {
      check(await supabase.from("Employee").insert(
        chunk.map((e) => ({
          id: randomUUID(),
          name: toTitleCase(e.name.trim()),
          cpf: e.cpf!.replace(/\D/g, ""),
          phone: e.phone || null,
          email: e.email || null,
          position: e.position || "A definir",
          salary: e.salary ?? 0,
          hireDate: now,
          birthDate: e.birthDate ? new Date(e.birthDate).toISOString() : null,
          motherName: e.motherName ? e.motherName.trim() : null,
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
      inserted += chunk.length
    }

    // Update existing employees in chunks of 50
    for (const chunk of chunkArr(toUpdate, 50)) {
      await Promise.all(
        chunk.map((e) =>
          supabase
             .from("Employee")
             .update({
               name: toTitleCase(e.name.trim()),
               phone: e.phone || null,
               email: e.email || null,
               position: e.position || "A definir",
               salary: e.salary ?? 0,
               birthDate: e.birthDate ? new Date(e.birthDate).toISOString() : null,
               motherName: e.motherName ? e.motherName.trim() : null,
               departmentId: e.departmentId || null,
               bankName: e.bankName || null,
               bankAgency: e.bankAgency || null,
               bankAccount: e.bankAccount || null,
               pixKey: e.pixKey || null,
               status: "ACTIVE",
               updatedAt: now,
             })
             .eq("cpf", e.cpf!.replace(/\D/g, ""))
             .eq("companyId", companyId)
        )
      )
      updated += chunk.length
    }
  }

  // Resolve departments for employees without CPF
  for (const e of withoutCpf) {
    const sheetPath = e.departmentId
      ? getDeptPathInList(e.departmentId, deptsList)
      : [e.unidade, e.departamento].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")
    if (!e.departmentId && sheetPath) {
      e.departmentId = await getOrCreateDeptWithCache(e.unidade, e.departamento) || undefined
    }
  }

  // Insert employees without CPF in chunks of 100
  for (const chunk of chunkArr(withoutCpf, 100)) {
    check(await supabase.from("Employee").insert(
      chunk.map((e) => ({
        id: randomUUID(),
        name: toTitleCase(e.name.trim()),
        cpf: null,
        phone: e.phone || null,
        email: e.email || null,
        position: e.position || "A definir",
        salary: e.salary ?? 0,
        hireDate: now,
        birthDate: e.birthDate ? new Date(e.birthDate).toISOString() : null,
        motherName: e.motherName ? e.motherName.trim() : null,
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
    inserted += chunk.length
  }

  revalidatePath("/funcionarios")
  return { inserted, updated, skippedDuplicates }
}

export async function deleteEmployeesByCpfs(cpfs: string[]) {
  await ensureAdmin()
  const supabase = getSupabaseAdmin()
  let deleted = 0
  for (const chunk of chunkArr(cpfs, 100)) {
    const { data, error } = await supabase
      .from("Employee")
      .delete()
      .in("cpf", chunk)
      .select("id")
    if (error) throw new Error(error.message)
    deleted += (data ?? []).length
  }
  revalidatePath("/funcionarios")
  return { deleted }
}

export async function validateImportCpfs(
  cpfs: string[]
): Promise<{ cpf: string; status: "exists_same" | "exists_other"; departmentId?: string | null }[]> {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const results: { cpf: string; status: "exists_same" | "exists_other"; departmentId?: string | null }[] = []
  for (const chunk of chunkArr(cpfs, 100)) {
    const { data, error } = await supabase
      .from("Employee")
      .select("cpf, companyId, departmentId")
      .in("cpf", chunk)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      results.push({
        cpf: row.cpf as string,
        status: (row.companyId as string) === companyId ? "exists_same" : "exists_other",
        departmentId: (row.companyId as string) === companyId ? (row.departmentId as string | null) : undefined,
      })
    }
  }
  return results
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

export async function reactivateAllEmployees() {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  check(await supabase.from("Employee")
    .update({ status: "ACTIVE", updatedAt: now })
    .eq("companyId", companyId)
    .eq("status", "INACTIVE")
  )

  revalidatePath("/funcionarios")
  return { success: true }
}

export async function checkAndRunMonthlyReset() {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Only run on the 20th of the month
  if (now.getDate() !== 20) return

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
