import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: users, error } = await supabase
      .from("User")
      .select("email, active")
      .limit(10)

    if (error) throw error

    return NextResponse.json({
      status: "ok",
      database: "connected",
      time: new Date().toISOString(),
      users: users?.length || 0
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.substring(0, 500) }, { status: 500 })
  }
}
