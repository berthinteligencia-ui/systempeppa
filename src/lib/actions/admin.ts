"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { cookies } from "next/headers"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "pepacorp@admin"

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(password: string): Promise<boolean> {
    if (password !== ADMIN_SECRET) return false
    const cookieStore = await cookies()
    const hash = await bcrypt.hash(ADMIN_SECRET, 6)
    cookieStore.set("admin_session", hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8,
        path: "/",
    })
    return true
}

export async function adminLogout() {
    const cookieStore = await cookies()
    cookieStore.delete("admin_session")
}

export async function checkAdminAuth(): Promise<boolean> {
    const cookieStore = await cookies()
    const session = cookieStore.get("admin_session")
    if (!session?.value) return false
    try {
        return await bcrypt.compare(ADMIN_SECRET, session.value)
    } catch {
        return false
    }
}

// ── Companies ─────────────────────────────────────────────────────────────────

export type CompanyInput = {
    name: string
    cnpj?: string
    email?: string
    whatsapp?: string
    address?: string
    city?: string
    state?: string
    whatsappWebhookUrl?: string
    webhookToken?: string
}

export async function listAllCompanies() {
    const companies = await prisma.company.findMany({
        include: {
            _count: {
                select: { users: true, employees: { where: { status: "ACTIVE" } } }
            },
            subscription: {
                include: { plan: true }
            },
            settings: {
                select: {
                    id: true,
                    companyId: true,
                    whatsappNotifications: true,
                    autoBackup: true,
                    payrollReminderDays: true,
                    createdAt: true,
                    updatedAt: true,
                }
            }
        },
        orderBy: { createdAt: "desc" }
    })

    // Serialize Dates and Decimals for Client Component
    return companies.map(c => ({
        ...c,
        whatsappWebhookUrl: c.whatsappWebhookUrl ?? "",
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        settings: c.settings ? {
            ...c.settings,
            createdAt: c.settings.createdAt.toISOString(),
            updatedAt: c.settings.updatedAt.toISOString(),
        } : null,
        subscription: c.subscription ? {
            ...c.subscription,
            createdAt: c.subscription.createdAt.toISOString(),
            updatedAt: c.subscription.updatedAt.toISOString(),
            customBasePrice: c.subscription.customBasePrice ? Number(c.subscription.customBasePrice) : null,
            customPricePerEmployee: c.subscription.customPricePerEmployee ? Number(c.subscription.customPricePerEmployee) : null,
            plan: c.subscription.plan ? {
                ...c.subscription.plan,
                basePrice: Number(c.subscription.plan.basePrice),
                pricePerEmployee: Number(c.subscription.plan.pricePerEmployee),
                createdAt: c.subscription.plan.createdAt.toISOString(),
                updatedAt: c.subscription.plan.updatedAt.toISOString(),
            } : null
        } : null
    }))
}

export async function createCompany(data: CompanyInput, adminUser: { name: string; email: string; password: string }) {
    const supabase = getSupabaseAdmin()

    if (data.cnpj) {
        const { data: existing } = await supabase.from("Company").select("id").eq("cnpj", data.cnpj).maybeSingle()
        if (existing) throw new Error("Já existe uma empresa com este CNPJ.")
    }

    const hashed = await bcrypt.hash(adminUser.password, 10)
    const now = new Date().toISOString()
    const companyId = randomUUID()
    const userId = randomUUID()

    const { error: companyError } = await supabase.from("Company").insert({
        id: companyId,
        name: data.name,
        cnpj: data.cnpj || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        whatsappWebhookUrl: data.whatsappWebhookUrl || null,
        webhookToken: data.webhookToken || null,
        active: true,
        createdAt: now,
        updatedAt: now,
    })

    if (companyError) throw new Error(companyError.message)
    
    await supabase.from("Settings").insert({
        id: randomUUID(),
        companyId,
        createdAt: now,
        updatedAt: now,
    })

    const { error: userError } = await supabase.from("User").insert({
        id: userId,
        name: adminUser.name,
        email: adminUser.email,
        password: hashed,
        role: "ADMIN",
        active: true,
        mustChangePassword: true,
        companyId,
        createdAt: now,
        updatedAt: now,
    })

    if (userError) {
        await supabase.from("Company").delete().eq("id", companyId)
        throw new Error(userError.message)
    }

    return {
        id: companyId,
        name: data.name,
        active: true,
        createdAt: now,
        credentials: { name: adminUser.name, email: adminUser.email, password: adminUser.password },
    }
}

export async function updateCompany(id: string, data: CompanyInput) {
    const supabase = getSupabaseAdmin()
    const { data: updated, error } = await supabase.from("Company").update({
        name: data.name,
        cnpj: data.cnpj || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        whatsappWebhookUrl: data.whatsappWebhookUrl || null,
        webhookToken: data.webhookToken || null,
        updatedAt: new Date().toISOString(),
    }).eq("id", id).select().single()

    if (error) throw new Error(error.message)

    return updated
}

export async function getCompanyAdmin(companyId: string) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
        .from("User")
        .select("id, name, email")
        .eq("companyId", companyId)
        .eq("role", "ADMIN")
        .limit(1)

    if (error) throw new Error(error.message)
    return data && data.length > 0 ? data[0] : null
}

export async function updateCompanyAdmin(userId: string, data: { name: string; email: string; password?: string }) {
    const supabase = getSupabaseAdmin()
    const updateData: any = {
        name: data.name,
        email: data.email,
        updatedAt: new Date().toISOString()
    }

    if (data.password && data.password.trim().length > 0) {
        updateData.password = await bcrypt.hash(data.password, 10)
        updateData.mustChangePassword = true
    }

    const { error } = await supabase.from("User").update(updateData).eq("id", userId)
    if (error) throw new Error(error.message)
}

export async function toggleCompanyActive(id: string, active: boolean) {
    const supabase = getSupabaseAdmin()
    await supabase.from("Company").update({ active, updatedAt: new Date().toISOString() }).eq("id", id)
}

export async function deleteCompany(id: string) {
    const supabase = getSupabaseAdmin()
    await supabase.from("Company").delete().eq("id", id)
}

export async function extractCompanyData(formData: FormData) {
    const file = formData.get("file") as File
    if (!file) throw new Error("Arquivo não enviado")

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("Chave de API da OpenAI (OPENAI_API_KEY) não configurada no .env")

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey })

    const buffer = await file.arrayBuffer()
    const { extractText } = await import("unpdf")
    const { text: textContent } = await extractText(new Uint8Array(buffer))

    const prompt = `Analise o texto abaixo extraído de um Comprovante de Inscrição e de Situação Cadastral (Cartão CNPJ) e extraia os seguintes dados em formato JSON puro, sem markdown:
    - name: Nome empresarial ou Razão Social (string)
    - cnpj: CNPJ formatado (string)
    - email: E-mail de contato, se houver (string)
    - whatsapp: Telefone/WhatsApp, se houver (string)
    - address: Logradouro, número, complemento e bairro (string)
    - city: Cidade/Município (string)
    - state: Estado/UF (string)

    Texto do comprovante:
    ${textContent}`

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Você é um assistente especializado em extração de dados de documentos empresariais brasileiros. Responda apenas com o JSON puro." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        })

        const resultText = response.choices[0].message.content
        if (!resultText) throw new Error("OpenAI retornou uma resposta vazia")

        const parsed = JSON.parse(resultText)

        return {
            name: String(parsed.name || ""),
            cnpj: String(parsed.cnpj || ""),
            email: String(parsed.email || ""),
            whatsapp: String(parsed.whatsapp || ""),
            address: String(parsed.address || ""),
            city: String(parsed.city || ""),
            state: String(parsed.state || "")
        } as CompanyInput
    } catch (err: any) {
        console.error("[EXTRACT_COMPANY] OpenAI error:", err)
        throw new Error("Falha ao analisar o documento com OpenAI: " + err.message)
    }
}
