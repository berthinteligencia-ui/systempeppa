"use client"

import { useEffect, useState } from "react"
import { Users, MessageSquare, Clock, Activity, ArrowUpRight, TrendingUp } from "lucide-react"

type Stats = {
    totalLeads: number
    totalMessages: number
    avgResponseMinutes: number
    activeConvs: number
}

function fmtResponseTime(minutes: number) {
    if (minutes === 0) return "—"
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StatCard({
    title, value, subtitle, icon: Icon, iconBg, iconColor, loading,
}: {
    title: string; value: string; subtitle: string
    icon: React.ElementType; iconBg: string; iconColor: string; loading: boolean
}) {
    return (
        <div className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
                    {loading ? (
                        <div className="mt-2 h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
                    ) : (
                        <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
                    )}
                    <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
            </div>
        </div>
    )
}

export function WhatsAppDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/whatsapp/stats")
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const cards = [
        {
            title: "Total de Leads",
            value: String(stats?.totalLeads ?? 0),
            subtitle: "conversas iniciadas",
            icon: Users,
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
        },
        {
            title: "Total de Mensagens",
            value: String(stats?.totalMessages ?? 0),
            subtitle: "mensagens trocadas",
            icon: MessageSquare,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
        },
        {
            title: "Tempo Médio de Resposta",
            value: fmtResponseTime(stats?.avgResponseMinutes ?? 0),
            subtitle: "primeira resposta",
            icon: Clock,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
        },
        {
            title: "Conversas Ativas",
            value: String(stats?.activeConvs ?? 0),
            subtitle: "com mensagens",
            icon: Activity,
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
        },
    ]

    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-6 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-slate-800">Visão Geral — WhatsApp Business</h2>
                <p className="text-sm text-slate-500 mt-0.5">Métricas de conversas e atendimento</p>
            </div>

            {/* Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(card => (
                    <StatCard key={card.title} {...card} loading={loading} />
                ))}
            </div>

            {/* Recent conversations table */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <h3 className="font-semibold text-slate-800">Últimas Conversas</h3>
                    <div className="flex items-center gap-1 text-blue-600 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4" />
                        <span>Em tempo real</span>
                    </div>
                </div>
                <RecentConversations />
            </div>
        </div>
    )
}

function RecentConversations() {
    const [convs, setConvs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/whatsapp/conversations")
            .then(r => r.json())
            .then(data => { setConvs(data.slice(0, 8)); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return (
        <div className="p-8 space-y-3">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
        </div>
    )

    if (convs.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <MessageSquare className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">Nenhuma conversa ainda</p>
        </div>
    )

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Lead</th>
                        <th className="px-5 py-3">Cargo</th>
                        <th className="px-5 py-3">Última Mensagem</th>
                        <th className="px-5 py-3">Horário</th>
                        <th className="px-5 py-3">Mensagens</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {convs.map(conv => {
                        const lastMsg = conv.messages?.[0]
                        const name = conv.employee?.name || "—"
                        const position = conv.employee?.position || "—"
                        const time = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"
                        const preview = lastMsg?.content?.slice(0, 50) + (lastMsg?.content?.length > 50 ? "..." : "") || "—"

                        return (
                            <tr key={conv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <p className="font-semibold text-slate-800 text-sm">{name}</p>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-slate-500">{position}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-600 max-w-xs truncate">{preview}</td>
                                <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{time}</td>
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
                                        Ver conversa
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
