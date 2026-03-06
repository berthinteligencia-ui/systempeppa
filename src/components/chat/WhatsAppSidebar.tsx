"use client"

import { Search, MessageSquarePlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

type Tab = "Ativos" | "Aguardando" | "Arquivados"

interface WhatsAppSidebarProps {
    conversations: any[]
    selectedId: string | null
    onSelect: (id: string) => void
    loading: boolean
}

export function WhatsAppSidebar({ conversations, selectedId, onSelect, loading }: WhatsAppSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState<Tab>("Ativos")
    const [employees, setEmployees] = useState<any[]>([])
    const [showEmployees, setShowEmployees] = useState(false)

    useEffect(() => {
        if (showEmployees) {
            fetch("/api/whatsapp/employees")
                .then(r => r.json())
                .then(setEmployees)
                .catch(console.error)
        }
    }, [showEmployees])

    const filteredItems = showEmployees
        ? employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : conversations.filter(c => c.employee.name.toLowerCase().includes(searchTerm.toLowerCase()))

    const handleItemClick = async (item: any) => {
        if (showEmployees) {
            try {
                const resp = await fetch("/api/whatsapp/messages", {
                    method: "POST",
                    body: JSON.stringify({ content: "Iniciando conversa...", employeeId: item.id }),
                })
                if (resp.ok) {
                    const newMsg = await resp.json()
                    onSelect(newMsg.conversationId)
                    setShowEmployees(false)
                    setSearchTerm("")
                }
            } catch (err) { console.error(err) }
        } else {
            onSelect(item.id)
        }
    }

    const tabs: Tab[] = ["Ativos", "Aguardando", "Arquivados"]

    return (
        <div className="w-80 border-r border-slate-200 flex flex-col bg-white shrink-0">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Conversas</h2>
                <button
                    onClick={() => setShowEmployees(!showEmployees)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        showEmployees ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    <MessageSquarePlus className="h-4 w-4" /> Nova
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar contatos..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none placeholder:text-slate-400"
                    />
                </div>
            </div>

            {/* Tabs */}
            {!showEmployees && (
                <div className="flex border-b border-slate-100 px-4">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex-1 py-2.5 text-xs font-semibold transition-colors relative",
                                activeTab === tab ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {tab}
                            {activeTab === tab && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">Carregando...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <MessageSquarePlus className="h-10 w-10 opacity-20 mb-2" />
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
                        const name = isConv ? item.employee.name : item.name
                        const subtitle = isConv ? (item.messages?.[0]?.content || item.employee.position) : item.position
                        const time = isConv && item.messages?.[0]
                            ? new Date(item.messages[0].createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""
                        const isSelected = selectedId === convId && isConv

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50",
                                    isSelected && "bg-blue-50 border-l-2 border-l-blue-600 hover:bg-blue-50"
                                )}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-11 w-11">
                                        <AvatarFallback className={cn("text-white font-bold text-sm", isSelected ? "bg-blue-600" : "bg-slate-400")}>
                                            {name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {isConv && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />}
                                </div>
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="flex justify-between items-baseline gap-1">
                                        <p className="font-semibold text-slate-900 truncate text-sm">{name}</p>
                                        <span className="text-[10px] text-slate-400 shrink-0">{time}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
