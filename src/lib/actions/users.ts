"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import bcrypt from "bcryptjs"

import { randomUUID } from "crypto"

async function getCompanyId() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autenticado")
  return session.user.companyId
}

export async function createUser(data: {
  name: string
  email: string
  password: string
  role: string
}) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const password = await bcrypt.hash(data.password, 12)
  const now = new Date().toISOString()

  check(await supabase.from("User").insert({
    id: randomUUID(),
    name: data.name,
    email: data.email,
    password,
    role: data.role,
    companyId,
    createdAt: now,
    updatedAt: now,
  }))
  revalidatePath("/usuarios")
}

export async function updateUser(
  id: string,
  data: { name: string; email: string; role: string; active: boolean; password?: string }
) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  const update: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active,
    updatedAt: new Date().toISOString(),
  }
  if (data.password) {
    update.password = await bcrypt.hash(data.password, 12)
  }
  check(await supabase.from("User").update(update).eq("id", id).eq("companyId", companyId))
  revalidatePath("/usuarios")
}

export async function deleteUser(id: string) {
  const companyId = await getCompanyId()
  const supabase = getSupabaseAdmin()
  check(await supabase.from("User").delete().eq("id", id).eq("companyId", companyId))
  revalidatePath("/usuarios")
}
