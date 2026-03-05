import { listNotasFiscais } from "@/lib/actions/nfs"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { NfsClient } from "./client"

export default async function NfsPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const [nfs, { data: depts }] = await Promise.all([
    listNotasFiscais(),
    supabase.from("Department").select("id, name, cnpj").eq("companyId", session.user.companyId).order("name"),
  ])

  const departments = (depts ?? []) as { id: string; name: string; cnpj: string | null }[]

  return <NfsClient initialNfs={nfs as any} departments={departments} />
}
