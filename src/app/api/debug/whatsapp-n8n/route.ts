export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })
    const companyId = session.user.companyId

    const normPhone = (p: string | null | undefined) =>
        (p ?? "").replace(/\D/g, "").slice(-8)

    // 1. Funcionários da empresa
    const { data: employees, error: empError } = await supabaseAdmin
        .from("Employee")
        .select("id, name, phone")
        .eq("companyId", companyId)
        .limit(20)

    // 2. Amostra do n8n_chat_histories
    const { data: chatRows, error: chatError } = await supabaseAdmin
        .from("n8n_chat_histories")
        .select("id, session_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(20)

    // 3. Session_ids distintos
    const distinctSessions = [...new Set((chatRows ?? []).map(r => r.session_id))]

    // 4. Tenta cruzar
    const empMap: Record<string, string> = {}
    for (const e of employees ?? []) {
        const n = normPhone(e.phone)
        if (n) empMap[n] = e.name
    }

    const matches = distinctSessions.map(sid => ({
        session_id: sid,
        normPhone: normPhone(sid),
        matchedEmployee: empMap[normPhone(sid)] ?? null,
    }))

    // Mostra os primeiros 5 registros com detalhes do message
    const sampleRows = (chatRows ?? []).slice(0, 5).map(r => ({
        id: r.id,
        session_id: r.session_id,
        messageType: typeof r.message,
        messageRaw: r.message,
        messageKeys: typeof r.message === "object" && r.message !== null ? Object.keys(r.message) : null,
        hasText: typeof r.message === "object" ? r.message?.text : null,
        hasDataContent: typeof r.message === "object" ? r.message?.data?.content : null,
        hasType: typeof r.message === "object" ? r.message?.type : null,
    }))

    return NextResponse.json({
        companyId,
        empError: empError?.message ?? null,
        chatError: chatError?.message ?? null,
        employees: (employees ?? []).map(e => ({ name: e.name, phone: e.phone, normPhone: normPhone(e.phone) })),
        totalChatRows: chatRows?.length ?? 0,
        distinctSessions,
        matches,
        sampleRows,
    })
}
