"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

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

import { randomUUID } from "crypto"

export async function createDepartment(data: { name: string; cnpj?: string }) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  check(await supabase.from("Department").insert({
    id: randomUUID(),
    ...data,
    companyId,
    createdAt: now,
    updatedAt: now,
  }))
  revalidatePath("/unidades")
}

export async function updateDepartment(id: string, data: { name: string; cnpj?: string }) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Department").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id).eq("companyId", companyId))
  revalidatePath("/unidades")
}

export async function deleteDepartment(id: string) {
  await ensureAdmin()
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Department").delete().eq("id", id).eq("companyId", companyId))
  revalidatePath("/unidades")
}

export async function toggleDepartmentStatus(id: string, active: boolean) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  
  // Atualiza o status do departamento
  check(await supabase.from("Department").update({ active, updatedAt: new Date().toISOString() }).eq("id", id).eq("companyId", companyId))
  
  // Se desativar a unidade, coloca todos os funcionários dela como AFASTADOS (ON_LEAVE)
  if (!active) {
    check(await supabase.from("Employee")
      .update({ status: "ON_LEAVE", updatedAt: new Date().toISOString() })
      .eq("departmentId", id)
      .eq("companyId", companyId))
  }
  
  revalidatePath("/unidades")
  revalidatePath("/funcionarios")
}
