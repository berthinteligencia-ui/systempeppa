"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { checkAdminAuth } from "./admin"

async function checkAdmin() {
  // Allow if it's a Super Admin (via cookie)
  const isSuperAdmin = await checkAdminAuth()
  if (isSuperAdmin) return

  // Or if it's a regular ADMIN user (via next-auth)
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
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" }
  })
  return plans.map(serializePlan)
}

export async function createPlan(data: {
  name: string
  description?: string
  basePrice: number
  pricePerEmployee: number
  billingType?: string
}) {
  await checkAdmin()
  const plan = await prisma.plan.create({
    data: {
      ...data,
      active: true
    }
  })
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
  const plan = await prisma.plan.update({
    where: { id },
    data
  })
  revalidatePath("/admin")
  return serializePlan(plan)
}

export async function deletePlan(id: string) {
  await checkAdmin()
  await prisma.plan.delete({ where: { id } })
  revalidatePath("/admin")
}

export async function updateCompanySubscription(companyId: string, data: {
  planId: string
  customBasePrice?: number
  customPricePerEmployee?: number
}) {
  await checkAdmin()
  
  const cleanData = {
    planId: data.planId,
    customBasePrice: data.customBasePrice || null,
    customPricePerEmployee: data.customPricePerEmployee || null,
    active: true
  }

  const sub = await prisma.subscription.upsert({
    where: { companyId },
    create: {
      companyId,
      ...cleanData
    },
    update: cleanData
  })
  
  revalidatePath("/admin")
  return serializeSubscription(sub)
}

export async function getCompanySubscription(companyId: string) {
  await checkAdmin()
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true }
  })
  return serializeSubscription(sub)
}

export async function getAllInvoices() {
  await checkAdmin()
  const invoices = await prisma.invoice.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" }
  })
  return invoices.map(serializeInvoice)
}

export async function updateInvoiceStatus(id: string, status: string) {
  await checkAdmin()
  await prisma.invoice.update({
    where: { id },
    data: { status, updatedAt: new Date() }
  })
  revalidatePath("/admin")
}

export async function generateInvoicesForMonth(month: number, year: number) {
  await checkAdmin()
  
  const companies = await prisma.company.findMany({
    where: { active: true },
    include: {
      subscription: {
        include: { plan: true }
      },
      _count: {
        select: { employees: { where: { status: "ACTIVE" } } }
      }
    }
  })

  let count = 0
  for (const company of companies) {
    if (!company.subscription) continue

    const sub = company.subscription
    const plan = sub.plan
    const empCount = company._count.employees
    
    const basePrice = sub.customBasePrice !== null ? Number(sub.customBasePrice) : Number(plan.basePrice)
    const perEmpPrice = sub.customPricePerEmployee !== null ? Number(sub.customPricePerEmployee) : Number(plan.pricePerEmployee)
    
    const amount = plan.billingType === "FIXED" ? basePrice : basePrice + (perEmpPrice * empCount)

    // Due date is the 15th of the current Billing month
    const dueDate = new Date(year, month - 1, 15)

    await prisma.invoice.upsert({
      where: {
        companyId_month_year: {
          companyId: company.id,
          month,
          year
        }
      },
      create: {
        companyId: company.id,
        amount,
        employeeCount: empCount,
        basePriceUsed: basePrice,
        pricePerEmployeeUsed: perEmpPrice,
        month,
        year,
        status: "PENDING",
        dueDate,
        updatedAt: new Date()
      },
      update: {
        amount,
        employeeCount: empCount,
        basePriceUsed: basePrice,
        pricePerEmployeeUsed: perEmpPrice,
        updatedAt: new Date()
      }
    })
    count++
  }
  
  revalidatePath("/admin")
  return { generated: count }
}
