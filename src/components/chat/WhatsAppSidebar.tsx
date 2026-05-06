"use client"

import { Search, MessageSquarePlus, MoreVertical } from "lucide-react"
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
                    await onRefresh()
                    onSelect(newMsg.conversationId)
                    setShowEmployees(false)
                    setSearchTerm("")
                } else {
                    const text = await resp.text()
                    console.error("[SIDEBAR] Erro ao criar conversa:", resp.status, text)
                }
            } catch (err) { console.error("[SIDEBAR] Erro:", err) }
            finally { setCreating(false) }
        } else {
            onSelect(item.id)
        }
    }

    const tabs: Tab[] = ["Ativos", "Aguardando", "Arquivados"]

    return (
        <div className="w-[360px] flex flex-col shrink-0 border-r border-[#222D35]" style={{ background: "#111B21" }}>

            {/* Header */}
            <div className="px-4 py-3 flex justify-between items-center shrink-0" style={{ background: "#1F2C34" }}>
                <div className="h-10 w-10 rounded-full bg-[#6B7280] flex items-center justify-center text-white font-bold text-base shrink-0">
                    P
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowEmployees(!showEmployees)}
                        disabled={creating}
                        title="Nova conversa"
                        className={cn(
                            "p-2 rounded-full transition-colors",
                            showEmployees
                                ? "text-[#00a884] bg-[#2A3942]"
                                : "text-[#aebac1] hover:bg-[#374045]"
                        )}
                    >
                        <MessageSquarePlus className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-full text-[#aebac1] hover:bg-[#374045] transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 shrink-0" style={{ background: "#111B21" }}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar contatos..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-[#d1d7db] placeholder:text-[#8696a0] focus:outline-none"
                        style={{ background: "#1F2C34" }}
                    />
                </div>
            </div>

            {/* Tabs */}
            {!showEmployees && (
                <div className="flex shrink-0 border-b border-[#222D35]">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex-1 py-3 text-xs font-semibold transition-colors relative",
                                activeTab === tab
                                    ? "text-[#00a884]"
                                    : "text-[#8696a0] hover:text-[#d1d7db]"
                            )}
                            style={{ background: "#111B21" }}
                        >
                            {tab}
                            {activeTab === tab && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a884] rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto" style={{ background: "#111B21" }}>
                {loading ? (
                    <div className="space-y-px mt-1">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-3" style={{ background: "#111B21" }}>
                                <div className="h-12 w-12 rounded-full bg-[#1F2C34] animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 bg-[#1F2C34] rounded animate-pulse w-3/4" />
                                    <div className="h-3 bg-[#1F2C34] rounded animate-pulse w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[#8696a0]">
                        <MessageSquarePlus className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm">{showEmployees ? "Nenhum funcionário" : "Nenhuma conversa"}</p>
                        {!showEmployees && (
                            <button
                                onClick={() => setShowEmployees(true)}
                                className="mt-2 text-xs text-[#00a884] font-semibold hover:underline"
                            >
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
                            ? (item.messages?.[0]?.content || item.employee?.department || "Iniciar conversa")
                            : (item.department ?? "Funcionário")
                        const time = isConv && item.messages?.[0]
                            ? new Date(item.messages[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""
                        const isSelected = selectedId === convId && isConv

                        const initials = name
                            .split(" ")
                            .slice(0, 2)
                            .map((w: string) => w[0])
                            .join("")
                            .toUpperCase()

                        const avatarColors = ["#0E6969", "#6B4C9A", "#1565C0", "#B71C1C", "#2E7D32", "#E65100"]
                        const colorIdx = name.charCodeAt(0) % avatarColors.length
                        const avatarColor = avatarColors[colorIdx]

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors"
                                style={{ background: isSelected ? "#2A3942" : undefined }}
                                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#1F2C34" }}
                                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "" }}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div
                                        className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                        style={{ background: avatarColor }}
                                    >
                                        {initials}
                                    </div>
                                    {isConv && (
                                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#00a884] border-2 border-[#111B21]" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-left overflow-hidden border-b border-[#1F2C34] pb-2.5">
                                    <div className="flex justify-between items-center gap-1">
                                        <p className="font-normal text-[#e9edef] truncate text-sm leading-tight">{name}</p>
                                        {time && <span className="text-[11px] text-[#8696a0] shrink-0">{time}</span>}
                                    </div>
                                    <p className="text-xs text-[#8696a0] truncate mt-0.5 leading-relaxed">{subtitle}</p>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
