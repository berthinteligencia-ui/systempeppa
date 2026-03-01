import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client")
    const { PrismaPg } = await import("@prisma/adapter-pg")

    const url = process.env.DATABASE_URL
    if (!url) return NextResponse.json({ ok: false, error: "DATABASE_URL not set" })

    const adapter = new PrismaPg({ connectionString: url })
    const prisma = new PrismaClient({ adapter } as never)

    const users = await prisma.user.findMany({ select: { email: true, active: true } })
    await prisma.$disconnect()

    return NextResponse.json({ ok: true, users, url: url.substring(0, 50) + "..." })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.substring(0, 500) }, { status: 500 })
  }
}
