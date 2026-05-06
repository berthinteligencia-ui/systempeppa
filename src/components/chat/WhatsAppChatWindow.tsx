"use client"

import { useState, useEffect, useRef } from "react"
import { Send, MoreVertical, Paperclip, Smile, Phone, Video, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface WhatsAppChatWindowProps {
    conversation: any | null
    onMessageSent: () => void
}

const AVATAR_COLORS = ["#D97706", "#7C3AED", "#0284C7", "#DC2626", "#059669", "#DB2777", "#0891B2"]

function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
}

export function WhatsAppChatWindow({ conversation, onMessageSent }: WhatsAppChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([])
    const [inputValue, setInputValue] = useState("")
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const conversationId = conversation?.id ?? null

    const mapMessage = (msg: any) => ({
        id: msg.id,
        content: msg.conteudo,
        senderType: msg.tipo === "lead" ? "EMPLOYEE" : "COMPANY",
        createdAt: msg.created_at,
        conversationId: msg.lead_id,
    })

    const fetchMessages = async () => {
        if (!conversationId) return
        try {
            const resp = await fetch(`/api/whatsapp/messages?conversationId=${conversationId}`)
            if (resp.ok) {
                const data = await resp.json()
                setMessages(Array.isArray(data) ? data : [])
                setError(null)
            } else {
                const body = await resp.json().catch(() => ({}))
                setError(`[${resp.status}] ${body?.error ?? resp.statusText}`)
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    useEffect(() => {
        setMessages([])
        setError(null)
        setInputValue("")
        if (!conversationId) return

        fetchMessages()

        const n8nChannel = supabase
            .channel(`n8n:${conversationId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "n8n_chat_histories", filter: `session_id=eq.${conversationId}` },
                (payload) => {
                    const row = payload.new as any
                    const msg = row.message
                    if (msg?.type === "tool") return
                    const rawContent = msg?.content ?? ""
                    let content = rawContent
                    if (typeof rawContent === "string") {
                        try { const p = JSON.parse(rawContent); if (p?.text) content = p.text } catch {}
                    }
                    const senderType = msg?.type === "ai" ? "COMPANY" : "EMPLOYEE"
                    const newMsg = { id: String(row.id), content, senderType, createdAt: new Date().toISOString(), conversationId }
                    setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
                    onMessageSent()
                }
            )
            .subscribe()

        const zapChannel = supabase
            .channel(`mensagens:${conversationId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "mensagens_zap" },
                (payload) => {
                    const row = payload.new as any
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId ?? "")
                    const suffix = (conversationId ?? "").replace(/\D/g, "").slice(-8)
                    const rowPhone = (row.numero_funcionario ?? "").replace(/\D/g, "")
                    const matches = isUuid
                        ? row.lead_id === conversationId
                        : rowPhone.endsWith(suffix) || row.lead_id === conversationId
                    if (!matches) return
                    const newMsg = mapMessage(row)
                    setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
                    onMessageSent()
                }
            )
            .subscribe()

        const interval = setInterval(fetchMessages, 4000)

        return () => {
            supabase.removeChannel(n8nChannel)
            supabase.removeChannel(zapChannel)
            clearInterval(interval)
        }
    }, [conversationId])

    useEffect(() => {
        if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputValue.trim() || !conversationId) return
        setSending(true)
        const textToSend = inputValue
        setInputValue("")
        try {
            const resp = await fetch("/api/whatsapp/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: textToSend, conversationId }),
            })
            if (resp.ok) {
                const sent = await resp.json()
                setMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent])
                onMessageSent()
            } else {
                setInputValue(textToSend)
            }
        } catch {
            setInputValue(textToSend)
        } finally {
            setSending(false)
        }
    }

    // Empty state
    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50">
                <div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-200">
                    <Send className="h-7 w-7 text-blue-500 rotate-45" />
                </div>
                <div className="text-center">
                    <p className="font-semibold text-slate-700 text-sm">Nenhuma conversa selecionada</p>
                    <p className="text-xs text-slate-400 mt-1">Clique em uma conversa para começar</p>
                </div>
            </div>
        )
    }

    const employeeName = conversation.employee?.name ?? "—"
    const avatarColor = getAvatarColor(employeeName)
    const initials = getInitials(employeeName)

    // Group messages by date for separators
    const groupedMessages = messages.reduce((groups: { date: string; msgs: any[] }[], msg) => {
        const date = new Date(msg.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
        const last = groups[groups.length - 1]
        if (last && last.date === date) {
            last.msgs.push(msg)
        } else {
            groups.push({ date, msgs: [msg] })
        }
        return groups
    }, [])

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-white">

            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{ background: avatarColor }}
                    >
                        {initials}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{employeeName}</p>
                        <p className="text-[11px] font-medium text-emerald-500">Online</p>
                    </div>
                </div>
                <div className="flex items-center gap-0.5">
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Phone className="h-4 w-4" />
                    </button>
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Video className="h-4 w-4" />
                    </button>
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5"
                style={{ background: "#F0F2F5" }}
            >
                {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {!error && messages.length === 0 && (
                    <div className="flex items-center justify-center py-6">
                        <span className="text-[11px] text-slate-500 bg-white/80 border border-slate-200 rounded-full px-3 py-1 shadow-sm">
                            Início da conversa
                        </span>
                    </div>
                )}

                {groupedMessages.map(({ date, msgs }) => (
                    <div key={date} className="flex flex-col gap-0.5">
                        {/* Date separator */}
                        <div className="flex items-center justify-center my-2">
                            <span className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-0.5 shadow-sm">
                                {date}
                            </span>
                        </div>

                        {msgs.map((msg, idx) => {
                            const isCompany = msg.senderType === "COMPANY"
                            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            const prevMsg = idx > 0 ? msgs[idx - 1] : null
                            const sameAsPrev = prevMsg?.senderType === msg.senderType

                            return (
                                <div
                                    key={msg.id}
                                    className={cn("flex", isCompany ? "justify-end" : "justify-start", sameAsPrev ? "mt-0.5" : "mt-2")}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[62%] px-3.5 pt-2 pb-1.5 text-sm shadow-sm",
                                            isCompany
                                                ? "rounded-2xl rounded-br-sm text-white"
                                                : "rounded-2xl rounded-bl-sm text-slate-800 bg-white border border-slate-200"
                                        )}
                                        style={isCompany ? { background: "#1e3b8a" } : undefined}
                                    >
                                        <p className="leading-relaxed whitespace-pre-wrap break-words pr-8">
                                            {msg.content}
                                        </p>
                                        <div className={cn(
                                            "flex items-center gap-1 mt-0.5 float-right ml-2",
                                            isCompany ? "text-blue-300" : "text-slate-400"
                                        )}>
                                            <span className="text-[10px]">{time}</span>
                                            {isCompany && (
                                                <span className="text-[10px]">✓✓</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* Input bar */}
            <form
                onSubmit={handleSend}
                className="px-4 py-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
                <div className="flex gap-0.5 text-slate-400">
                    <button type="button" className="p-2 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Smile className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
                    </button>
                    <button type="button" className="p-2 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Paperclip className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
                    </button>
                </div>
                <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={sending}
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 px-4 py-2.5 bg-slate-100 rounded-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                    }}
                />
                <button
                    type="submit"
                    disabled={sending || !inputValue.trim()}
                    className="h-9 w-9 rounded-full flex items-center justify-center shadow-sm transition-colors disabled:opacity-40 shrink-0"
                    style={{ background: "#1e3b8a" }}
                >
                    <Send className="h-4 w-4 text-white ml-0.5" />
                </button>
            </form>
        </div>
    )
}
