import {
  Wallet, Users, ClipboardCheck, TrendingUp,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle2, ChevronDown, Download, Bell, Calendar,
  Search, LayoutDashboard, Building2, BarChart3,
  Settings, LogOut, Landmark,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Unidades", icon: Building2 },
  { label: "Alertas Financeiros", icon: AlertTriangle },
  { label: "Relatórios", icon: BarChart3 },
]
const adminNav = [
  { label: "Configurações", icon: Settings },
  { label: "Usuários", icon: Users },
]

const kpis = [
  { title: "CUSTO TOTAL EMPRESA", value: "R$ 2.450.000,00", trend: "+0.5%", trendLabel: "vs mês anterior", up: true, icon: Wallet, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  { title: "TOTAL DE COLABORADORES", value: "1.240", trend: "-1.2%", trendLabel: "turnover líquido", up: false, icon: Users, iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
  { title: "FECHAMENTO DE CENTROS", value: "45", subtitle: "12 pendentes", progress: 79, icon: ClipboardCheck, iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  { title: "VARIAÇÃO DE ORÇAMENTO", value: "+2,4%", trendLabel: "Dentro da meta anual", up: true, icon: TrendingUp, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
]

const units = [
  { name: "Tecnologia e Inovação", code: "CC-2041-TI", manager: "Ricardo Mendes", status: "FECHADO", headcount: 142, cost: "R$ 540.200" },
  { name: "Recursos Humanos", code: "CC-5010-RH", manager: "Ana Ferreira", status: "PENDENTE", headcount: 38, cost: "R$ 184.320" },
  { name: "Marketing Digital", code: "CC-3312-MK", manager: "Felipe Costa", status: "PENDENTE", headcount: 55, cost: "R$ 267.800" },
  { name: "Operações", code: "CC-1100-OP", manager: "Carla Souza", status: "FECHADO", headcount: 312, cost: "R$ 895.600" },
]

const alerts = [
  { type: "ESTOURO DE VERBA", time: "Há 2h", message: "Marketing Digital excedeu o orçamento em 15% neste período.", borderColor: "border-red-500", bg: "bg-red-50", badge: "bg-red-100 text-red-700" },
  { type: "FECHAMENTO PENDENTE", time: "Há 5h", message: "O CC-5010-RH ainda não validou a folha de pagamento.", borderColor: "border-amber-500", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  { type: "DIVERGÊNCIA SALARIAL", time: "Há 1d", message: "Detectada divergência de R$ 3.200 no CC-1100-OP.", borderColor: "border-orange-500", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700" },
]

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

export default function PreviewDashboard() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex h-screen w-64 flex-col" style={{ backgroundColor: "#152138" }}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">PEPACORP</p>
            <p className="text-[10px] text-slate-400 font-medium">Controle Financeiro</p>
          </div>
        </div>
        <div className="mx-4 border-t border-white/10" />
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {mainNav.map(({ label, icon: Icon, active }) => (
            <span key={label} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </span>
          ))}
          <p className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Administração</p>
          {adminNav.map(({ label, icon: Icon }) => (
            <span key={label} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white">
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </span>
          ))}
        </nav>
        <div className="mx-4 border-t border-white/10" />
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-blue-600 text-xs text-white">CS</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-white">Carlos Silva</p>
            <p className="truncate text-xs text-slate-400">Diretor Financeiro</p>
          </div>
          <LogOut className="h-4 w-4 text-slate-400" />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h1 className="text-lg font-semibold text-slate-800">Dashboard Executivo</h1>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar por unidade ou código" className="w-64 pl-9 text-sm" />
            </div>
            <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">3</span>
            </button>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Calendar className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Visão Geral Corporativa</h2>
                <p className="text-sm text-slate-500">Consolidado de todas as unidades de negócio</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  Competência: Out/2023 <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  Unidade: Todos <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.title} className="rounded-xl border bg-white p-5 shadow-sm">
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
                    <div className="mt-3 space-y-1">
                      <Progress value={kpi.progress} className="h-1.5" />
                      <p className="text-xs text-slate-400">{kpi.progress}% concluído</p>
                    </div>
                  ) : kpi.trend ? (
                    <div className="mt-3 flex items-center gap-1">
                      {kpi.up ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                      <span className={`text-sm font-medium ${kpi.up ? "text-emerald-600" : "text-red-600"}`}>{kpi.trend}</span>
                      <span className="text-xs text-slate-400">{kpi.trendLabel}</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-slate-400">{kpi.trendLabel}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Table + Alerts */}
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="font-semibold text-slate-800">Listagem de Unidades</h3>
                  <Badge variant="secondary">{units.length} unidades</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Unidade / Código</th>
                        <th className="px-5 py-3">Responsável</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Headcount</th>
                        <th className="px-5 py-3 text-right">Custo Mensal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {units.map((u) => (
                        <tr key={u.code} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.code}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{u.manager}</td>
                          <td className="px-5 py-3.5"><StatusBadge status={u.status} /></td>
                          <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-700">{u.headcount}</td>
                          <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-800">{u.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h3 className="font-semibold text-slate-800">Alertas Financeiros</h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{alerts.length}</span>
                </div>
                <div className="divide-y">
                  {alerts.map((a) => (
                    <div key={a.type} className={`border-l-4 p-4 ${a.borderColor} ${a.bg}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${a.badge}`}>{a.type}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{a.time}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{a.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
