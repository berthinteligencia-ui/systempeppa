"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { checkAdminAuth } from "./admin"
import { randomUUID } from "crypto"

async function checkAdmin() {
  const isSuperAdmin = await checkAdminAuth()
  if (isSuperAdmin) return
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado: Apenas administradores podem realizar esta ação.")
  }
}

// ── Serialization Helpers ──────────────────────────────────────────────────

function serializePlan(plan: any) {
  if (!plan) return null
  return {
    ...plan,
    basePrice: plan.basePrice ? Number(plan.basePrice) : 0,
    pricePerEmployee: plan.pricePerEmployee ? Number(plan.pricePerEmployee) : 0,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
    updatedAt: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt,
  }
}

function serializeSubscription(sub: any) {
  if (!sub) return null
  return {
    ...sub,
    customBasePrice: sub.customBasePrice !== null ? Number(sub.customBasePrice) : null,
    customPricePerEmployee: sub.customPricePerEmployee !== null ? Number(sub.customPricePerEmployee) : null,
    createdAt: sub.createdAt instanceof Date ? sub.createdAt.toISOString() : sub.createdAt,
    updatedAt: sub.updatedAt instanceof Date ? sub.updatedAt.toISOString() : sub.updatedAt,
    plan: sub.plan ? serializePlan(sub.plan) : undefined
  }
}

function serializeInvoice(inv: any) {
  if (!inv) return null
  return {
    ...inv,
    amount: inv.amount ? Number(inv.amount) : 0,
    basePriceUsed: inv.basePriceUsed ? Number(inv.basePriceUsed) : 0,
    pricePerEmployeeUsed: inv.pricePerEmployeeUsed ? Number(inv.pricePerEmployeeUsed) : 0,
    dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : inv.dueDate,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    company: inv.company || undefined
  }
}

export async function getPlans() {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("Plan")
    .select("*")
    .eq("active", true)
    .order("createdAt", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(serializePlan)
}

export async function createPlan(data: {
  name: string
  description?: string
  basePrice: number
  pricePerEmployee: number
  billingType?: string
}) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: plan, error } = await supabase
    .from("Plan")
    .insert({ id: randomUUID(), ...data, active: true, createdAt: now, updatedAt: now })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
  return serializePlan(plan)
}

export async function updatePlan(id: string, data: {
  name: string
  description?: string
  basePrice: number
  pricePerEmployee: number
  billingType: string
  active: boolean
}) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { data: plan, error } = await supabase
    .from("Plan")
    .update({ ...data, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
  return serializePlan(plan)
}

export async function deletePlan(id: string) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("Plan").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

export async function updateCompanySubscription(companyId: string, data: {
  planId: string
  customBasePrice?: number
  customPricePerEmployee?: number
}) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const cleanData = {
    planId: data.planId,
    customBasePrice: data.customBasePrice ?? null,
    customPricePerEmployee: data.customPricePerEmployee ?? null,
    active: true,
    updatedAt: now,
  }

  const { data: existing } = await supabase
    .from("Subscription")
    .select("id")
    .eq("companyId", companyId)
    .maybeSingle()

  let sub: any
  if (existing) {
    const { data: updated, error } = await supabase
      .from("Subscription")
      .update(cleanData)
      .eq("companyId", companyId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    sub = updated
  } else {
    const { data: created, error } = await supabase
      .from("Subscription")
      .insert({ id: randomUUID(), companyId, ...cleanData, createdAt: now })
      .select()
      .single()
    if (error) throw new Error(error.message)
    sub = created
  }

  revalidatePath("/admin")
  return serializeSubscription(sub)
}

export async function getCompanySubscription(companyId: string) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("Subscription")
    .select("*, plan:Plan(*)")
    .eq("companyId", companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return serializeSubscription(data)
}

export async function getAllInvoices() {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("Invoice")
    .select("*, company:Company(id, name)")
    .order("createdAt", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(serializeInvoice)
}

export async function updateInvoiceStatus(id: string, status: string) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from("Invoice")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

export async function generateInvoicesForMonth(month: number, year: number) {
  await checkAdmin()
  const supabase = getSupabaseAdmin()

  const { data: companies, error } = await supabase
    .from("Company")
    .select("id, subscription:Subscription(*, plan:Plan(*))")
    .eq("active", true)
  if (error) throw new Error(error.message)

  // Conta funcionários ativos por empresa
  const { data: empRows } = await supabase
    .from("Employee")
    .select("companyId")
    .eq("status", "ACTIVE")
  const empCount: Record<string, number> = {}
  for (const e of empRows ?? []) empCount[e.companyId] = (empCount[e.companyId] ?? 0) + 1

  let count = 0
  const now = new Date().toISOString()

  for (const company of companies ?? []) {
    const sub = (company as any).subscription
    if (!sub) continue
    const plan = sub.plan
    if (!plan) continue

    const activeEmps = empCount[company.id] ?? 0
    const basePrice = sub.customBasePrice !== null ? Number(sub.customBasePrice) : Number(plan.basePrice)
    const perEmpPrice = sub.customPricePerEmployee !== null ? Number(sub.customPricePerEmployee) : Number(plan.pricePerEmployee)
    const amount = plan.billingType === "FIXED" ? basePrice : basePrice + (perEmpPrice * activeEmps)
    const dueDate = new Date(year, month - 1, 15).toISOString()

    // Upsert: verifica se já existe fatura para esse mês/ano/empresa
    const { data: existing } = await supabase
      .from("Invoice")
      .select("id")
      .eq("companyId", company.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle()

    if (existing) {
      await supabase.from("Invoice").update({
        amount, employeeCount: activeEmps, basePriceUsed: basePrice,
        pricePerEmployeeUsed: perEmpPrice, updatedAt: now,
      }).eq("id", existing.id)
    } else {
      await supabase.from("Invoice").insert({
        id: randomUUID(), companyId: company.id, amount,
        employeeCount: activeEmps, basePriceUsed: basePrice,
        pricePerEmployeeUsed: perEmpPrice, month, year,
        status: "PENDING", dueDate, createdAt: now, updatedAt: now,
      })
    }
    count++
  }

  revalidatePath("/admin")
  return { generated: count }
}
