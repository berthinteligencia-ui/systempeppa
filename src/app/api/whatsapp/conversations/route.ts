import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()

    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                companyId: session.user.companyId,
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        position: true,
                    },
                },
                messages: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        })

        return NextResponse.json(conversations)
    } catch (error) {
        console.error("[CONVERSATIONS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
