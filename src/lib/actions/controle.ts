"use server"

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CONTROLE_SECRET = process.env.CONTROLE_SECRET ?? "master@"

export async function controleLogin(password: string): Promise<boolean> {
    if (password !== CONTROLE_SECRET) return false
    const cookieStore = await cookies()
    const hash = await bcrypt.hash(CONTROLE_SECRET, 6)
    cookieStore.set("controle_session", hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8,
        path: "/",
    })
    return true
}

export async function controleLogout() {
    const cookieStore = await cookies()
    cookieStore.delete("controle_session")
}

export async function checkControleAuth(): Promise<boolean> {
    const cookieStore = await cookies()
    const session = cookieStore.get("controle_session")
    if (!session?.value) return false
    try {
        return await bcrypt.compare(CONTROLE_SECRET, session.value)
    } catch {
        return false
    }
}

export async function getCompanyDetails(companyId: string) {
    const supabase = getSupabaseAdmin()

    const [
        company, 
        users, 
        employees, 
        departments, 
        nfs, 
        payrolls, 
        backups, 
        settings, 
        logs,
        subscription,
        invoices
    ] = await Promise.all([
        supabase.from("Company").select("*").eq("id", companyId).single(),
        supabase.from("User").select("id, name, email, role, active, createdAt").eq("companyId", companyId).order("name"),
        supabase.from("Employee").select("id, name, cpf, email, phone, position, salary, hireDate, status, createdAt, departmentId").eq("companyId", companyId).order("name"),
        supabase.from("Department").select("id, name, cnpj, createdAt").eq("companyId", companyId).order("name"),
        supabase.from("NotaFiscal").select("id, numero, emitente, valor, dataEmissao, descricao, status, createdAt").eq("companyId", companyId).order("dataEmissao", { ascending: false }).limit(50),
        supabase.from("PayrollAnalysis").select("id, month, year, total, status, createdAt, departmentId").eq("companyId", companyId).order("year", { ascending: false }).order("month", { ascending: false }).limit(24),
        supabase.from("Backup").select("id, fileName, fileSize, status, createdAt").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(20),
        supabase.from("Settings").select("*").eq("companyId", companyId).maybeSingle(),
        supabase.from("activity_logs").select("id, user_name, action, target, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(30),
        supabase.from("Subscription").select("*, plan:Plan(*)").eq("companyId", companyId).maybeSingle(),
        supabase.from("Invoice").select("*").eq("companyId", companyId).order("year", { ascending: false }).order("month", { ascending: false }).limit(5),
    ])

    // Build department map for enriching employees
    const deptMap: Record<string, string> = {}
    ;(departments.data ?? []).forEach(d => { deptMap[d.id] = d.name })

    const employeesWithDept = (employees.data ?? []).map(e => ({
        ...e,
        departmentName: e.departmentId ? (deptMap[e.departmentId] ?? "—") : "—",
    }))

    const totalSalary = employeesWithDept
        .filter(e => e.status === "ACTIVE")
        .reduce((sum, e) => sum + Number(e.salary ?? 0), 0)

    return {
        company: company.data,
        users: users.data ?? [],
        employees: employeesWithDept,
        departments: departments.data ?? [],
        nfs: nfs.data ?? [],
        payrolls: payrolls.data ?? [],
        backups: backups.data ?? [],
        settings: settings.data,
        logs: logs.data ?? [],
        subscription: subscription.data,
        invoices: invoices.data ?? [],
        totalSalary,
    }
}

export async function getControleStats() {
    const supabase = getSupabaseAdmin()

    const [companies, users, employees, logs] = await Promise.all([
        supabase.from("Company").select("id, name, cnpj, email, city, state, active, createdAt").order("createdAt", { ascending: false }),
        supabase.from("User").select("id, name, email, role, active, companyId, createdAt"),
        supabase.from("Employee").select("id, companyId, active"),
        supabase.from("activity_logs").select("id, user_name, user_email, action, target, created_at, company_id").order("created_at", { ascending: false }).limit(50),
    ])

    const companiesList = companies.data ?? []
    const usersList = users.data ?? []
    const employeesList = employees.data ?? []
    const logsList = logs.data ?? []

    const totalCompanies = companiesList.length
    const activeCompanies = companiesList.filter(c => c.active).length
    const totalUsers = usersList.length
    const totalEmployees = employeesList.length
    const activeEmployees = employeesList.filter(e => e.active).length

    const roleCount = usersList.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] ?? 0) + 1
        return acc
    }, {} as Record<string, number>)

    // Last 7 days registrations
    const now = new Date()
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split("T")[0]
    })

    const companiesByDay = last7.map(day => ({
        day: day.slice(5), // MM-DD
        count: companiesList.filter(c => c.createdAt?.startsWith(day)).length,
    }))

    return {
        totalCompanies,
        activeCompanies,
        totalUsers,
        totalEmployees,
        activeEmployees,
        roleCount,
        companiesByDay,
        recentCompanies: companiesList.slice(0, 10),
        recentLogs: logsList.slice(0, 20),
        allCompanies: companiesList,
    }
}
