import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getRolePermissions } from "@/lib/actions/permissions"
import { query } from "@/lib/db"

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

    const rows = await query<{ permissions: Record<string, boolean> }>(
        `SELECT permissions FROM role_permissions WHERE company_id = $1 AND role = $2`,
        [companyId, role]
    )

    const permissions = rows[0]?.permissions ?? null
    return NextResponse.json({ role, permissions, isAdmin: false })
}
