import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UsuariosClient } from "./client"

export default async function UsuariosPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect("/login")

  const supabase = getSupabaseAdmin()
  const { data: users } = await supabase
    .from("User")
    .select("id, name, email, role, active")
    .eq("companyId", session.user.companyId)
    .order("name")

  return (
    <div className="space-y-6">
      <UsuariosClient users={users ?? []} currentUserId={session.user.id!} />
    </div>
  )
}
