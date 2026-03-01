"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

async function getCompanyId() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autenticado")
  return session.user.companyId
}

import { randomUUID } from "crypto"

export async function createDepartment(data: { name: string }) {
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

export async function updateDepartment(id: string, data: { name: string }) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Department").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id).eq("companyId", companyId))
  revalidatePath("/unidades")
}

export async function deleteDepartment(id: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Department").delete().eq("id", id).eq("companyId", companyId))
  revalidatePath("/unidades")
}
