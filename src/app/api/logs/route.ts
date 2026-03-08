import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { logActivity } from "@/lib/logActivity"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

// GET /api/logs?limit=50&offset=0&userId=...
export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)
    const offset = parseInt(searchParams.get("offset") ?? "0")
    const userId = searchParams.get("userId") ?? null

    const params: any[] = [session.user.companyId, limit, offset]
    let userFilter = ""
    if (userId) {
        userFilter = ` AND user_id = $${params.length + 1}`
        params.push(userId)
    }

    const logs = await query(
        `SELECT id, user_id, user_name, user_email, action, target, details, ip_address, created_at
         FROM activity_logs
         WHERE company_id = $1${userFilter}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        params
    )

    return NextResponse.json(logs)
}

// POST /api/logs  — cria um log entry (chamado pelo ActivityLogger client-side)
export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    let body: any
    try { body = await req.json() } catch { return new NextResponse("Invalid JSON", { status: 400 }) }

    const { action, target, details } = body
    if (!action) return new NextResponse("Missing action", { status: 400 })

    const headersList = await headers()
    const ip =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headersList.get("x-real-ip") ??
        "unknown"

    await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? "",
        userEmail: session.user.email ?? "",
        companyId: session.user.companyId,
        action,
        target: target ?? undefined,
        details: details ?? undefined,
        ipAddress: ip,
    })

    return NextResponse.json({ ok: true })
}
