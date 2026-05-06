"use client"

import { Search, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

type Tab = "Ativos" | "Aguardando" | "Arquivados"

interface WhatsAppSidebarProps {
    conversations: any[]
    selectedId: string | null
    onSelect: (id: string) => void
    onRefresh: () => void
    loading: boolean
}

const AVATAR_COLORS = ["#D97706", "#7C3AED", "#0284C7", "#DC2626", "#059669", "#DB2777", "#0891B2"]

function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
}

export function WhatsAppSidebar({ conversations, selectedId, onSelect, onRefresh, loading }: WhatsAppSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState<Tab>("Ativos")
    const [employees, setEmployees] = useState<any[]>([])
    const [showEmployees, setShowEmployees] = useState(false)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        if (showEmployees) {
            fetch("/api/whatsapp/employees")
                .then(r => r.json())
                .then(setEmployees)
                .catch(console.error)
        }
    }, [showEmployees])

    const lc = searchTerm.toLowerCase()
    const filteredItems = showEmployees
        ? employees.filter(e => (e.name ?? "").toLowerCase().includes(lc))
        : conversations.filter(c => (c.employee?.name ?? "").toLowerCase().includes(lc))

    const handleItemClick = async (item: any) => {
        if (showEmployees) {
            setCreating(true)
            try {
                const resp = await fetch("/api/whatsapp/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: "Iniciando conversa...", employeeId: item.id }),
                })
                if (resp.ok) {
                    const newMsg = await resp.json()
                    onRefresh()
                    onSelect(newMsg.conversationId)
                    setShowEmployees(false)
                    setSearchTerm("")
                }
            } catch (err) { console.error("[SIDEBAR]", err) }
            finally { setCreating(false) }
        } else {
            onSelect(item.id)
        }
    }

    const tabs: Tab[] = ["Ativos", "Aguardando", "Arquivados"]

    return (
        <div className="w-[280px] flex flex-col shrink-0 bg-white border-r border-slate-200">

            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Conversas</h2>
                <button
                    onClick={() => setShowEmployees(!showEmployees)}
                    disabled={creating}
                    title="Nova conversa"
                    className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                        showEmployees
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar contatos..."
                        className="w-full pl-8 pr-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-slate-100 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            </div>

            {/* Tabs */}
            {!showEmployees && (
                <div className="flex border-b border-slate-200 mx-1">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex-1 py-2.5 text-xs font-semibold transition-colors relative",
                                activeTab === tab
                                    ? "text-blue-600"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {tab}
                            {activeTab === tab && (
                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="space-y-px pt-1">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3">
                                <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
                                    <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                        <Search className="h-8 w-8 opacity-20 mb-3" />
                        <p className="text-sm">{showEmployees ? "Nenhum funcionário" : "Nenhuma conversa"}</p>
                        {!showEmployees && (
                            <button onClick={() => setShowEmployees(true)} className="mt-2 text-xs text-blue-600 font-semibold hover:underline">
                                Iniciar nova conversa
                            </button>
                        )}
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const isConv = !showEmployees
                        const convId = isConv ? item.id : null
                        const name = isConv ? (item.employee?.name ?? "—") : item.name
                        const subtitle = isConv
                            ? (item.messages?.[0]?.content ?? item.employee?.department ?? "")
                            : (item.department ?? "Funcionário")
                        const time = isConv && item.messages?.[0]
                            ? new Date(item.messages[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""
                        const isSelected = selectedId === convId && isConv

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-2 text-left",
                                    isSelected
                                        ? "bg-blue-50 border-l-blue-500"
                                        : "border-l-transparent hover:bg-slate-50"
                                )}
                            >
                                <div className="relative shrink-0">
                                    <div
                                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                        style={{ background: getAvatarColor(name) }}
                                    >
                                        {getInitials(name)}
                                    </div>
                                    {isConv && (
                                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline gap-1">
                                        <p className={cn("text-sm font-semibold truncate", isSelected ? "text-blue-700" : "text-slate-900")}>
                                            {name}
                                        </p>
                                        {time && <span className="text-[10px] text-slate-400 shrink-0">{time}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mt-0.5 leading-snug">{subtitle}</p>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
