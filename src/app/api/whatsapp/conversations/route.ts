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
        const { data: conversations, error } = await supabase
            .from("Conversation")
            .select(`
                *,
                employee:Employee(id, name, position),
                messages:Message(id, content, createdAt, senderId, senderType)
            `)
            .eq("companyId", session.user.companyId)
            // Note: messages subquery in Supabase JS doesn't support easy 'ordering and take 1' directly in the same string as easily 
            // as Prisma, but we can process it in memory or use a more complex query.
            // For simplicity and matching current behavior, we'll fetch and sort.
            .order("updatedAt", { ascending: false })

        if (error) throw error

        const result = (conversations || []).map(conv => ({
            ...conv,
            messages: (conv.messages || [])
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 1)
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("[CONVERSATIONS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
