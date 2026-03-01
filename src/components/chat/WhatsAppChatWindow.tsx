"use client"

import { useState, useEffect, useRef } from "react"
import { Send, MoreVertical, Paperclip, Smile } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface WhatsAppChatWindowProps {
    conversationId: string | null
    onMessageSent: () => void
}

export function WhatsAppChatWindow({ conversationId, onMessageSent }: WhatsAppChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([])
    const [conversation, setConversation] = useState<any>(null)
    const [inputValue, setInputValue] = useState("")
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchMessages = async () => {
        if (!conversationId) return
        try {
            const resp = await fetch(`/api/whatsapp/messages?conversationId=${conversationId}`)
            if (resp.ok) {
                const data = await resp.json()
                setMessages(data)
            }
        } catch (err) {
            console.error(err)
        }
    }

    const fetchConversationDetails = async () => {
        if (!conversationId) return
        try {
            const resp = await fetch("/api/whatsapp/conversations")
            if (resp.ok) {
                const conversations = await resp.json()
                const conv = conversations.find((c: any) => c.id === conversationId)
                if (conv) setConversation(conv)
            }
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchMessages()
        fetchConversationDetails()
        const timer = setInterval(fetchMessages, 3000) // Polling simple
        return () => clearInterval(timer)
    }, [conversationId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
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
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-4 border-emerald-500">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Send className="h-8 w-8 text-emerald-500 rotate-45" />
                </div>
                <h2 className="text-2xl font-light text-slate-800">WhatsApp Interno</h2>
                <p className="text-slate-500 mt-2 text-sm max-w-xs text-center">
                    Mantenha contato direto com seus funcionários de forma profissional e centralizada.
                </p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-[#e5ddd5] bg-[url('https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-l-light-mode.jpg')] bg-repeat bg-contain shadow-inner">
            {/* Chat Header */}
            <div className="px-4 py-2 bg-[#f0f2f5] flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarFallback className="bg-slate-200 text-slate-600">
                            {conversation?.employee?.name.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold text-slate-900 text-sm">
                            {conversation?.employee?.name || "Carregando..."}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {conversation?.employee?.position || "Online"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 text-slate-500">
                    <button className="hover:text-blue-600 transition-colors">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
            >
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "max-w-[70%] p-2 rounded-lg text-sm shadow-sm relative",
                            msg.senderType === "COMPANY"
                                ? "self-end bg-[#dcf8c6] text-slate-900 rounded-tr-none"
                                : "self-start bg-white text-slate-900 rounded-tl-none"
                        )}
                    >
                        <p className="mb-4">{msg.content}</p>
                        <span className="absolute bottom-1 right-2 text-[10px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSend}
                className="px-4 py-3 bg-[#f0f2f5] flex items-center gap-4 shadow-inner"
            >
                <div className="flex gap-3 text-slate-500">
                    <Smile className="h-6 w-6 cursor-pointer hover:text-slate-700" />
                    <Paperclip className="h-6 w-6 cursor-pointer hover:text-slate-700" />
                </div>
                <div className="flex-1">
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={loading}
                        placeholder="Digite uma mensagem"
                        className="w-full px-4 py-2.5 bg-white rounded-lg text-sm focus:outline-none shadow-sm"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    className="h-10 w-10 bg-[#00a884] rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                    <Send className="h-5 w-5 text-white ml-0.5" />
                </button>
            </form>
        </div>
    )
}
