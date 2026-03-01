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
            .select("id, name, position")
            .eq("companyId", session.user.companyId)
            .eq("status", "ACTIVE")
            .order("name", { ascending: true })

        if (error) throw error

        return NextResponse.json(employees)
    } catch (error) {
        console.error("[EMPLOYEES_CHAT_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
