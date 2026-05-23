"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts"
import {
    BarChart3, TrendingUp, PieChart as PieIcon, Calendar,
    Download, Trash2, Users, Building2, CheckCircle2, Clock, Landmark,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { deletePayrollAnalysis } from "@/lib/actions/payroll"

// --- Types ---
type Department = { id: string; name: string; parentId?: string | null }
type PayrollAnalysis = {
    id: string; month: number; year: number; total: number
    departmentId: string | null; createdAt: string
    department?: { name: string } | null
}
type EmpRow = {
    id: string; departmentId: string | null; pagamento: string | null
    bankName?: string | null; status: string; salary?: number | null
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6"]
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

const normPag = (v: string | null) =>
    (v ?? "pendente").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

function getRoot(deptId: string | null, map: Map<string, Department>): string {
    if (!deptId) return "Sem grupo"
    let cur = map.get(deptId)
    if (!cur) return "Sem grupo"
    while (cur.parentId) {
        const parent = map.get(cur.parentId)
        if (!parent) break
        cur = parent
    }
    return cur.name
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmtK = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`

export function RelatoriosClient({
    analyses: initialAnalyses,
    departments,
    employees,
}: {
    analyses: PayrollAnalysis[]
    departments: Department[]
    employees: EmpRow[]
}) {
    const [tab, setTab] = useState<"financeiro" | "funcionarios">("financeiro")
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
    const [analyses, setAnalyses] = useState(initialAnalyses)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const router = useRouter()

    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

    // ── Financeiro ────────────────────────────────────────────────────────────

    const monthlyData = useMemo(() => {
        const data = Array.from({ length: 12 }, (_, i) => ({ name: MONTHS[i], total: 0, month: i + 1 }))
        analyses.filter(a => a.year.toString() === selectedYear)
            .forEach(a => { data[a.month - 1].total += Number(a.total) })
        return data
    }, [analyses, selectedYear])

    const departmentData = useMemo(() => {
        const deptCosts = new Map<string, number>()
        analyses.filter(a => a.year.toString() === selectedYear)
            .forEach(a => {
                const name = a.department?.name || "Sem Unidade"
                deptCosts.set(name, (deptCosts.get(name) || 0) + Number(a.total))
            })
        const sorted = Array.from(deptCosts.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        if (sorted.length <= 7) return sorted
        const top6 = sorted.slice(0, 6)
        const others = sorted.slice(6).reduce((s, c) => s + c.value, 0)
        return [...top6, { name: "Outros", value: others }]
    }, [analyses, selectedYear])

    const totalAnnual = monthlyData.reduce((s, c) => s + c.total, 0)
    const avgMonthly = totalAnnual / 12
    const maxMonth = [...monthlyData].sort((a, b) => b.total - a.total)[0]

    async function handleDelete(id: string, label: string) {
        if (!confirm(`Excluir o fechamento "${label}"? Esta ação não pode ser desfeita.`)) return
        setDeletingId(id)
        try {
            await deletePayrollAnalysis(id)
            setAnalyses(prev => prev.filter(a => a.id !== id))
            router.refresh()
        } catch (err: any) {
            alert("Erro ao excluir: " + err.message)
        } finally {
            setDeletingId(null)
        }
    }

    // ── Funcionários ──────────────────────────────────────────────────────────

    const activeEmps = useMemo(() => employees.filter(e => e.status === "ACTIVE"), [employees])

    const byGroup = useMemo(() => {
        const map = new Map<string, number>()
        activeEmps.forEach(e => {
            const g = getRoot(e.departmentId, deptMap)
            map.set(g, (map.get(g) || 0) + 1)
        })
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
    }, [activeEmps, deptMap])

    const paymentStats = useMemo(() => {
        let pago = 0, pendente = 0, atrasado = 0, lancado = 0
        activeEmps.forEach(e => {
            const p = normPag(e.pagamento)
            if (p === "efetuado" || p === "pago") pago++
            else if (p === "atrasado") atrasado++
            else if (p === "lancado") lancado++
            else pendente++
        })
        return { pago, pendente, atrasado, lancado }
    }, [activeEmps])

    const paymentPieData = [
        { name: "Recebido", value: paymentStats.pago, color: "#10b981" },
        { name: "Pendente", value: paymentStats.pendente, color: "#94a3b8" },
        { name: "Atrasado", value: paymentStats.atrasado, color: "#ef4444" },
        { name: "Lançado", value: paymentStats.lancado, color: "#f97316" },
    ].filter(d => d.value > 0)

    const byBank = useMemo(() => {
        const map = new Map<string, { pago: number; pendente: number }>()
        activeEmps.forEach(e => {
            const bank = e.bankName?.trim() || "Sem banco"
            const p = normPag(e.pagamento)
            const isPago = p === "efetuado" || p === "pago"
            if (!map.has(bank)) map.set(bank, { pago: 0, pendente: 0 })
            if (isPago) map.get(bank)!.pago++
            else map.get(bank)!.pendente++
        })
        return Array.from(map.entries())
            .map(([name, c]) => ({ name, pago: c.pago, pendente: c.pendente, total: c.pago + c.pendente }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
    }, [activeEmps])

    const totalGroups = byGroup.length
    const totalAtivos = activeEmps.length

    return (
        <div className="space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setTab("financeiro")}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                        tab === "financeiro"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Financeiro
                </button>
                <button
                    onClick={() => setTab("funcionarios")}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                        tab === "funcionarios"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Funcionários
                </button>
            </div>

            {/* ── Tab Financeiro ── */}
            {tab === "financeiro" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Análise Financeira</h2>
                            <p className="text-sm text-slate-500">Acompanhamento anual de custos da folha</p>
                        </div>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px] bg-white">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <SelectValue placeholder="Ano" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026].map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {analyses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <BarChart3 className="h-16 w-16 opacity-10 mb-4" />
                            <p className="text-sm">Realize fechamentos de folha para gerar relatórios financeiros.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KpiCard label="Custo Total Anual" value={fmtBRL(totalAnnual)} sub="Acumulado no ano" color="blue" />
                                <KpiCard label="Média Mensal" value={fmtBRL(avgMonthly)} sub="Baseado em 12 meses" color="emerald" />
                                <KpiCard label="Pico de Gasto" value={fmtBRL(maxMonth.total)} sub={`Mês de ${maxMonth.name}`} color="amber" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ChartCard title="Evolução de Custos" icon={<BarChart3 className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-50">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={fmtK} />
                                            <Tooltip content={<BRLTooltip />} cursor={{ fill: "#f8fafc" }} />
                                            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Custos por Unidade" icon={<PieIcon className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-50">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie data={departmentData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value">
                                                {departmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => fmtBRL(typeof v === "number" ? v : 0)} />
                                            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle"
                                                formatter={(val) => <span className="text-xs text-slate-600 font-medium">{val}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Últimos Fechamentos</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b">
                                                <th className="px-5 py-3">Período</th>
                                                <th className="px-5 py-3">Unidade</th>
                                                <th className="px-5 py-3 text-right">Valor Total</th>
                                                <th className="px-5 py-3 text-right">Data</th>
                                                <th className="px-5 py-3 w-10" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {analyses.map(a => {
                                                const label = `${MONTHS[a.month - 1]}/${a.year} — ${a.department?.name || "Sem Unidade"}`
                                                return (
                                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-5 py-3.5 font-medium text-slate-700">{MONTHS[a.month - 1]} / {a.year}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">{a.department?.name || <span className="text-amber-600 font-semibold">Sem Unidade</span>}</td>
                                                        <td className="px-5 py-3.5 text-right font-bold text-blue-600">{fmtBRL(Number(a.total))}</td>
                                                        <td className="px-5 py-3.5 text-right text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</td>
                                                        <td className="px-3 py-3.5 text-right">
                                                            <button
                                                                onClick={() => handleDelete(a.id, label)}
                                                                disabled={deletingId === a.id}
                                                                className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Tab Funcionários ── */}
            {tab === "funcionarios" && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Relatório de Funcionários</h2>
                        <p className="text-sm text-slate-500">Distribuição por grupo, status de pagamento e bancos</p>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                            label="Total Ativos"
                            value={totalAtivos.toString()}
                            sub="Funcionários ativos"
                            color="blue"
                            icon={<Users className="h-5 w-5 text-blue-600" />}
                        />
                        <KpiCard
                            label="Grupos"
                            value={totalGroups.toString()}
                            sub="Municípios / grupos"
                            color="indigo"
                            icon={<Building2 className="h-5 w-5 text-indigo-600" />}
                        />
                        <KpiCard
                            label="Já Receberam"
                            value={paymentStats.pago.toString()}
                            sub={`${totalAtivos > 0 ? Math.round((paymentStats.pago / totalAtivos) * 100) : 0}% do total`}
                            color="emerald"
                            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        />
                        <KpiCard
                            label="Falta Receber"
                            value={(paymentStats.pendente + paymentStats.atrasado + paymentStats.lancado).toString()}
                            sub={`${totalAtivos > 0 ? Math.round(((paymentStats.pendente + paymentStats.atrasado + paymentStats.lancado) / totalAtivos) * 100) : 0}% do total`}
                            color="amber"
                            icon={<Clock className="h-5 w-5 text-amber-600" />}
                        />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Funcionários por Grupo - ocupa 3/5 */}
                        <div className="lg:col-span-3">
                            <ChartCard title="Funcionários por Grupo" icon={<Building2 className="h-4 w-4 text-indigo-600" />} iconBg="bg-indigo-50">
                                {byGroup.length === 0 ? (
                                    <EmptyChart />
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={byGroup} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={130}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: "#374151", fontSize: 11, fontWeight: 500 }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: "#f8fafc" }}
                                                content={({ active, payload }) => active && payload?.length ? (
                                                    <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-lg">
                                                        <p className="text-xs text-slate-500 mb-0.5">{payload[0].payload.name}</p>
                                                        <p className="text-sm font-bold text-slate-900">{payload[0].value} funcionários</p>
                                                    </div>
                                                ) : null}
                                            />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                                                {byGroup.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </ChartCard>
                        </div>

                        {/* Status de Pagamento - ocupa 2/5 */}
                        <div className="lg:col-span-2">
                            <ChartCard title="Status de Pagamento" icon={<PieIcon className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-50">
                                {paymentPieData.length === 0 ? (
                                    <EmptyChart />
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                                    {paymentPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => [`${v} func.`, ""]} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="mt-3 space-y-2 px-2">
                                            {paymentPieData.map(d => (
                                                <div key={d.name} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                                        <span className="text-slate-600 font-medium">{d.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800">{d.value}</span>
                                                        <span className="text-[11px] text-slate-400">
                                                            {totalAtivos > 0 ? `${Math.round((d.value / totalAtivos) * 100)}%` : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </ChartCard>
                        </div>
                    </div>

                    {/* Charts Row 2 - Bancos */}
                    <ChartCard
                        title="Funcionários por Banco"
                        icon={<Landmark className="h-4 w-4 text-blue-600" />}
                        iconBg="bg-blue-50"
                        subtitle="Quantos já receberam e quantos faltam por banco"
                    >
                        {byBank.length === 0 ? (
                            <EmptyChart />
                        ) : (
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={byBank} margin={{ top: 10, right: 20, left: -10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#374151", fontSize: 11 }}
                                        angle={-35}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ fill: "#f8fafc" }}
                                        content={({ active, payload, label }) => active && payload?.length ? (
                                            <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-lg space-y-1">
                                                <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
                                                {payload.map(p => (
                                                    <div key={p.name} className="flex items-center gap-2 text-sm">
                                                        <span className="h-2 w-2 rounded-full" style={{ background: p.color as string }} />
                                                        <span className="text-slate-600">{p.name === "pago" ? "Já receberam" : "Falta receber"}:</span>
                                                        <span className="font-bold text-slate-800">{p.value}</span>
                                                    </div>
                                                ))}
                                                <p className="text-xs text-slate-400 border-t pt-1 mt-1">Total: {payload.reduce((s, p) => s + (Number(p.value) || 0), 0)}</p>
                                            </div>
                                        ) : null}
                                    />
                                    <Legend
                                        formatter={(val) => (
                                            <span className="text-xs text-slate-600 font-medium">
                                                {val === "pago" ? "Já receberam" : "Falta receber"}
                                            </span>
                                        )}
                                    />
                                    <Bar dataKey="pago" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={32} name="pago" />
                                    <Bar dataKey="pendente" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={32} name="pendente" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* Tabela por Grupo */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Detalhamento por Grupo</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b">
                                    <th className="px-5 py-3">Grupo</th>
                                    <th className="px-5 py-3 text-center">Total</th>
                                    <th className="px-5 py-3 text-center text-emerald-600">Receberam</th>
                                    <th className="px-5 py-3 text-center text-amber-600">Faltam</th>
                                    <th className="px-5 py-3">Progresso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {byGroup.map(g => {
                                    const groupEmps = activeEmps.filter(e => getRoot(e.departmentId, deptMap) === g.name)
                                    const pago = groupEmps.filter(e => { const p = normPag(e.pagamento); return p === "efetuado" || p === "pago" }).length
                                    const falta = g.count - pago
                                    const pct = g.count > 0 ? Math.round((pago / g.count) * 100) : 0
                                    return (
                                        <tr key={g.name} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5 font-semibold text-slate-700">{g.name}</td>
                                            <td className="px-5 py-3.5 text-center font-bold text-slate-800">{g.count}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                                                    {pago}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                                    falta > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                                                }`}>
                                                    {falta}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-500 w-8 text-right">{pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
    label, value, sub, color, icon,
}: {
    label: string; value: string; sub: string; color: string; icon?: React.ReactNode
}) {
    const colorMap: Record<string, string> = {
        blue: "bg-blue-50 border-blue-100",
        emerald: "bg-emerald-50 border-emerald-100",
        amber: "bg-amber-50 border-amber-100",
        indigo: "bg-indigo-50 border-indigo-100",
    }
    return (
        <div className={`rounded-xl border p-5 shadow-sm ${colorMap[color] ?? "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                {icon}
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
    )
}

function ChartCard({
    title, icon, iconBg, subtitle, children,
}: {
    title: string; icon: React.ReactNode; iconBg: string; subtitle?: string; children: React.ReactNode
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
                <div>
                    <h3 className="font-bold text-slate-800">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    )
}

function BRLTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">{payload[0].payload.name}</p>
            <p className="text-sm font-bold text-slate-900">{fmtBRL(Number(payload[0].value))}</p>
        </div>
    )
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center h-[200px] text-slate-300">
            <p className="text-sm">Sem dados para exibir</p>
        </div>
    )
}
