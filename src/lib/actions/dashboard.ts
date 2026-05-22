"use server"

import { getSupabaseAdmin, fetchFullList } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

export async function getDashboardData(month?: number, year?: number) {
    const session = await auth()
    if (!session?.user?.companyId) return null

    const companyId = session.user.companyId
    const now = new Date()
    const currentMonth = month ?? now.getMonth() + 1
    const currentYear = year ?? now.getFullYear()

    const supabase = getSupabaseAdmin()

    // If no explicit month/year was requested, find the latest month with data
    let effectiveMonth = currentMonth
    let effectiveYear = currentYear

    if (!month && !year) {
        const { data: latestAnalysis } = await supabase
            .from("PayrollAnalysis")
            .select("month, year")
            .eq("companyId", companyId)
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .limit(1)

        if (latestAnalysis && latestAnalysis.length > 0) {
            effectiveMonth = latestAnalysis[0].month
            effectiveYear = latestAnalysis[0].year
        }
    }

    const prevDate = new Date(effectiveYear, effectiveMonth - 2, 1)
    const prevMonth = prevDate.getMonth() + 1
    const prevYear = prevDate.getFullYear()

    const [
        { data: departments },
        activeEmps,
        { data: currentAnalyses },
        { data: prevAnalyses },
        { count: totalEmployees },
        { count: efetivadosCount },
    ] = await Promise.all([
        supabase.from("Department").select("*").eq("companyId", companyId),
        fetchFullList<any>((from, to) =>
            supabase
                .from("Employee")
                .select("departmentId")
                .eq("companyId", companyId)
                .eq("status", "ACTIVE")
                .range(from, to)
        ),
        supabase.from("PayrollAnalysis").select("*").eq("companyId", companyId).eq("month", effectiveMonth).eq("year", effectiveYear),
        supabase.from("PayrollAnalysis").select("*").eq("companyId", companyId).eq("month", prevMonth).eq("year", prevYear),
        supabase.from("Employee").select("*", { count: "exact", head: true }).eq("companyId", companyId).eq("status", "ACTIVE"),
        // Apenas "efetuado" é considerado pago — qualquer outro status (pendente, lancado, pago, atrasado) é pendente
        supabase.from("Employee").select("*", { count: "exact", head: true }).eq("companyId", companyId).eq("status", "ACTIVE").ilike("pagamento", "efetuado"),
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
            manager: "GERENTE UNIDADE",
            status: analysis ? "FECHADO" : "PENDENTE",
            headcount: dept._count.employees,
            cost: analysis ? Number(analysis.total) : 0
        }
    })

    // Soma todos os fechamentos do período, independente de ter departmentId correspondente
    const totalCost = (currentAnalyses ?? []).reduce((acc, a) => acc + Number(a.total), 0)
    const unitClosings = unitList.filter(u => u.status === "FECHADO").length
    const totalUnits = depts.length

    const variation = prevTotalCost > 0
        ? ((totalCost - prevTotalCost) / prevTotalCost) * 100
        : 0

    const alerts = unitList
        .filter(u => u.status === "PENDENTE")
        .map(u => ({
            type: "FECHAMENTO PENDENTE",
            time: "AGUARDANDO",
            message: `A UNIDADE ${u.name.toUpperCase()} AINDA NÃO REALIZOU O FECHAMENTO DA FOLHA PARA ${effectiveMonth}/${effectiveYear}.`,
            borderColor: "border-amber-500",
            bg: "bg-amber-50",
            badge: "bg-amber-100 text-amber-700"
        }))

    unitList.forEach(u => {
        if (u.cost > 100000) {
            alerts.push({
                type: "ALERTA DE CUSTO",
                time: "HOJE",
                message: `A UNIDADE ${u.name.toUpperCase()} ULTRAPASSOU R$ 100K EM CUSTO DE FOLHA.`,
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
        period: { month: effectiveMonth, year: effectiveYear }
    }
}
