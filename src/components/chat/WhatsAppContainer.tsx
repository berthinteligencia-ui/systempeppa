"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react"
import { supabase } from "@/lib/supabase"
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

        // Realtime: atualiza lista de conversas a cada nova mensagem
        const channel = supabase
            .channel("container-conversations")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens_zap" }, fetchConversations)
            .subscribe()

        // Polling: 10s para garantir sincronia quando Realtime não está habilitado
        const interval = setInterval(fetchConversations, 10000)

        // Re-fetch ao voltar para a aba do browser
        const onVisible = () => { if (document.visibilityState === "visible") fetchConversations() }
        document.addEventListener("visibilitychange", onVisible)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(interval)
            document.removeEventListener("visibilitychange", onVisible)
        }
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
            className="flex flex-col rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm"
            style={{ height: "calc(100vh - 140px)" }}
        >
            {/* Tabs */}
            <div className="flex items-center gap-0.5 px-4 bg-white border-b border-slate-200 shrink-0">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors relative",
                            view === item.id ? "text-blue-600" : "text-slate-400 hover:text-slate-700"
                        )}
                    >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label}
                        {view === item.id && (
                            <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-blue-600 rounded-full" />
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
