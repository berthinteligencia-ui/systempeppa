import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { BancosClient } from "./client"

export default async function BancosPage() {
  const supabase = getSupabaseAdmin()
  const { data: banks } = await supabase.from("Bank").select("*").order("code", { ascending: true })

  return (
    <div className="space-y-6">
      <BancosClient banks={banks ?? []} />
    </div>
  )
}
