import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function GET(req: Request) {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")

    if (!session?.user?.companyId || !conversationId) {
        return new NextResponse("Unauthorized or missing ID", { status: 401 })
    }

    try {
        const supabase = getSupabaseAdmin()
        const { data: messages, error } = await supabase
            .from("Message")
            .select(`
                *,
                conversation!inner(companyId)
            `)
            .eq("conversationId", conversationId)
            .eq("conversation.companyId", session.user.companyId)
            .order("createdAt", { ascending: true })

        if (error) throw error

        return NextResponse.json(messages)
    } catch (error) {
        console.error("[MESSAGES_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await auth()
    const body = await req.json()
    const { content, employeeId, conversationId } = body

    if (!session?.user?.companyId || !content) {
        return new NextResponse("Unauthorized or missing content", { status: 401 })
    }

    try {
        const supabase = getSupabaseAdmin()
        let activeConversationId = conversationId

        // If no conversationId is provided, find or create one with the employeeId
        if (!activeConversationId && employeeId) {
            const { data: conversation, error: convError } = await supabase
                .from("Conversation")
                .select("id")
                .eq("companyId", session.user.companyId)
                .eq("employeeId", employeeId)
                .maybeSingle()

            if (convError) throw convError

            if (conversation) {
                activeConversationId = conversation.id
            } else {
                const newId = randomUUID()
                const { data: newConv, error: createError } = await supabase
                    .from("Conversation")
                    .insert({
                        id: newId,
                        companyId: session.user.companyId,
                        employeeId: employeeId,
                        updatedAt: new Date().toISOString()
                    })
                    .select("id")
                    .single()

                if (createError) throw createError
                activeConversationId = newConv.id
            }
        }

        if (!activeConversationId) {
            return new NextResponse("Missing conversation or employee ID", { status: 400 })
        }

        const messageId = randomUUID()
        const { data: message, error: msgError } = await supabase
            .from("Message")
            .insert({
                id: messageId,
                content,
                conversationId: activeConversationId,
                senderId: session.user.id!,
                senderType: "COMPANY",
                createdAt: new Date().toISOString()
            })
            .select()
            .single()

        if (msgError) throw msgError

        // Update conversation updatedAt to bring it to top
        await supabase
            .from("Conversation")
            .update({ updatedAt: new Date().toISOString() })
            .eq("id", activeConversationId)

        return NextResponse.json(message)
    } catch (error) {
        console.error("[MESSAGES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
