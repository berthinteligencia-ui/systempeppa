import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"

// Temporary debug endpoint — remove after diagnosing login issue
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  if (!email) return NextResponse.json({ error: "Pass ?email=..." }, { status: 400 })

  const supabase = getSupabaseAdmin()

  // Step 1: fetch user only (no join)
  const { data: userOnly, error: e1 } = await supabase
    .from("User")
    .select("id, name, email, active, role, companyId")
    .eq("email", email)
    .single()

  // Step 2: fetch with Company join
  const { data: userWithCompany, error: e2 } = await supabase
    .from("User")
    .select("id, Company(id, name)")
    .eq("email", email)
    .single()

  return NextResponse.json({
    step1_user: userOnly ? { id: userOnly.id, name: userOnly.name, active: userOnly.active, role: userOnly.role } : null,
    step1_error: e1?.message ?? null,
    step2_join: userWithCompany ? "ok" : "null",
    step2_error: e2?.message ?? null,
  })
}
