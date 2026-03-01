import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()

    if (!session?.user?.companyId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const employees = await prisma.employee.findMany({
            where: {
                companyId: session.user.companyId,
                status: "ACTIVE",
            },
            select: {
                id: true,
                name: true,
                position: true,
            },
            orderBy: {
                name: "asc",
            },
        })

        return NextResponse.json(employees)
    } catch (error) {
        console.error("[EMPLOYEES_CHAT_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
