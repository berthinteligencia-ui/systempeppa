"use client"

import { Search, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

interface WhatsAppSidebarProps {
    conversations: any[]
    selectedId: string | null
    onSelect: (id: string) => void
    loading: boolean
}

export function WhatsAppSidebar({ conversations, selectedId, onSelect, loading }: WhatsAppSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("")
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
            } catch (err) {
                console.error(err)
            }
        } else {
            onSelect(item.id)
        }
    }

    return (
        <div className="w-80 border-r border-slate-200 flex flex-col bg-[#f0f2f5]">
            {/* Header */}
            <div className="p-4 flex justify-between items-center bg-[#f0f2f5]">
                <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-600 text-white">RH</AvatarFallback>
                </Avatar>
                <div className="flex gap-4 text-slate-500">
                    <button
                        onClick={() => setShowEmployees(!showEmployees)}
                        className={cn("hover:text-blue-600 transition-colors", showEmployees && "text-blue-600")}
                        title={showEmployees ? "Ver conversas" : "Nova conversa"}
                    >
                        <UserPlus className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 bg-white">
                <div className="relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={showEmployees ? "Procurar funcionário..." : "Pesquisar conversas..."}
                        className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm focus:outline-none placeholder:text-slate-500"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-white">
                {loading ? (
                    <div className="p-4 text-center text-slate-400 text-sm italic">Carregando...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Nenhum resultado encontrado.</div>
                ) : (
                    filteredItems.map((item) => {
                        const isConv = !showEmployees
                        const convId = isConv ? item.id : null
                        const name = isConv ? item.employee.name : item.name
                        const subtitle = isConv ? (item.messages?.[0]?.content || item.employee.position) : item.position
                        const time = isConv && item.messages?.[0] ? new Date(item.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 hover:bg-[#f5f6f6] transition-colors border-b border-slate-100",
                                    selectedId === convId && isConv && "bg-[#ebebeb] hover:bg-[#ebebeb]"
                                )}
                            >
                                <Avatar className="h-12 w-12 border border-slate-200">
                                    <AvatarFallback className="bg-slate-200 text-slate-600">
                                        {name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-slate-900 truncate">{name}</p>
                                        <span className="text-[10px] text-slate-500">{time}</span>
                                    </div>
                                    <p className="text-sm text-slate-500 truncate mt-0.5">{subtitle}</p>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
