"use client"

import { useState, useEffect, useRef } from "react"
import { Send, MoreVertical, Paperclip, Smile, Phone, Video, AlertCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface WhatsAppChatWindowProps {
    conversation: any | null
    onMessageSent: () => void
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
                const body = await resp.json().catch(() => ({}))
                console.error("[CHAT] Erro ao enviar:", resp.status, body)
                setInputValue(textToSend)
            }
        } catch (err) {
            console.error("[CHAT] Erro ao enviar:", err)
            setInputValue(textToSend)
        } finally {
            setSending(false)
        }
    }

    // Sem conversa selecionada
    if (!conversation) {
        return (
            <div
                className="flex-1 flex flex-col items-center justify-center gap-5"
                style={{ background: "#0B141A" }}
            >
                <div
                    className="h-24 w-24 rounded-full flex items-center justify-center"
                    style={{ background: "#1F2C34" }}
                >
                    <Send className="h-10 w-10 rotate-45" style={{ color: "#00a884" }} />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-light text-[#e9edef] mb-2">WhatsApp Business</h2>
                    <p className="text-sm text-[#8696a0] max-w-xs leading-relaxed">
                        Selecione uma conversa na lista para visualizar as mensagens.
                    </p>
                </div>
                <div
                    className="w-72 h-px mt-4"
                    style={{ background: "#222D35" }}
                />
                <p className="text-xs text-[#8696a0]">Suas mensagens pessoais são protegidas</p>
            </div>
        )
    }

    const employeeName = conversation.employee?.name ?? "—"
    const initials = employeeName
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()

    const avatarColors = ["#0E6969", "#6B4C9A", "#1565C0", "#B71C1C", "#2E7D32", "#E65100"]
    const colorIdx = employeeName.charCodeAt(0) % avatarColors.length
    const avatarColor = avatarColors[colorIdx]

    return (
        <div className="flex-1 flex flex-col min-w-0" style={{ background: "#0B141A" }}>

            {/* Header */}
            <div
                className="px-4 py-2.5 flex items-center justify-between shrink-0 z-10"
                style={{ background: "#1F2C34" }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{ background: avatarColor }}
                    >
                        {initials}
                    </div>
                    <div>
                        <p className="font-medium text-[#e9edef] text-sm leading-tight">{employeeName}</p>
                        <p className="text-xs font-normal" style={{ color: "#00a884" }}>online</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2 rounded-full text-[#aebac1] hover:bg-[#374045] transition-colors">
                        <Search className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-full text-[#aebac1] hover:bg-[#374045] transition-colors">
                        <Phone className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-full text-[#aebac1] hover:bg-[#374045] transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1"
                style={{
                    background: "#0B141A",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
                }}
            >
                {error && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#2A1215", borderColor: "#5C2B2B", color: "#FF6B6B", border: "1px solid" }}>
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="font-mono break-all">{error}</span>
                    </div>
                )}

                {!error && messages.length === 0 && (
                    <div className="flex items-center justify-center py-6">
                        <p className="text-xs text-[#8696a0] px-4 py-1.5 rounded-full" style={{ background: "#1F2C34" }}>
                            Início da conversa
                        </p>
                    </div>
                )}

                {/* Date separator (first message group) */}
                {messages.length > 0 && (
                    <div className="flex items-center justify-center my-2">
                        <span
                            className="text-[11px] text-[#8696a0] px-3 py-1 rounded-md"
                            style={{ background: "#1F2C34" }}
                        >
                            {new Date(messages[0].createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const isCompany = msg.senderType === "COMPANY"
                    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    const prevMsg = idx > 0 ? messages[idx - 1] : null
                    const sameAsPrev = prevMsg?.senderType === msg.senderType

                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex",
                                isCompany ? "justify-end" : "justify-start",
                                sameAsPrev ? "mt-0.5" : "mt-2"
                            )}
                        >
                            <div
                                className="max-w-[65%] px-3 pt-1.5 pb-1 rounded-lg relative"
                                style={{
                                    background: isCompany ? "#005C4B" : "#1F2C34",
                                    borderRadius: isCompany
                                        ? (sameAsPrev ? "7px" : "7px 7px 0 7px")
                                        : (sameAsPrev ? "7px" : "7px 7px 7px 0"),
                                }}
                            >
                                {/* Tail */}
                                {!sameAsPrev && (
                                    <span
                                        className="absolute top-0 w-2 h-2"
                                        style={isCompany ? {
                                            right: "-7px",
                                            borderLeft: "8px solid #005C4B",
                                            borderBottom: "8px solid transparent",
                                        } : {
                                            left: "-7px",
                                            borderRight: "8px solid #1F2C34",
                                            borderBottom: "8px solid transparent",
                                        }}
                                    />
                                )}
                                <p className="text-sm text-[#e9edef] leading-relaxed whitespace-pre-wrap break-words pr-10">
                                    {msg.content}
                                </p>
                                <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5 float-right ml-2">
                                    <span className="text-[11px]" style={{ color: isCompany ? "#9BBEAB" : "#8696a0" }}>
                                        {time}
                                    </span>
                                    {isCompany && (
                                        <svg viewBox="0 0 16 11" width="16" height="11" fill="none">
                                            <path d="M11.071.653L4.862 6.862l-1.933-1.933L1.5 6.358l3.362 3.362L12.5 2.082l-1.429-1.43z" fill="#53BDEB" />
                                            <path d="M14.5.653L8.291 6.862 7.329 5.9 5.9 7.33l2.362 2.362 7.638-7.638L14.5.653z" fill="#53BDEB" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Input bar */}
            <form
                onSubmit={handleSend}
                className="px-3 py-2.5 flex items-center gap-3 shrink-0"
                style={{ background: "#1F2C34" }}
            >
                <div className="flex gap-1 text-[#aebac1]">
                    <button type="button" className="p-2 rounded-full hover:bg-[#374045] transition-colors">
                        <Smile className="h-5 w-5" />
                    </button>
                    <button type="button" className="p-2 rounded-full hover:bg-[#374045] transition-colors">
                        <Paperclip className="h-5 w-5" />
                    </button>
                </div>
                <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={sending}
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm text-[#d1d7db] placeholder:text-[#8696a0] focus:outline-none"
                    style={{ background: "#2A3942" }}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                        }
                    }}
                />
                <button
                    type="submit"
                    disabled={sending || !inputValue.trim()}
                    className="h-10 w-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                    style={{ background: "#00a884" }}
                >
                    <Send className="h-4 w-4 text-white ml-0.5" />
                </button>
            </form>
        </div>
    )
}
