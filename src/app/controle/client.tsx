"use client"

import { useState } from "react"
import { controleLogout, getCompanyDetails } from "@/lib/actions/controle"
import { useRouter } from "next/navigation"
import {
    Building2, Users, UserCheck, Activity, LogOut,
    TrendingUp, CheckCircle2, XCircle, Search,
    BarChart3, Clock, RefreshCw, ChevronLeft,
    FileText, Banknote, HardDrive,
    LayoutGrid, ArrowRight, Mail, Phone, MapPin,
    CalendarDays, DollarSign, Briefcase, Loader2,
    Landmark, ClipboardList, CreditCard,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
    id: string; name: string; cnpj: string | null; email: string | null
    city: string | null; state: string | null; active: boolean; createdAt: string
    whatsapp?: string | null; address?: string | null
}
type Log = { id: string; user_name: string; action: string; target: string | null; created_at: string }
type Stats = {
    totalCompanies: number; activeCompanies: number; totalUsers: number
    totalEmployees: number; activeEmployees: number
    roleCount: Record<string, number>
    companiesByDay: { day: string; count: number }[]
    recentCompanies: Company[]; recentLogs: Log[]
    allCompanies: Company[]
}
type CompanyDetails = Awaited<ReturnType<typeof getCompanyDetails>>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}
function fmtDay(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR")
}
function fmtBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtBytes(b: number) {
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB"
    if (b >= 1024) return (b / 1024).toFixed(1) + " KB"
    return b + " B"
}

const ACTION_LABELS: Record<string, string> = {
    PAGE_VIEW: "Visualizou", SAVE_SETTINGS: "Config.", RUN_BACKUP: "Backup", LOGIN: "Login", LOGOUT: "Logout",
}
const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin", RH: "RH", GESTOR: "Gestor", FUNCIONARIO: "Func."
}
const NF_STATUS: Record<string, { label: string; color: string }> = {
    PENDENTE: { label: "Pendente", color: "text-amber-700 bg-amber-50 border border-amber-200" },
    ANALISADA: { label: "Analisada", color: "text-blue-700 bg-blue-50 border border-blue-200" },
    APROVADA: { label: "Aprovada", color: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
    REJEITADA: { label: "Rejeitada", color: "text-red-700 bg-red-50 border border-red-200" },
}
const EMP_STATUS: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: "Ativo", color: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
    INACTIVE: { label: "Inativo", color: "text-red-700 bg-red-50 border border-red-200" },
    ON_LEAVE: { label: "Afastado", color: "text-amber-700 bg-amber-50 border border-amber-200" },
}

// ─── Small components ─────────────────────────────────────────────────────────

function Metric({ label, value, sub, icon: Icon, color }: { label: string; value: number | string; sub?: string; icon: any; color: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100`}>
                <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                {sub && <p className="text-[10px] text-slate-400 truncate">{sub}</p>}
            </div>
        </div>
    )
}

function Badge({ label, color, className }: { label: string; color: string; className?: string }) {
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color} ${className}`}>{label}</span>
}

// ─── Company Detail Panel ─────────────────────────────────────────────────────

type DetailTab = "overview" | "finance" | "users" | "employees" | "departments" | "nfs" | "payroll" | "backups" | "logs"

function CompanyDetailPanel({ details, onBack }: { details: CompanyDetails; onBack: () => void }) {
    const [tab, setTab] = useState<DetailTab>("overview")
    const c = details.company!

    const tabs: { id: DetailTab; label: string; icon: any; count?: number }[] = [
        { id: "overview", label: "Geral", icon: LayoutGrid },
        { id: "finance", label: "Financeiro", icon: Banknote },
        { id: "users", label: "Usuários", icon: Users, count: details.users.length },
        { id: "employees", label: "Funcionários", icon: UserCheck, count: details.employees.length },
        { id: "departments", label: "Unidades", icon: Briefcase, count: details.departments.length },
        { id: "nfs", label: "NFs", icon: FileText, count: details.nfs.length },
        { id: "payroll", label: "Folha", icon: Banknote, count: details.payrolls.length },
        { id: "backups", label: "Backups", icon: HardDrive, count: details.backups.length },
        { id: "logs", label: "Logs", icon: Activity, count: details.logs.length },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b bg-white backdrop-blur-md sticky top-0 z-10">
                <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-[13px] font-semibold transition shrink-0 py-1.5 pr-2">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Voltar</span>
                </button>
                <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 shadow-sm">
                        <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-900 truncate uppercase tracking-tight">{c.name}</p>
                        {c.cnpj && <p className="text-[10px] text-slate-500 font-mono hidden sm:block leading-none mt-0.5">{c.cnpj}</p>}
                    </div>
                </div>
                <div className="ml-auto shrink-0">
                    {c.active
                        ? <Badge label="Ativa" color="text-emerald-600 bg-emerald-50 border border-emerald-100" />
                        : <Badge label="Inativa" color="text-red-600 bg-red-50 border border-red-100" />
                    }
                </div>
            </div>

            {/* Tabs - horizontal scroll on mobile */}
            <div className="flex border-b bg-white overflow-x-auto scrollbar-none px-2 shrink-0">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-3.5 text-[12px] font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap -mb-px shrink-0 ${tab === t.id
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                            }`}
                    >
                        <t.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden text-[10px]">{t.label.slice(0, 5)}</span>
                        {t.count !== undefined && (
                            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

                {/* Overview */}
                {tab === "overview" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Metric label="Usuários" value={details.users.length} icon={Users} color="bg-blue-600" />
                            <Metric label="Funcionários" value={details.employees.filter(e => e.status === "ACTIVE").length} sub={`${details.employees.length} total`} icon={UserCheck} color="bg-violet-600" />
                            <Metric label="Notas Fiscais" value={details.nfs.length} icon={FileText} color="bg-amber-600" />
                            <Metric label="Folha mensal" value={fmtBRL(details.totalSalary)} icon={DollarSign} color="bg-emerald-600" />
                        </div>

                        {/* ── Fluxos de Processamento em Andamento ── */}
                        {(() => {
                            const activeNfs = details.nfs
                                .filter(n => n.status === "PENDENTE" || n.status === "ANALISADA")
                                .slice(0, 6)

                            const ic = (on: boolean) => on ? "text-blue-600" : "text-slate-300"
                            const ln = (on: boolean) => `flex-1 h-0.5 mt-2.5 mx-1 ${on ? "bg-blue-500" : "bg-slate-200"}`
                            return (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="relative flex h-2.5 w-2.5 shrink-0">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                                        </div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">
                                            Fluxos de Processamento em Andamento
                                        </p>
                                        {activeNfs.length > 0 && (
                                            <span className="ml-auto rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                                {activeNfs.length} NF{activeNfs.length !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>

                                    {activeNfs.length === 0 ? (
                                        <div className="flex items-center gap-2.5 py-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <p className="text-[13px] text-slate-600">Nenhum processamento em andamento</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {activeNfs.map(nf => {
                                                const s2 = nf.status === "ANALISADA" || nf.status === "APROVADA"
                                                const s3 = nf.status === "ANALISADA" || nf.status === "APROVADA"
                                                const s4 = nf.status === "APROVADA"
                                                const s5 = nf.status === "APROVADA"
                                                return (
                                                    <div key={nf.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                                        <div className="flex items-center justify-between gap-3 mb-3">
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-bold text-slate-900 truncate">{nf.emitente}</p>
                                                                <p className="text-[10px] text-blue-600 font-mono font-semibold">NF {nf.numero} · {fmtDay(nf.dataEmissao)}</p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-[12px] text-slate-800 font-mono font-bold">{fmtBRL(Number(nf.valor))}</p>
                                                                <Badge
                                                                    label={NF_STATUS[nf.status]?.label ?? nf.status}
                                                                    color={NF_STATUS[nf.status]?.color ?? "text-slate-600 bg-slate-100 border border-slate-200"}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Pipeline stepper com legendas alinhadas */}
                                                        <div className="flex items-start">
                                                            <div className="flex flex-col items-center shrink-0">
                                                                <FileText className={`h-5 w-5 ${ic(true)}`} />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide mt-1">NF</span>
                                                            </div>
                                                            <div className={ln(s2)} />
                                                            <div className="flex flex-col items-center shrink-0">
                                                                <Landmark className={`h-5 w-5 ${ic(s2)}`} />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide mt-1">Banco</span>
                                                            </div>
                                                            <div className={ln(s3)} />
                                                            <div className="flex flex-col items-center shrink-0">
                                                                <ClipboardList className={`h-5 w-5 ${ic(s3)}`} />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide mt-1">Folha</span>
                                                            </div>
                                                            <div className={ln(s4)} />
                                                            <div className="flex flex-col items-center shrink-0">
                                                                <CreditCard className={`h-5 w-5 ${ic(s4)}`} />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide mt-1">Pgto.</span>
                                                            </div>
                                                            <div className={ln(s5)} />
                                                            <div className="flex flex-col items-center shrink-0">
                                                                <CheckCircle2 className={`h-5 w-5 ${ic(s5)}`} />
                                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide mt-1">Final</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Informações</p>
                            {[
                                { icon: Mail, label: "E-mail", value: c.email },
                                { icon: Phone, label: "WhatsApp", value: c.whatsapp },
                                { icon: MapPin, label: "Cidade", value: c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : null },
                                { icon: MapPin, label: "Endereço", value: c.address },
                                { icon: CalendarDays, label: "Cadastro", value: fmtDay(c.createdAt) },
                            ].filter(x => x.value).map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-start gap-2.5 text-[13px]">
                                    <Icon className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                    <span className="text-slate-500 font-medium shrink-0">{label}:</span>
                                    <span className="text-slate-900 font-semibold break-all">{value}</span>
                                </div>
                            ))}
                        </div>

                        {details.settings && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Configurações</p>
                                <div className="space-y-2">
                                    {[
                                        { label: "Notif. WhatsApp", value: details.settings.whatsappNotifications },
                                        { label: "Backup automático", value: details.settings.autoBackup },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex items-center gap-2 text-[13px]">
                                            {value ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
                                            <span className={value ? "text-slate-900 font-semibold" : "text-slate-400"}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Finance dashboard */}
                {tab === "finance" && (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="h-4 w-4 text-blue-600" />
                                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Plano e Assinatura</p>
                            </div>
                            
                            {!details.subscription ? (
                                <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
                                    <p className="text-[13px] text-slate-500 font-medium">Nenhum plano vinculado</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-lg font-black text-slate-900 leading-none">{(details.subscription as any).plan?.name}</p>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Plano Atual</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-blue-600 leading-none">
                                                {details.invoices && (details.invoices as any[]).length > 0 
                                                    ? fmtBRL(Number((details.invoices as any[])[0].amount))
                                                    : fmtBRL(Number((details.subscription as any).plan?.basePrice + ((details.subscription as any).plan?.pricePerEmployee * details.employees.filter(e => e.status === "ACTIVE").length)))
                                                }
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Valor do Mês</p>
                                        </div>
                                    </div>

                                    {details.invoices && (details.invoices as any[]).some(inv => inv.status === 'PENDING') ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                                <Clock className="h-4 w-4 text-amber-600" />
                                                <p className="text-[12px] font-bold text-amber-700">Fatura pendente aguardando pagamento</p>
                                            </div>
                                            <button 
                                                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-blue-200"
                                                onClick={() => {
                                                    const pending = (details.invoices as any[]).find(inv => inv.status === 'PENDING');
                                                    alert(`Emitir fatura: ID ${pending.id} - Valor: ${fmtBRL(Number(pending.amount))}`);
                                                }}
                                            >
                                                Emitir Pagamento
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            <p className="text-[12px] font-bold text-emerald-700">Assinatura em dia</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <p className="p-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 border-b">Histórico de Faturas</p>
                            <div className="divide-y">
                                {(details.invoices as any[] || []).map(inv => (
                                    <div key={inv.id} className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-[13px] font-bold text-slate-900">{String(inv.month).padStart(2, '0')}/{inv.year}</p>
                                            <p className="text-[11px] text-slate-500 font-mono">ID: {inv.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[13px] font-black text-slate-900">{fmtBRL(Number(inv.amount))}</p>
                                            <Badge 
                                                label={inv.status === 'PAID' ? 'Pago' : 'Pendente'} 
                                                color={inv.status === 'PAID' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'} 
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(!details.invoices || (details.invoices as any[]).length === 0) && (
                                    <p className="p-8 text-center text-[13px] text-slate-500">Nenhuma fatura encontrada</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {tab === "users" && (
                    <div className="space-y-2">
                        {details.users.length === 0 && <p className="text-center text-slate-500 py-8 text-[13px]">Sem usuários</p>}
                        {details.users.map(u => (
                            <div key={u.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[13px] font-bold">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold text-slate-900 truncate">{u.name}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge label={ROLE_LABELS[u.role] ?? u.role} color="text-blue-700 bg-blue-50 border border-blue-200" />
                                    {u.active
                                        ? <Badge label="Ativo" color="text-emerald-700 bg-emerald-50 border border-emerald-200" />
                                        : <Badge label="Inativo" color="text-red-700 bg-red-50 border border-red-200" />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Employees */}
                {tab === "employees" && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-3 py-2.5">
                                <p className="text-base font-bold text-slate-900">{details.employees.length}</p>
                                <p className="text-[10px] text-slate-500">Total</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-3 py-2.5">
                                <p className="text-base font-bold text-emerald-600">{details.employees.filter(e => e.status === "ACTIVE").length}</p>
                                <p className="text-[10px] text-slate-500">Ativos</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-3 py-2.5">
                                <p className="text-[13px] font-bold text-slate-800">{fmtBRL(details.totalSalary)}</p>
                                <p className="text-[10px] text-slate-500">Folha</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {details.employees.map(e => {
                                const st = EMP_STATUS[e.status] ?? { label: e.status, color: "text-slate-600 bg-slate-100 border border-slate-200" }
                                return (
                                    <div key={e.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-bold text-slate-900">{e.name}</p>
                                                <p className="text-[11px] text-slate-500">{e.position} · {e.departmentName}</p>
                                            </div>
                                            <Badge label={st.label} color={st.color} />
                                        </div>
                                        <p className="text-[12px] text-slate-700 font-mono mt-1">{fmtBRL(Number(e.salary))}</p>
                                    </div>
                                )
                            })}
                            {details.employees.length === 0 && <p className="text-center text-slate-500 py-8 text-[13px]">Sem funcionários</p>}
                        </div>
                    </div>
                )}

                {/* Departments */}
                {tab === "departments" && (
                    <div className="space-y-2">
                        {details.departments.map(d => {
                            const empCount = details.employees.filter(e => e.departmentId === d.id).length
                            return (
                                <div key={d.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-bold text-slate-900">{d.name}</p>
                                        {d.cnpj && <p className="text-[11px] text-slate-500 font-mono">{d.cnpj}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[13px] font-bold text-slate-900">{empCount}</p>
                                        <p className="text-[10px] text-slate-500">funcionários</p>
                                    </div>
                                </div>
                            )
                        })}
                        {details.departments.length === 0 && <p className="text-center text-slate-600 py-8 text-[13px]">Sem unidades</p>}
                    </div>
                )}

                {/* Notas Fiscais */}
                {tab === "nfs" && (
                    <div className="space-y-2">
                        {details.nfs.map(n => {
                            const st = NF_STATUS[n.status] ?? { label: n.status, color: "text-slate-600 bg-slate-100 border border-slate-200" }
                            return (
                                <div key={n.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-blue-600 font-mono font-semibold">NF {n.numero}</p>
                                            <p className="text-[13px] font-bold text-slate-900 truncate">{n.emitente}</p>
                                        </div>
                                        <Badge label={st.label} color={st.color} />
                                    </div>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <p className="text-[12px] text-slate-800 font-mono font-semibold">{fmtBRL(Number(n.valor))}</p>
                                        <p className="text-[11px] text-slate-500">{fmtDay(n.dataEmissao)}</p>
                                    </div>
                                </div>
                            )
                        })}
                        {details.nfs.length === 0 && <p className="text-center text-slate-600 py-8 text-[13px]">Sem notas fiscais</p>}
                    </div>
                )}

                {/* Payroll */}
                {tab === "payroll" && (
                    <div className="space-y-2">
                        {details.payrolls.map(p => (
                            <div key={p.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[14px] font-bold text-slate-900">{String(p.month).padStart(2, "0")}/{p.year}</p>
                                    <Badge label={p.status === "OPEN" ? "Aberto" : "Fechado"} color={p.status === "OPEN" ? "text-blue-700 bg-blue-50 border border-blue-200" : "text-emerald-700 bg-emerald-50 border border-emerald-200"} />
                                </div>
                                <p className="text-[13px] text-slate-800 font-mono font-bold">{fmtBRL(Number(p.total))}</p>
                            </div>
                        ))}
                        {details.payrolls.length === 0 && <p className="text-center text-slate-600 py-8 text-[13px]">Sem análises de folha</p>}
                    </div>
                )}

                {/* Backups */}
                {tab === "backups" && (
                    <div className="space-y-2">
                        {details.backups.map(b => (
                            <div key={b.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] text-slate-700 font-mono truncate">{b.fileName}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(b.createdAt)}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge label={b.status === "SUCCESS" ? "OK" : b.status} color={b.status === "SUCCESS" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-red-700 bg-red-50 border border-red-200"} />
                                    <p className="text-[10px] text-slate-500">{fmtBytes(b.fileSize)}</p>
                                </div>
                            </div>
                        ))}
                        {details.backups.length === 0 && <p className="text-center text-slate-600 py-8 text-[13px]">Sem backups</p>}
                    </div>
                )}

                {/* Logs */}
                {tab === "logs" && (
                    <div className="space-y-2">
                        {details.logs.map(log => (
                            <div key={log.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13px] text-slate-900 font-bold">{log.user_name}</p>
                                    <Badge label={ACTION_LABELS[log.action] ?? log.action} color="text-blue-700 bg-blue-50 border border-blue-200" />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    <p className="text-[11px] text-slate-500">{fmtDate(log.created_at)}</p>
                                    {log.target && <p className="text-[11px] text-slate-400 truncate">· {log.target}</p>}
                                </div>
                            </div>
                        ))}
                        {details.logs.length === 0 && <p className="text-center text-slate-600 py-8 text-[13px]">Sem logs</p>}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

type MainTab = "dashboard" | "companies" | "logs"

export function ControleClient({ stats }: { stats: Stats }) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [mainTab, setMainTab] = useState<MainTab>("dashboard")
    const [refreshing, setRefreshing] = useState(false)
    const [selectedDetails, setSelectedDetails] = useState<CompanyDetails | null>(null)
    const [loadingCompanyId, setLoadingCompanyId] = useState<string | null>(null)

    async function handleLogout() {
        await controleLogout()
        router.push("/controle/login")
    }

    function handleRefresh() {
        setRefreshing(true)
        router.refresh()
        setTimeout(() => setRefreshing(false), 1200)
    }

    async function handleSelectCompany(companyId: string) {
        setLoadingCompanyId(companyId)
        try {
            const details = await getCompanyDetails(companyId)
            setSelectedDetails(details)
        } finally {
            setLoadingCompanyId(null)
        }
    }

    const filteredCompanies = stats.allCompanies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cnpj ?? "").includes(search) ||
        (c.city ?? "").toLowerCase().includes(search.toLowerCase())
    )

    const maxBar = Math.max(...stats.companiesByDay.map(d => d.count), 1)

    // Bottom nav items (mobile)
    const navItems: { id: MainTab; label: string; icon: any }[] = [
        { id: "dashboard", label: "Início", icon: TrendingUp },
        { id: "companies", label: "Empresas", icon: Building2 },
        { id: "logs", label: "Logs", icon: Activity },
    ]

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Background grid subtle */}
            <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.01)_1px,transparent_1px)] bg-[size:32px:32px]" />

            <div className="relative flex h-screen overflow-hidden">

                {/* ── Desktop Sidebar ── */}
                <aside className="hidden md:flex w-64 shrink-0 flex-col transition-all duration-300" style={{ backgroundColor: "#152138" }}>
                    <div className="px-6 py-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[13px] font-black text-white uppercase tracking-wider">PEPACORP</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Controle</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 px-3 py-6 space-y-1">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setMainTab(item.id)}
                                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${mainTab === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <div className="px-5 py-5 border-t border-white/10 space-y-2">
                        <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-400 uppercase tracking-widest">Ativas</span><span className="text-emerald-400">{stats.activeCompanies}/{stats.totalCompanies}</span></div>
                        <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-400 uppercase tracking-widest">Usuários</span><span className="text-blue-400">{stats.totalUsers}</span></div>
                        <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-400 uppercase tracking-widest">Funcionários</span><span className="text-purple-400">{stats.totalEmployees}</span></div>
                    </div>

                    <div className="px-3 py-4 border-t border-white/10">
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                            <LogOut className="h-4 w-4" /> Sair
                        </button>
                    </div>
                </aside>

                {/* ── Main content ── */}
                <main className="flex-1 overflow-hidden flex flex-col">
                    {selectedDetails ? (
                        <CompanyDetailPanel details={selectedDetails} onBack={() => setSelectedDetails(null)} />
                    ) : (
                        <>
                            {/* Mobile top header */}
                            <div className="flex md:hidden items-center justify-between px-4 py-4 border-b bg-white shadow-sm shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md">
                                        <BarChart3 className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-black text-slate-900 uppercase tracking-wider">PEPACORP</p>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Controle</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleRefresh} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
                                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                                    </button>
                                    <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
                                        <LogOut className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Desktop top bar */}
                            <div className="hidden md:flex items-center justify-between px-8 py-6 border-b bg-white shadow-sm shrink-0">
                                <div>
                                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {mainTab === "dashboard" ? "Central de Controle" : mainTab === "companies" ? "Empresas" : "Logs de Atividade"}
                                    </h1>
                                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Monitoramento do sistema</p>
                                </div>
                                <button onClick={handleRefresh} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 shadow-sm">
                                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar Dados
                                </button>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">

                                {/* ── Dashboard tab ── */}
                                {mainTab === "dashboard" && (
                                    <div className="px-4 md:px-6 py-4 space-y-4">
                                        {/* Metrics */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <Metric label="Empresas" value={stats.totalCompanies} sub={`${stats.activeCompanies} ativas`} icon={Building2} color="bg-blue-600" />
                                            <Metric label="Usuários" value={stats.totalUsers} icon={Users} color="bg-indigo-600" />
                                            <Metric label="Funcionários" value={stats.totalEmployees} sub={`${stats.activeEmployees} ativos`} icon={UserCheck} color="bg-violet-600" />
                                            <Metric label="Ações" value={stats.recentLogs.length} icon={Activity} color="bg-emerald-600" />
                                        </div>

                                        {/* Bar chart */}
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Novas Empresas — últimos 7 dias</p>
                                            <div className="flex items-end gap-2 h-24">
                                                {stats.companiesByDay.map(d => (
                                                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                                                        <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">{d.count > 0 ? d.count : ""}</span>
                                                        <div className="w-full rounded-t-lg bg-slate-100 group-hover:bg-blue-600 transition-colors relative"
                                                            style={{ height: `${Math.max((d.count / maxBar) * 60, d.count > 0 ? 6 : 4)}px` }}>
                                                            {d.count > 0 && <div className="absolute inset-0 bg-blue-600 rounded-t-lg opacity-80" />}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{d.day}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Roles */}
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Distribuição de Perfis</p>
                                            <div className="space-y-3">
                                                {[
                                                    { role: "ADMIN", color: "bg-blue-600", label: "Administradores" },
                                                    { role: "RH", color: "bg-purple-600", label: "RH" },
                                                    { role: "GESTOR", color: "bg-emerald-600", label: "Gestores" },
                                                    { role: "FUNCIONARIO", color: "bg-amber-600", label: "Funcionários" },
                                                ].map(({ role, color, label }) => {
                                                    const count = stats.roleCount[role] ?? 0
                                                    const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0
                                                    return (
                                                        <div key={role}>
                                                            <div className="flex justify-between text-[12px] font-bold mb-1.5">
                                                                <span className="text-slate-500 uppercase tracking-tight">{label}</span>
                                                                <span className="text-slate-900">{count} <span className="text-slate-400 font-medium ml-1">({pct}%)</span></span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                                                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Recent companies preview */}
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Empresas Recentes</p>
                                                <button onClick={() => setMainTab("companies")} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 uppercase tracking-tight">
                                                    Ver todas <ArrowRight className="h-3 w-3" />
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {stats.recentCompanies.slice(0, 5).map(c => (
                                                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                                                            <Building2 className="h-5 w-5 text-slate-400" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] text-slate-900 font-bold truncate uppercase tracking-tight">{c.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{c.city ?? "Sede não informada"}</p>
                                                        </div>
                                                        {c.active
                                                            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                                            : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                                        }
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Companies tab ── */}
                                {mainTab === "companies" && (
                                    <div className="px-4 md:px-6 py-4 space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                            <input type="text" placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
                                        </div>

                                        {/* Mobile: cards */}
                                        <div className="md:hidden space-y-2">
                                            {filteredCompanies.map(c => (
                                                <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                                                            <Building2 className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] font-bold text-slate-900">{c.name}</p>
                                                            {c.cnpj && <p className="text-[10px] text-slate-500 font-mono">{c.cnpj}</p>}
                                                            {c.city && <p className="text-[11px] text-slate-500">{c.city}{c.state ? `/${c.state}` : ""}</p>}
                                                        </div>
                                                        <div className="shrink-0">
                                                            {c.active
                                                                ? <Badge label="Ativa" color="text-emerald-700 bg-emerald-50 border border-emerald-200" />
                                                                : <Badge label="Inativa" color="text-red-700 bg-red-50 border border-red-200" />
                                                            }
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSelectCompany(c.id)}
                                                        disabled={loadingCompanyId === c.id}
                                                        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-200 py-2.5 text-[13px] font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                                                    >
                                                        {loadingCompanyId === c.id
                                                            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Carregando...</>
                                                            : <><ArrowRight className="h-3.5 w-3.5" /> Ver todos os dados</>
                                                        }
                                                    </button>
                                                </div>
                                            ))}
                                            {filteredCompanies.length === 0 && <p className="text-center text-slate-500 py-8 text-[13px]">Nenhuma empresa encontrada</p>}
                                        </div>

                                        {/* Desktop: table */}
                                        <div className="hidden md:block rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[13px]">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 bg-slate-50">
                                                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Empresa</th>
                                                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">CNPJ</th>
                                                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cidade</th>
                                                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cadastro</th>
                                                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                                                            <th className="px-4 py-3" />
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredCompanies.map((c, i) => (
                                                            <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 ? "bg-slate-50/50" : "bg-white"}`}>
                                                                <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                                                                <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{c.cnpj ?? "—"}</td>
                                                                <td className="px-4 py-3 text-slate-600">{c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}</td>
                                                                <td className="px-4 py-3 text-slate-500 text-[11px]">{fmtDate(c.createdAt)}</td>
                                                                <td className="px-4 py-3">{c.active ? <Badge label="Ativa" color="text-emerald-700 bg-emerald-50 border border-emerald-200" /> : <Badge label="Inativa" color="text-red-700 bg-red-50 border border-red-200" />}</td>
                                                                <td className="px-4 py-3">
                                                                    <button onClick={() => handleSelectCompany(c.id)} disabled={loadingCompanyId === c.id}
                                                                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                                                                        {loadingCompanyId === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><ArrowRight className="h-3.5 w-3.5" /> Ver dados</>}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {filteredCompanies.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma empresa encontrada</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Logs tab ── */}
                                {mainTab === "logs" && (
                                    <div className="px-4 md:px-6 py-4 space-y-2">
                                        {stats.recentLogs.map(log => (
                                            <div key={log.id} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-[13px] font-bold text-slate-900">{log.user_name}</p>
                                                    <Badge label={ACTION_LABELS[log.action] ?? log.action} color="text-blue-700 bg-blue-50 border border-blue-200" />
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="h-3 w-3 text-slate-400" />
                                                    <p className="text-[11px] text-slate-500">{fmtDate(log.created_at)}</p>
                                                    {log.target && <p className="text-[11px] text-slate-400 truncate">· {log.target}</p>}
                                                </div>
                                            </div>
                                        ))}
                                        {stats.recentLogs.length === 0 && <p className="text-center text-slate-500 py-8 text-[13px]">Sem registros</p>}
                                    </div>
                                )}
                            </div>

                            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white shadow-2xl z-20">
                                <div className="flex">
                                    {navItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setMainTab(item.id)}
                                            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === item.id ? "text-blue-600 bg-blue-50/50" : "text-slate-400"}`}
                                        >
                                            <item.icon className="h-5 w-5" />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </nav>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
