"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react"
import { WhatsAppSidebar } from "./WhatsAppSidebar"
import { WhatsAppChatWindow } from "./WhatsAppChatWindow"
import { WhatsAppCRMPanel } from "./WhatsAppCRMPanel"
import { WhatsAppDashboard } from "./WhatsAppDashboard"
import { WhatsAppSettings } from "./WhatsAppSettings"
import { cn } from "@/lib/utils"

type View = "dashboard" | "chat" | "settings"

export function WhatsAppContainer() {
    const [view, setView] = useState<View>("chat")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchConversations = async () => {
        try {
            const resp = await fetch("/api/whatsapp/conversations", { cache: "no-store" })
            if (resp.ok) {
                setConversations(await resp.json())
            } else {
                const text = await resp.text()
                console.error("[CONTAINER] conversations error:", resp.status, text)
            }
        } catch (err) { console.error("[CONTAINER]", err) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchConversations()
        const timer = setInterval(fetchConversations, 5000)
        return () => clearInterval(timer)
    }, [])

    // Conversa selecionada vinda diretamente da lista já carregada
    const selectedConversation = conversations.find(c => c.id === selectedId) ?? null

    const navItems: { id: View; label: string; icon: React.ElementType }[] = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "chat", label: "Conversas", icon: MessageSquare },
        { id: "settings", label: "Configurações", icon: Settings },
    ]

    return (
        <div
            className="flex flex-col bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200"
            style={{ height: "calc(100vh - 140px)" }}
        >
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-100 px-5 bg-white shrink-0">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors relative",
                            view === item.id ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {view === item.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {view === "dashboard" ? (
                    <WhatsAppDashboard
                        onSelect={(id) => { setSelectedId(id); setView("chat"); }}
                    />
                ) : view === "settings" ? (
                    <WhatsAppSettings />
                ) : (
                    <>
                        <WhatsAppSidebar
                            conversations={conversations}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onRefresh={fetchConversations}
                            loading={loading}
                        />
                        <WhatsAppChatWindow
                            conversation={selectedConversation}
                            onMessageSent={fetchConversations}
                        />
                        <WhatsAppCRMPanel conversation={selectedConversation} />
                    </>
                )}
            </div>
        </div>
    )
}
