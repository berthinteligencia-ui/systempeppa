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
  if (role !== "ADMIN") throw new Error("Ação permitida apenas para administradores")
}

export type DeptRow = {
  id: string
  name: string
  cnpj?: string | null
  nivel?: string | null
  active: boolean
  parentId?: string | null
  _count: { employees: number }
  children?: DeptRow[]
}

export async function createDepartment(data: { name: string; cnpj?: string; parentId?: string | null; nivel?: string }) {
  const nivel = data.nivel || "SUBUNIDADE"
  if (nivel === "PRINCIPAL" && data.parentId) {
    throw new Error("Unidades Principais não podem ter uma unidade pai.")
  }

  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const base = { id: randomUUID(), name: data.name, cnpj: data.cnpj || null, nivel, companyId, createdAt: now, updatedAt: now }
  const parentId = nivel === "PRINCIPAL" ? null : (data.parentId || null)
  const { error } = await supabase.from("Department").insert({ ...base, parentId })
  if (error) {
    if (error.message?.includes("parentId")) {
      check(await supabase.from("Department").insert(base))
    } else if (error.message?.includes("nivel")) {
      const { nivel: _, ...baseNoNivel } = base
      check(await supabase.from("Department").insert({ ...baseNoNivel, parentId }))
    } else {
      throw new Error(error.message)
    }
  }
  revalidatePath("/unidades")
  return { id: base.id }
}

export async function updateDepartment(id: string, data: { name: string; cnpj?: string; parentId?: string | null; nivel?: string }) {
  const nivel = data.nivel || "SUBUNIDADE"
  if (nivel === "PRINCIPAL" && data.parentId) {
    throw new Error("Unidades Principais não podem ter uma unidade pai.")
  }

  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()

  const parentId = nivel === "PRINCIPAL" ? null : (data.parentId ?? null)
  if (parentId) {
    if (parentId === id) throw new Error("Uma unidade não pode ser pai de si mesma.")
    const descendants = await getDescendantIds(id, companyId)
    if (descendants.includes(parentId)) throw new Error("Não é possível mover uma unidade para dentro de um de seus sub-grupos.")
  }

  const base = { name: data.name, cnpj: data.cnpj || null, nivel, updatedAt: new Date().toISOString() }
  const { error } = await supabase.from("Department").update({ ...base, parentId }).eq("id", id).eq("companyId", companyId)
  if (error) {
    if (error.message?.includes("parentId")) {
      check(await supabase.from("Department").update(base).eq("id", id).eq("companyId", companyId))
    } else if (error.message?.includes("nivel")) {
      const { nivel: _, ...baseNoNivel } = base
      check(await supabase.from("Department").update({ ...baseNoNivel, parentId }).eq("id", id).eq("companyId", companyId))
    } else {
      throw new Error(error.message)
    }
  }
  revalidatePath("/unidades")
}

export async function deleteDepartment(id: string) {
  await ensureAdmin()
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()

  const descendants = await getDescendantIds(id, companyId)
  const allDeptIds = [id, ...descendants]

  // Delete all Employees in these departments
  check(await supabase.from("Employee")
    .delete()
    .in("departmentId", allDeptIds)
    .eq("companyId", companyId))

  // Delete all PayrollAnalysis (closures) in these departments
  check(await supabase.from("PayrollAnalysis")
    .delete()
    .in("departmentId", allDeptIds)
    .eq("companyId", companyId))

  // Break parentId references among departments we are deleting to avoid foreign key issues
  await supabase.from("Department")
    .update({ parentId: null, updatedAt: new Date().toISOString() })
    .in("id", allDeptIds)
    .eq("companyId", companyId)

  // Delete all these departments
  check(await supabase.from("Department")
    .delete()
    .in("id", allDeptIds)
    .eq("companyId", companyId))

  revalidatePath("/unidades")
  revalidatePath("/funcionarios")
  revalidatePath("/folha-pagamento")
  revalidatePath("/dashboard")
}

export async function toggleDepartmentStatus(id: string, active: boolean) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()

  check(await supabase.from("Department").update({ active, updatedAt: new Date().toISOString() }).eq("id", id).eq("companyId", companyId))

  if (!active) {
    check(await supabase.from("Employee")
      .update({ status: "ON_LEAVE", updatedAt: new Date().toISOString() })
      .eq("departmentId", id)
      .eq("companyId", companyId))
  }

  revalidatePath("/unidades")
  revalidatePath("/funcionarios")
}

async function getDescendantIds(id: string, companyId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  const { data: all } = await supabase
    .from("Department")
    .select("*")
    .eq("companyId", companyId)

  if (!all) return []
  const result: string[] = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()!
    const children = (all as any[]).filter(d => d.parentId === current)
    for (const c of children) {
      result.push(c.id)
      queue.push(c.id)
    }
  }
  return result
}


