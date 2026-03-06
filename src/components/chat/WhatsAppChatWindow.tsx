"use client"

import { useState, useEffect, useRef } from "react"
import { Send, MoreVertical, Paperclip, Smile, Phone, Video } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface WhatsAppChatWindowProps {
    conversationId: string | null
    onMessageSent: () => void
    onConversationLoaded?: (conv: any) => void
}

export function WhatsAppChatWindow({ conversationId, onMessageSent, onConversationLoaded }: WhatsAppChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([])
    const [conversation, setConversation] = useState<any>(null)
    const [inputValue, setInputValue] = useState("")
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchMessages = async () => {
        if (!conversationId) return
        try {
            const resp = await fetch(`/api/whatsapp/messages?conversationId=${conversationId}`)
            if (resp.ok) setMessages(await resp.json())
        } catch (err) { console.error(err) }
    }

    const fetchConversationDetails = async () => {
        if (!conversationId) return
        try {
            const resp = await fetch("/api/whatsapp/conversations")
            if (resp.ok) {
                const conversations = await resp.json()
                const conv = conversations.find((c: any) => c.id === conversationId)
                if (conv) {
                    setConversation(conv)
                    onConversationLoaded?.(conv)
                }
            }
        } catch (err) { console.error(err) }
    }

    useEffect(() => {
        setMessages([])
        setConversation(null)
        fetchMessages()
        fetchConversationDetails()
        const timer = setInterval(fetchMessages, 3000)
        return () => clearInterval(timer)
    }, [conversationId])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputValue.trim() || !conversationId) return
        setLoading(true)
        try {
            const resp = await fetch("/api/whatsapp/messages", {
                method: "POST",
                body: JSON.stringify({ content: inputValue, conversationId }),
            })
            if (resp.ok) {
                setInputValue("")
                fetchMessages()
                onMessageSent()
            }
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-5">
                    <Send className="h-9 w-9 text-blue-500 rotate-45" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">WhatsApp Business</h2>
                <p className="text-slate-500 mt-2 text-sm max-w-xs text-center leading-relaxed">
                    Selecione uma conversa ou inicie uma nova para se comunicar com seus funcionários.
                </p>
            </div>
        )
    }

    const employeeName = conversation?.employee?.name || "..."
    const employeeInitial = employeeName.charAt(0).toUpperCase()

    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Chat Header */}
            <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-600 text-white font-bold">{employeeInitial}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{employeeName}</p>
                        <p className="text-xs text-emerald-500 font-semibold">Online</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <Phone className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <Video className="h-5 w-5" />
                    </button>
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-2 bg-slate-50">
                {messages.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-xs text-slate-400 bg-white rounded-full px-4 py-1.5 shadow-sm border">
                            Início da conversa
                        </p>
                    </div>
                )}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={cn(
                            "max-w-[68%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm relative",
                            msg.senderType === "COMPANY"
                                ? "self-end bg-[#1a3c6e] text-white rounded-br-sm"
                                : "self-start bg-white text-slate-800 rounded-bl-sm border border-slate-100"
                        )}
                    >
                        <p className="leading-relaxed pr-10">{msg.content}</p>
                        <span className={cn(
                            "absolute bottom-2 right-3 text-[10px]",
                            msg.senderType === "COMPANY" ? "text-blue-200" : "text-slate-400"
                        )}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {msg.senderType === "COMPANY" && <span className="ml-1">✓✓</span>}
                        </span>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-3">
                <div className="flex gap-2 text-slate-400">
                    <button type="button" className="p-1.5 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Smile className="h-5 w-5" />
                    </button>
                    <button type="button" className="p-1.5 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Paperclip className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1">
                    <input
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        disabled={loading}
                        placeholder="Escreva uma mensagem..."
                        className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    className="h-10 w-10 bg-[#1a3c6e] rounded-xl flex items-center justify-center shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-40"
                >
                    <Send className="h-4 w-4 text-white ml-0.5" />
                </button>
            </form>
        </div>
    )
}
