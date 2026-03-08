"use client"

import { useMemo, useState } from "react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts"
import {
    BarChart3, TrendingUp, PieChart as PieIcon, Calendar,
    ArrowUpRight, ArrowDownRight, FileText, Download, Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

// --- Types ---
type Department = { id: string; name: string }
type PayrollAnalysis = {
    id: string
    month: number
    year: number
    total: number
    departmentId: string | null
    createdAt: string
    department?: { name: string } | null
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

const MONTHS = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]

export function RelatoriosClient({
    analyses,
    departments
}: {
    analyses: PayrollAnalysis[]
    departments: Department[]
}) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

    // --- Data Transformation ---

    // 1. Monthly Evolution Data
    const monthlyData = useMemo(() => {
        const data = Array.from({ length: 12 }, (_, i) => ({
            name: MONTHS[i],
            total: 0,
            month: i + 1
        }))

        analyses
            .filter(a => a.year.toString() === selectedYear)
            .forEach(a => {
                data[a.month - 1].total += Number(a.total)
            })

        return data
    }, [analyses, selectedYear])

    // 2. Department Cost Distribution (Top 7 + Others)
    const departmentData = useMemo(() => {
        const deptMap = new Map<string, number>()

        analyses
            .filter(a => a.year.toString() === selectedYear)
            .forEach(a => {
                const name = a.department?.name || "Sem Unidade"
                deptMap.set(name, (deptMap.get(name) || 0) + Number(a.total))
            })

        const sorted = Array.from(deptMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)

        if (sorted.length <= 7) return sorted

        const top6 = sorted.slice(0, 6)
        const others = sorted.slice(6).reduce((acc, curr) => acc + curr.value, 0)
        return [...top6, { name: "Outros", value: others }]
    }, [analyses, selectedYear])

    // 3. Stats
    const totalAnnual = monthlyData.reduce((acc, curr) => acc + curr.total, 0)
    const avgMonthly = totalAnnual / 12
    const maxMonth = [...monthlyData].sort((a, b) => b.total - a.total)[0]

    const formatBRL = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

    if (analyses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <BarChart3 className="h-16 w-16 opacity-10 mb-4" />
                <h3 className="text-lg font-medium">Nenhum dado para exibir</h3>
                <p className="text-sm">Realize fechamentos de folha para gerar relatórios.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header & Filter */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Análise de Desempenho</h2>
                    <p className="text-sm text-slate-500">Acompanhamento anual de custos e indicadores</p>
                </div>
                <div className="flex items-center gap-3">
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
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" /> Exportar
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Custo Total Anual</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-900">{formatBRL(totalAnnual)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                        <TrendingUp className="h-3 w-3" />
                        <span>Consumo conforme planejado</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Média Mensal</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-900">{formatBRL(avgMonthly)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Baseado em 12 meses</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pico de Gasto</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-900">{formatBRL(maxMonth.total)}</span>
                        <span className="text-xs font-medium text-slate-500 pb-1">em {maxMonth.name}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Mês com maior volume</p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Bar Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">Evolução de Custos</h3>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    tickFormatter={(v) => `R$ ${v / 1000}k`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl">
                                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">{payload[0].payload.name}</p>
                                                    <p className="text-sm font-bold text-slate-900">{formatBRL(Number(payload[0].value))}</p>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                />
                                <Bar
                                    dataKey="total"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                    barSize={30}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Department Pie Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <PieIcon className="h-4 w-4 text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">Custos por Unidade</h3>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={departmentData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {departmentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v) => formatBRL(typeof v === 'number' ? v : 0)}
                                />
                                <Legend
                                    layout="vertical"
                                    align="right"
                                    verticalAlign="middle"
                                    iconType="circle"
                                    formatter={(val) => <span className="text-xs text-slate-600 font-medium">{val}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* History Table Summary */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {analyses.slice(0, 5).map((a) => (
                                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-slate-700">
                                        {MONTHS[a.month - 1]} / {a.year}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-500">
                                        {a.department?.name || "Sem Unidade"}
                                    </td>
                                    <td className="px-5 py-3.5 text-right font-bold text-blue-600">
                                        {formatBRL(Number(a.total))}
                                    </td>
                                    <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                                        {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
