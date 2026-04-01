import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    try {
        const { data: company } = await supabaseAdmin
            .from("Company")
            .select("whatsappWebhookUrl")
            .eq("id", session.user.companyId)
            .maybeSingle()

        return NextResponse.json({
            whatsappWebhookUrl: company?.whatsappWebhookUrl || "https://webhook.berthia.com.br/webhook/folhazap"
        })
    } catch (err: any) {
        console.error("[SETTINGS_GET]", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
