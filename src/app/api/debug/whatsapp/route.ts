import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })

    const supabase = getSupabaseAdmin()
    const companyId = session.user.companyId

    const results: Record<string, any> = { companyId }

    // Test 1: Query Conversation table directly
    try {
        const { data, error, count } = await supabase
            .from("Conversation")
            .select("*", { count: "exact" })
            .eq("companyId", companyId)
        results.conversations = { count, error: error?.message ?? null, sample: data?.slice(0, 2) }
    } catch (e: any) {
        results.conversations = { error: e.message }
    }

    // Test 2: Query Message table directly (no joins)
    try {
        const { data, error, count } = await supabase
            .from("Message")
            .select("*", { count: "exact" })
            .limit(5)
        results.messages = { count, error: error?.message ?? null, sample: data?.slice(0, 2) }
    } catch (e: any) {
        results.messages = { error: e.message }
    }

    // Test 3: Embedded employee relationship
    try {
        const { data, error } = await supabase
            .from("Conversation")
            .select("id, employee:Employee(id, name)")
            .eq("companyId", companyId)
            .limit(2)
        results.conversationsWithEmployee = { error: error?.message ?? null, data }
    } catch (e: any) {
        results.conversationsWithEmployee = { error: e.message }
    }

    // Test 4: Embedded messages relationship
    try {
        const { data, error } = await supabase
            .from("Conversation")
            .select("id, messages:Message(id, content)")
            .eq("companyId", companyId)
            .limit(2)
        results.conversationsWithMessages = { error: error?.message ?? null, data }
    } catch (e: any) {
        results.conversationsWithMessages = { error: e.message }
    }

    return NextResponse.json(results, { status: 200 })
}
