"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Clock, CheckCircle2, AlertTriangle, XCircle, RefreshCw, MessageSquare, Send, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Atendimento = {
    id: string
    dataCriacao: string
    nome: string
    whatsapp: string
    descricao: string
    statusCadastro: string
    statusResolucao: string
    prazoLimite: string | null
    cidade: string
    empresa: string | null
    vencido: boolean
    diffHours: number | null
}

// Atualiza o prazo a cada minuto sem re-renderizar o pai
function PrazoTag({ prazoLimite, statusResolucao }: { prazoLimite: string | null; statusResolucao: string }) {
    const [, setTick] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setTick(v => v + 1), 60000)
        return () => clearInterval(t)
    }, [])

    if (statusResolucao?.trim()) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Resolvido
            </span>
        )
    }
    if (!prazoLimite) return <span className="text-slate-400 text-xs">Sem prazo</span>

    const diffMs = new Date(prazoLimite).getTime() - Date.now()
    const diffH = diffMs / (1000 * 60 * 60)

    if (diffMs < 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                <XCircle className="h-3 w-3" /> Vencido
            </span>
        )
    }

    const h = Math.floor(diffH)
    const m = Math.floor((diffMs / (1000 * 60)) % 60)
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`

    if (diffH < 6) return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> {label}
        </span>
    )
    if (diffH < 12) return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
            <Clock className="h-3 w-3" /> {label}
        </span>
    )
    if (diffH < 24) return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-semibold text-yellow-700">
            <Clock className="h-3 w-3" /> {label}
        </span>
    )
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
            <Clock className="h-3 w-3" /> {label}
        </span>
    )
}

// Modal de resposta
function ResponderModal({ at, onClose, onSent }: { at: Atendimento; onClose: () => void; onSent: () => void }) {
    const [texto, setTexto] = useState("")
    const [sending, setSending] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => { textareaRef.current?.focus() }, [])

    // Fecha ao pressionar ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [onClose])

    const handleSend = async () => {
        if (!texto.trim()) return
        setSending(true)
        setErro(null)
        try {
            const resp = await fetch("/api/whatsapp/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: texto.trim(), conversationId: at.whatsapp }),
            })
            if (resp.ok) {
                onSent()
                onClose()
            } else {
                const body = await resp.json().catch(() => ({}))
                setErro(body?.error ?? `Erro ${resp.status}`)
            }
        } catch (e: any) {
            setErro(e.message)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                            {at.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{at.nome}</p>
                            <p className="text-xs text-slate-400">{at.whatsapp}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors mt-0.5">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Solicitação */}
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-400 mb-1">Solicitação</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{at.descricao}</p>
                    {at.cidade && <p className="text-xs text-slate-400 mt-1">📍 {at.cidade}</p>}
                </div>

                {/* Resposta */}
                <div className="px-6 py-4 space-y-3">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sua resposta</label>
                    <textarea
                        ref={textareaRef}
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        disabled={sending}
                        rows={4}
                        placeholder="Digite a resposta para o funcionário..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend() }}
                    />
                    {erro && <p className="text-xs text-red-600">{erro}</p>}
                    <p className="text-[11px] text-slate-400">Ctrl + Enter para enviar</p>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !texto.trim()}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1a3c6e] text-white text-sm font-semibold shadow-sm hover:bg-blue-800 disabled:opacity-40 transition-colors"
                    >
                        <Send className="h-4 w-4" />
                        {sending ? "Enviando..." : "Enviar resposta"}
                    </button>
                </div>
            </div>
        </div>
    )
}

type FilterKey = "todos" | "pendentes" | "resolvidos" | "vencidos"

export function WhatsAppDashboard({ onSelect }: { onSelect: (id: string) => void }) {
    const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<FilterKey>("pendentes")
    const [responderAt, setResponderAt] = useState<Atendimento | null>(null)

    const fetchAtendimentos = useCallback(async (silent = false) => {
        if (!silent) setRefreshing(true)
        try {
            const r = await fetch("/api/whatsapp/atendimentos", { cache: "no-store" })
            if (r.ok) setAtendimentos(await r.json())
        } catch { /* silencia erros de rede */ }
        finally { setLoading(false); setRefreshing(false) }
    }, [])

    useEffect(() => {
        fetchAtendimentos(true)
        const channel = supabase
            .channel("atendimentos-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos_lisa" }, () => fetchAtendimentos(true))
            .subscribe()
        const interval = setInterval(() => fetchAtendimentos(true), 30000)
        return () => { supabase.removeChannel(channel); clearInterval(interval) }
    }, [fetchAtendimentos])

    const counts: Record<FilterKey, number> = {
        todos: atendimentos.length,
        pendentes: atendimentos.filter(a => !a.statusResolucao?.trim() && !a.vencido).length,
        vencidos: atendimentos.filter(a => a.vencido && !a.statusResolucao?.trim()).length,
        resolvidos: atendimentos.filter(a => a.statusResolucao?.trim() !== "").length,
    }

    const filtered = atendimentos.filter(at => {
        if (filter === "resolvidos") return at.statusResolucao?.trim() !== ""
        if (filter === "vencidos") return at.vencido && !at.statusResolucao?.trim()
        if (filter === "pendentes") return !at.statusResolucao?.trim() && !at.vencido
        return true
    })

    const tabs: { key: FilterKey; label: string; color: string }[] = [
        { key: "pendentes", label: "Pendentes", color: "text-yellow-600" },
        { key: "vencidos", label: "Vencidos", color: "text-slate-500" },
        { key: "resolvidos", label: "Resolvidos", color: "text-emerald-600" },
        { key: "todos", label: "Todos", color: "text-blue-600" },
    ]

    const rowBg = (at: Atendimento) => {
        if (at.statusResolucao?.trim()) return ""
        if (!at.prazoLimite) return ""
        const h = at.diffHours ?? 999
        if (at.vencido) return "opacity-60"
        if (h < 6) return "bg-red-50"
        if (h < 12) return "bg-orange-50"
        return ""
    }

    return (
        <>
            {responderAt && (
                <ResponderModal
                    at={responderAt}
                    onClose={() => setResponderAt(null)}
                    onSent={() => fetchAtendimentos(true)}
                />
            )}

            <div className="flex-1 overflow-auto bg-slate-50 p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Atendimentos — Lisa IA</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Chamados dos funcionários com prazo de 48 horas</p>
                    </div>
                    <button
                        onClick={() => fetchAtendimentos()}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        Atualizar
                    </button>
                </div>

                {/* Resumo horizontal */}
                <div className="flex items-stretch rounded-xl border bg-white shadow-sm overflow-hidden">
                    {[
                        { label: "Pendentes",  count: counts.pendentes,  accent: "bg-yellow-400",  num: "text-yellow-600" },
                        { label: "Vencidos",   count: counts.vencidos,   accent: "bg-slate-400",   num: "text-slate-600" },
                        { label: "Resolvidos", count: counts.resolvidos, accent: "bg-emerald-400", num: "text-emerald-600" },
                        { label: "Total",      count: counts.todos,      accent: "bg-blue-400",    num: "text-blue-600" },
                    ].map((c, i, arr) => (
                        <div key={c.label} className={cn("flex-1 flex items-center gap-4 px-6 py-4", i < arr.length - 1 && "border-r border-slate-100")}>
                            <div className={cn("h-10 w-1 rounded-full shrink-0", c.accent)} />
                            <div>
                                <p className={cn("text-3xl font-extrabold leading-none", c.num)}>{c.count}</p>
                                <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={cn(
                                "px-4 py-2.5 text-sm font-semibold transition-colors relative",
                                filter === tab.key ? tab.color : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {tab.label}
                            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                {counts[tab.key]}
                            </span>
                            {filter === tab.key && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-current rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tabela */}
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <CheckCircle2 className="h-10 w-10 opacity-20 mb-2" />
                            <p className="text-sm">Nenhum atendimento nesta categoria</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        <th className="px-4 py-3">Funcionário</th>
                                        <th className="px-4 py-3">Solicitação</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Prazo 48h</th>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map(at => (
                                        <tr key={at.id} className={cn("transition-colors hover:bg-slate-50/80", rowBg(at))}>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
                                                        {at.nome.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm leading-tight">{at.nome}</p>
                                                        <p className="text-[11px] text-slate-400">{at.whatsapp}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 max-w-xs">
                                                <p className="text-sm text-slate-600 line-clamp-2">{at.descricao}</p>
                                                {at.cidade && <p className="text-[11px] text-slate-400 mt-0.5">📍 {at.cidade}</p>}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {at.statusResolucao?.trim()
                                                    ? <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 uppercase max-w-[130px] truncate">{at.statusResolucao}</span>
                                                    : <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 uppercase">Pendente</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <PrazoTag prazoLimite={at.prazoLimite} statusResolucao={at.statusResolucao} />
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                                                {at.dataCriacao
                                                    ? String(at.dataCriacao).slice(0, 10).split("-").reverse().join("/")
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setResponderAt(at)}
                                                        className="flex items-center gap-1 rounded-lg bg-[#1a3c6e] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 transition-colors"
                                                    >
                                                        <Send className="h-3 w-3" />
                                                        Responder
                                                    </button>
                                                    <button
                                                        onClick={() => onSelect(at.whatsapp)}
                                                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <MessageSquare className="h-3 w-3" />
                                                        Chat
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {filtered.length > 0 && (
                    <p className="text-xs text-slate-400 text-center">
                        {filtered.length} atendimento{filtered.length !== 1 ? "s" : ""} · Atualiza a cada 30s
                    </p>
                )}
            </div>
        </>
    )
}
