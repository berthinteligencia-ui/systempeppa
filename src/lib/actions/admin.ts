"use server"

import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
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
        maxAge: 60 * 60 * 8, // 8 hours
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
    return prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, employees: true } } },
    })
}

export async function createCompany(data: CompanyInput, adminUser: { name: string; email: string; password: string }) {
    const existing = await prisma.company.findFirst({ where: { cnpj: data.cnpj || undefined } })
    if (existing && data.cnpj) throw new Error("Já existe uma empresa com este CNPJ.")

    const hashed = await bcrypt.hash(adminUser.password, 10)

    const company = await prisma.company.create({
        data: {
            name: data.name,
            cnpj: data.cnpj || null,
            email: data.email || null,
            whatsapp: data.whatsapp || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            active: true,
            users: {
                create: {
                    name: adminUser.name,
                    email: adminUser.email,
                    password: hashed,
                    role: "ADMIN",
                    active: true,
                },
            },
        },
    })

    return company
}

export async function updateCompany(id: string, data: CompanyInput) {
    return prisma.company.update({
        where: { id },
        data: {
            name: data.name,
            cnpj: data.cnpj || null,
            email: data.email || null,
            whatsapp: data.whatsapp || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
        },
    })
}

export async function toggleCompanyActive(id: string, active: boolean) {
    return prisma.company.update({ where: { id }, data: { active } })
}

export async function deleteCompany(id: string) {
    await prisma.company.delete({ where: { id } })
}
