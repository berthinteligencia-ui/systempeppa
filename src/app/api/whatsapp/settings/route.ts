import { auth } from "@/lib/auth"
import { queryOne } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const settings = await queryOne(
            `SELECT "whatsappWebhookUrl" FROM "Settings" WHERE "companyId" = $1 LIMIT 1`,
            [session.user.companyId]
        )
        return NextResponse.json({
            whatsappWebhookUrl: settings?.whatsappWebhookUrl || "https://webhook.berthia.com.br/webhook/folhazap"
        })
    } catch (err: any) {
        console.error("[SETTINGS_GET]", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
