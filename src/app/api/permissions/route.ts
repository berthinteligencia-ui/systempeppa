import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// GET /api/permissions — retorna as permissões do role do usuário logado
export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    const role = session.user.role
    const companyId = session.user.companyId

    // ADMIN tem acesso total
    if (role === "ADMIN") {
        return NextResponse.json({ role, permissions: null, isAdmin: true })
    }

    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from("role_permissions")
            .select("permissions")
            .eq("company_id", companyId)
            .eq("role", role)
            .maybeSingle()

        if (error) throw error
        return NextResponse.json({ role, permissions: data?.permissions ?? null, isAdmin: false })
    } catch (err: any) {
        console.error("[permissions GET] Error:", err?.message)
        return NextResponse.json({ role, permissions: null, isAdmin: false })
    }
}
