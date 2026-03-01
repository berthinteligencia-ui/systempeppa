import {
  Wallet, Users, ClipboardCheck, TrendingUp,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle2, ChevronDown, Download,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getDashboardData } from "@/lib/actions/dashboard"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function StatusBadge({ status }: { status: string }) {
  if (status === "FECHADO") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Fechado
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Pendente
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const month = params.month ? Number(params.month) : undefined
  const year = params.year ? Number(params.year) : undefined

  const data = await getDashboardData(month, year)

  if (!data) return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-bold text-slate-800">Dados não disponíveis</h2>
      <p className="text-slate-500 max-w-md mt-2">Não foi possível carregar os dados do painel executivo. Verifique sua conexão ou se você possui uma empresa associada.</p>
    </div>
  )

  const { kpis: metrics, unitList, alerts, period } = data

  const kpis = [
    {
      title: "CUSTO TOTAL EMPRESA",
      value: fmtBRL(metrics.totalCost),
      trend: metrics.variation > 0 ? `+${metrics.variation.toFixed(1)}%` : `${metrics.variation.toFixed(1)}%`,
      trendLabel: "vs mês anterior",
      up: metrics.variation >= 0,
      icon: Wallet,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "TOTAL DE COLABORADORES",
      value: metrics.totalEmployees.toLocaleString("pt-BR"),
      trendLabel: "colaboradores ativos",
      icon: Users,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600"
    },
    {
      title: "FECHAMENTO DE UNIDADES",
      value: `${metrics.unitClosings}`,
      subtitle: `${metrics.totalUnits - metrics.unitClosings} pendentes`,
      progress: metrics.closingProgress,
      icon: ClipboardCheck,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600"
    },
    {
      title: "STATUS FINANCEIRO",
      value: metrics.closingProgress === 100 ? "CONCLUÍDO" : "EM ANDAMENTO",
      trendLabel: metrics.closingProgress === 100 ? "Tudo verificado" : "Aguardando unidades",
      icon: TrendingUp,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600"
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Visão Geral Corporativa</h2>
          <p className="text-sm text-slate-500">Consolidado de todas as unidades de negócio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            Competência: {MESES[period.month - 1]} / {period.year} <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            Unidade: Todas <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kpi.title}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{kpi.value}</p>
                {kpi.subtitle && <p className="mt-0.5 text-sm text-slate-500">{kpi.subtitle}</p>}
              </div>
              <div className={`rounded-lg p-2.5 ${kpi.iconBg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </div>
            {kpi.progress !== undefined ? (
              <div className="mt-4 space-y-1.5">
                <Progress value={kpi.progress} className="h-1.5 bg-slate-100" />
                <p className="text-xs font-medium text-slate-500">{kpi.progress}% concluído</p>
              </div>
            ) : kpi.trend ? (
              <div className="mt-4 flex items-center gap-1">
                {kpi.up ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                <span className={`text-sm font-bold ${kpi.up ? "text-emerald-600" : "text-red-600"}`}>{kpi.trend}</span>
                <span className="text-xs text-slate-400 font-medium ml-1">{kpi.trendLabel}</span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-slate-400 font-medium">{kpi.trendLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table + Alerts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 bg-white">
            <h3 className="font-semibold text-slate-800">Listagem de Unidades</h3>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">{unitList.length} unidades</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Unidade / Código</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Colaboradores</th>
                  <th className="px-5 py-3 text-right">Custo Mensal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unitList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{u.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{u.code}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-600">{u.headcount}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-bold text-slate-800">
                      {u.cost > 0 ? fmtBRL(u.cost) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm overflow-hidden h-fit">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-semibold text-slate-800">Alertas e Notificações</h3>
            {alerts.length > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">{alerts.length}</span>}
          </div>
          <div className="divide-y max-h-[500px] overflow-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-20" />
                <p className="text-sm text-slate-400">Nenhum alerta crítico encontrado.</p>
              </div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className={`border-l-4 p-4 ${a.borderColor} ${a.bg} transition-colors hover:bg-opacity-80`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${a.badge}`}>{a.type}</span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">{a.time}</span>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
