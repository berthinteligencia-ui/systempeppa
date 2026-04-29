"use server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

export async function getDashboardData(month?: number, year?: number) {
    const session = await auth()
    if (!session?.user?.companyId) return null

    const companyId = session.user.companyId
    const now = new Date()
    const currentMonth = month ?? now.getMonth() + 1
    const currentYear = year ?? now.getFullYear()

    const prevDate = new Date(currentYear, currentMonth - 2, 1)
    const prevMonth = prevDate.getMonth() + 1
    const prevYear = prevDate.getFullYear()

    const supabase = getSupabaseAdmin()

    const [
        { data: departments },
        { data: activeEmps },
        { data: currentAnalyses },
        { data: prevAnalyses },
        { count: totalEmployees },
        { count: efetivadosCount },
    ] = await Promise.all([
        supabase.from("Department").select("*").eq("companyId", companyId),
        supabase.from("Employee").select("departmentId").eq("companyId", companyId).eq("status", "ACTIVE"),
        supabase.from("PayrollAnalysis").select("*").eq("companyId", companyId).eq("month", currentMonth).eq("year", currentYear),
        supabase.from("PayrollAnalysis").select("*").eq("companyId", companyId).eq("month", prevMonth).eq("year", prevYear),
        supabase.from("Employee").select("*", { count: "exact", head: true }).eq("companyId", companyId).eq("status", "ACTIVE"),
        // Apenas "efetuado" é considerado pago — qualquer outro status (pendente, lancado, pago, atrasado) é pendente
        supabase.from("Employee").select("*", { count: "exact", head: true }).eq("companyId", companyId).eq("status", "ACTIVE").eq("pagamento", "efetuado"),
    ])

    const depts = (departments ?? []).map(d => ({
        ...d,
        _count: { employees: (activeEmps ?? []).filter(e => e.departmentId === d.id).length }
    }))

    const prevTotalCost = (prevAnalyses ?? []).reduce((acc, curr) => acc + Number(curr.total), 0)

    const total = totalEmployees ?? 0
    const efetuados = efetivadosCount ?? 0
    // Pendentes = todos ativos que NÃO têm pagamento "efetuado"
    const pendingPaymentsCount = total - efetuados
    // Progresso financeiro: % de funcionários com pagamento efetuado
    const closingProgress = total > 0 ? Math.round((efetuados / total) * 100) : 0

    const unitList = depts.map(dept => {
        const analysis = (currentAnalyses ?? []).find(a => a.departmentId === dept.id)
        return {
            id: dept.id,
            name: dept.name,
            code: `UNIT-${dept.id.slice(-4).toUpperCase()}`,
            manager: "Gerente Unidade",
            status: analysis ? "FECHADO" : "PENDENTE",
            headcount: dept._count.employees,
            cost: analysis ? Number(analysis.total) : 0
        }
    })

    // Sum only the cost of units that have a registered fechamento (avoids counting duplicate or orphan PayrollAnalysis records)
    const totalCost = unitList.reduce((acc, u) => acc + u.cost, 0)
    const unitClosings = unitList.filter(u => u.status === "FECHADO").length
    const totalUnits = depts.length

    const variation = prevTotalCost > 0
        ? ((totalCost - prevTotalCost) / prevTotalCost) * 100
        : 0

    const alerts = unitList
        .filter(u => u.status === "PENDENTE")
        .map(u => ({
            type: "FECHAMENTO PENDENTE",
            time: "Aguardando",
            message: `A unidade ${u.name} ainda não realizou o fechamento da folha para ${currentMonth}/${currentYear}.`,
            borderColor: "border-amber-500",
            bg: "bg-amber-50",
            badge: "bg-amber-100 text-amber-700"
        }))

    unitList.forEach(u => {
        if (u.cost > 100000) {
            alerts.push({
                type: "ALERTA DE CUSTO",
                time: "Hoje",
                message: `A unidade ${u.name} ultrapassou R$ 100k em custo de folha.`,
                borderColor: "border-red-500",
                bg: "bg-red-50",
                badge: "bg-red-100 text-red-700"
            })
        }
    })

    return {
        kpis: {
            totalCost,
            totalEmployees: totalEmployees ?? 0,
            unitClosings,
            totalUnits,
            closingProgress,
            variation,
            pendingPaymentsCount,
        },
        unitList,
        alerts,
        period: { month: currentMonth, year: currentYear }
    }
}
