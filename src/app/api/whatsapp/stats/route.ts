import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    const supabase = getSupabaseAdmin()
    const companyId = session.user.companyId

    try {
        const [
            { data: conversations },
            { count: totalMessages },
        ] = await Promise.all([
            supabase
                .from("Conversation")
                .select("id, employeeId, messages:Message(id, content, createdAt, senderType)")
                .eq("companyId", companyId),
            supabase
                .from("Message")
                .select("*", { count: "exact", head: true })
                .in(
                    "conversationId",
                    (await supabase.from("Conversation").select("id").eq("companyId", companyId)).data?.map(c => c.id) ?? []
                ),
        ])

        const totalLeads = (conversations ?? []).length
        const activeConvs = (conversations ?? []).filter(c => (c.messages?.length ?? 0) > 0).length

        // Avg response time: time between first EMPLOYEE msg and first COMPANY reply
        let totalResponseMs = 0
        let responseCount = 0

        for (const conv of conversations ?? []) {
            const msgs = ((conv.messages ?? []) as any[]).sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
            const firstEmployee = msgs.find(m => m.senderType === "EMPLOYEE")
            if (!firstEmployee) continue
            const firstReply = msgs.find(
                m => m.senderType === "COMPANY" && new Date(m.createdAt) > new Date(firstEmployee.createdAt)
            )
            if (!firstReply) continue
            totalResponseMs += new Date(firstReply.createdAt).getTime() - new Date(firstEmployee.createdAt).getTime()
            responseCount++
        }

        const avgResponseMinutes = responseCount > 0
            ? Math.round(totalResponseMs / responseCount / 60000)
            : 0

        return NextResponse.json({
            totalLeads,
            totalMessages: totalMessages ?? 0,
            avgResponseMinutes,
            activeConvs,
        })
    } catch (err) {
        console.error("[STATS_GET]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
