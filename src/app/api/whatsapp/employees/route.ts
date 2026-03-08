import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()

    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const supabase = getSupabaseAdmin()
        const { data: employees, error } = await supabase
            .from("Employee")
            .select("id, name, position, phone, department:Department(name)")
            .eq("companyId", session.user.companyId)
            .eq("status", "ACTIVE")
            .not("phone", "is", null)
            .neq("phone", "")
            .order("name", { ascending: true })

        if (error) throw error

        const result = (employees as any[]).map(e => ({
            ...e,
            department: e.department?.name || "—"
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("[EMPLOYEES_CHAT_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
