import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get("conversationId")

    if (!session?.user?.companyId || !conversationId) {
        return new NextResponse("Unauthorized or missing ID", { status: 401 })
    }

    try {
        const messages = await prisma.message.findMany({
            where: {
                conversationId,
                conversation: {
                    companyId: session.user.companyId, // Security check
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        })

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
        let activeConversationId = conversationId

        // If no conversationId is provided, find or create one with the employeeId
        if (!activeConversationId && employeeId) {
            const conversation = await prisma.conversation.upsert({
                where: {
                    companyId_employeeId: {
                        companyId: session.user.companyId,
                        employeeId: employeeId,
                    },
                },
                update: {},
                create: {
                    companyId: session.user.companyId,
                    employeeId: employeeId,
                },
            })
            activeConversationId = conversation.id
        }

        if (!activeConversationId) {
            return new NextResponse("Missing conversation or employee ID", { status: 400 })
        }

        const message = await prisma.message.create({
            data: {
                content,
                conversationId: activeConversationId,
                senderId: session.user.id!,
                senderType: "COMPANY",
            },
        })

        // Update conversation updatedAt to bring it to top
        await prisma.conversation.update({
            where: { id: activeConversationId },
            data: { updatedAt: new Date() },
        })

        return NextResponse.json(message)
    } catch (error) {
        console.error("[MESSAGES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
