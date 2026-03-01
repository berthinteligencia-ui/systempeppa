"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { randomUUID } from "crypto"

export async function createBank(data: { name: string; code: string }) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  check(await supabase.from("Bank").insert({
    id: randomUUID(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }))
  revalidatePath("/bancos")
}

export async function updateBank(id: string, data: { name: string; code: string; active: boolean }) {
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Bank").update({ ...data, updatedAt: new Date().toISOString() }).eq("id", id))
  revalidatePath("/bancos")
}

export async function deleteBank(id: string) {
  const supabase = getSupabaseAdmin()
  check(await supabase.from("Bank").delete().eq("id", id))
  revalidatePath("/bancos")
}
