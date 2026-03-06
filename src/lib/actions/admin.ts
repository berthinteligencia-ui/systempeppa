"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { cookies } from "next/headers"
import { randomUUID } from "crypto"
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
}

export async function listAllCompanies() {
    const supabase = getSupabaseAdmin()

    const { data: companies } = await supabase
        .from("Company")
        .select("*")
        .order("createdAt", { ascending: false })

    const { data: users } = await supabase.from("User").select("companyId")
    const { data: employees } = await supabase.from("Employee").select("companyId")

    return (companies ?? []).map(c => ({
        ...c,
        _count: {
            users: (users ?? []).filter(u => u.companyId === c.id).length,
            employees: (employees ?? []).filter(e => e.companyId === c.id).length,
        },
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
        active: true,
        createdAt: now,
        updatedAt: now,
    })

    if (companyError) throw new Error(companyError.message)

    const { error: userError } = await supabase.from("User").insert({
        id: userId,
        name: adminUser.name,
        email: adminUser.email,
        password: hashed,
        role: "ADMIN",
        active: true,
        companyId,
        createdAt: now,
        updatedAt: now,
    })

    if (userError) {
        await supabase.from("Company").delete().eq("id", companyId)
        throw new Error(userError.message)
    }

    return { id: companyId, name: data.name, active: true, createdAt: now }
}

export async function updateCompany(id: string, data: CompanyInput) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("Company").update({
        name: data.name,
        cnpj: data.cnpj || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        updatedAt: new Date().toISOString(),
    }).eq("id", id)

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
