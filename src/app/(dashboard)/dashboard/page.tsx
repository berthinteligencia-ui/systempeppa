import {
  Wallet, Users, ClipboardCheck, TrendingUp,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle2, ChevronDown, Download,
  FileText, Landmark, ClipboardList, CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getDashboardData } from "@/lib/actions/dashboard"
import { listNotasFiscais } from "@/lib/actions/nfs"
import { cn } from "@/lib/utils"

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

  const [data, nfs] = await Promise.all([
    getDashboardData(month, year),
    listNotasFiscais(),
  ])

  if (!data) return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-bold text-slate-800">Dados não disponíveis</h2>
      <p className="text-slate-500 max-w-md mt-2">Não foi possível carregar os dados do painel executivo. Verifique sua conexão ou se você possui uma empresa associada.</p>
    </div>
  )

  const { kpis: metrics, unitList, alerts, period } = data

  const kpis: { title: string; value: string; trend?: string; trendLabel?: string; up?: boolean; icon: any; iconBg: string; iconColor: string; subtitle?: string; progress?: number }[] = [
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
      title: "PAGAMENTOS PENDENTES",
      value: `${metrics.pendingPaymentsCount}`,
      subtitle: "Colaboradores com pagamento em aberto",
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
        {kpis.map((kpi) => {
          const isMainKpi = kpi.title === "Custo Total"
          return (
            <div 
              key={kpi.title} 
              className={cn(
                "rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group",
                isMainKpi ? "xl:col-span-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30" : "border-slate-100"
              )}
            >
              {isMainKpi && (
                <div className="absolute -right-6 -top-6 size-24 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-colors" />
              )}
              
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">{kpi.title}</p>
                  <p className={cn(
                    "font-black text-slate-900 tracking-tight",
                    isMainKpi ? "text-4xl" : "text-2xl"
                  )}>{kpi.value}</p>
                  {kpi.subtitle && <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-wide">{kpi.subtitle}</p>}
                </div>
                <div className={cn(
                  "rounded-2xl p-3 shrink-0 shadow-sm transition-transform group-hover:scale-110",
                  kpi.iconBg,
                  isMainKpi && "size-14 flex items-center justify-center p-0"
                )}>
                  <kpi.icon className={cn(
                    kpi.iconColor,
                    isMainKpi ? "h-7 w-7" : "h-5 w-5"
                  )} />
                </div>
              </div>

              {kpi.progress !== undefined ? (
                <div className="mt-6 space-y-2 relative z-10">
                  <Progress value={kpi.progress} className="h-2 bg-slate-100" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.progress}% concluído</p>
                </div>
              ) : kpi.trend ? (
                <div className="mt-6 flex items-center gap-2 relative z-10">
                  <div className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5",
                    kpi.up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {kpi.up ? <ArrowUpRight className="h-3 w-3 stroke-[3]" /> : <ArrowDownRight className="h-3 w-3 stroke-[3]" />}
                    <span className="text-xs font-black uppercase">{kpi.trend}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{kpi.trendLabel}</span>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-2 relative z-10">
                  <div className="size-5 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{kpi.trendLabel}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Table + Alerts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 bg-white">
            <h3 className="font-semibold text-slate-800">Notas Fiscais</h3>
            <a href="/nfs" className="text-sm font-semibold text-blue-600 hover:underline">Ver todas</a>
          </div>
          <div className="overflow-x-auto">
            {nfs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FileText className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhuma nota fiscal cadastrada</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 w-52">Unidade / Código</th>
                    <th className="px-5 py-3">Fluxo de Processamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {nfs.map((nf) => {
                    // step 1 = criada | step 2+3 = analisada | step 4+5 = aprovada/paga
                    const paga    = nf.status === "APROVADA" || nf.status === "ANALISADA"
                    const fechada = nf.status === "ANALISADA"
                    const idx = nf.emitente.indexOf(" - ")
                    const tomador = idx === -1 ? nf.emitente : nf.emitente.slice(0, idx)
                    const ic  = (on: boolean) => on ? "text-blue-600" : "text-slate-300"
                    const ln  = (on: boolean) => `flex-1 h-0.5 mx-1 ${on ? "bg-blue-600" : "bg-slate-200"}`
                    return (
                      <tr key={nf.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{tomador}</p>
                          <p className="text-xs text-slate-400 font-mono">#{nf.numero}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center">
                            <FileText className={`h-5 w-5 shrink-0 ${ic(true)}`} />
                            <div className={ln(paga)} />
                            <Landmark className={`h-5 w-5 shrink-0 ${ic(paga)}`} />
                            <div className={ln(fechada)} />
                            <ClipboardList className={`h-5 w-5 shrink-0 ${ic(fechada)}`} />
                            <div className={ln(false)} />
                            <CreditCard className={`h-5 w-5 shrink-0 ${ic(false)}`} />
                            <div className={ln(false)} />
                            <CheckCircle2 className={`h-5 w-5 shrink-0 ${ic(false)}`} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
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
    </div>
  )
}
