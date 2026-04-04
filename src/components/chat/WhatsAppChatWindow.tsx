"use client"

import { useState, useEffect, useRef } from "react"
import { Send, MoreVertical, Paperclip, Smile, Phone, Video, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface WhatsAppChatWindowProps {
    conversation: any | null        // conversa selecionada (vinda do Container)
    onMessageSent: () => void       // atualiza lista de conversas após envio
}

export function WhatsAppChatWindow({ conversation, onMessageSent }: WhatsAppChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([])
    const [inputValue, setInputValue] = useState("")
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const conversationId = conversation?.id ?? null

    // Função para mapear mensagens do banco para o frontend
    const mapMessage = (msg: any) => ({
        id: msg.id,
        content: msg.conteudo,
        senderType: msg.tipo === 'lead' ? 'EMPLOYEE' : 'COMPANY',
        createdAt: msg.created_at,
        conversationId: msg.lead_id
    })

    // Busca mensagens da tabela mensagens
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

    // Inicia ouvintes de Realtime + polling de fallback
    useEffect(() => {
        setMessages([])
        setError(null)
        setInputValue("")
        if (!conversationId) return

        fetchMessages()

        // Realtime: tenta receber INSERTs em tempo real
        const channel = supabase
            .channel(`mensagens:${conversationId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'mensagens_zap' },
                (payload) => {
                    const row = payload.new as any
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId ?? "")
                    const suffix = (conversationId ?? "").replace(/\D/g, "").slice(-8)
                    const rowPhone = (row.numero_funcionario ?? "").replace(/@.*$/, "").replace(/\D/g, "")
                    const matches = isUuid
                        ? row.lead_id === conversationId
                        : rowPhone.endsWith(suffix) || row.lead_id === conversationId
                    if (!matches) return
                    const newMsg = mapMessage(row)
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    onMessageSent()
                }
            )
            .subscribe()

        // Polling de fallback: re-busca a cada 4s para garantir sincronismo
        const interval = setInterval(fetchMessages, 4000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(interval)
        }
    }, [conversationId])

    // Scroll automático para o final
    useEffect(() => {
        if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    // Envia mensagem: salva no banco + dispara webhook
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
                // Adiciona a mensagem imediatamente sem esperar o Realtime
                setMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent])
                onMessageSent()
            } else {
                const body = await resp.json().catch(() => ({}))
                console.error("[CHAT] Erro ao enviar:", resp.status, body)
                setInputValue(textToSend) // devolve o texto se falhou
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
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-5">
                    <Send className="h-9 w-9 text-blue-500 rotate-45" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">WhatsApp Business</h2>
                <p className="text-slate-500 mt-2 text-sm max-w-xs text-center leading-relaxed">
                    Selecione uma conversa na lista para visualizar as mensagens.
                </p>
            </div>
        )
    }

    const employeeName = conversation.employee?.name ?? "—"
    const employeeInitial = employeeName.charAt(0).toUpperCase()

    return (
        <div className="flex-1 flex flex-col min-w-0">

            {/* Cabeçalho */}
            <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-600 text-white font-bold">
                            {employeeInitial}
                        </AvatarFallback>
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

            {/* Área de mensagens */}
            <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-scroll p-5 flex flex-col gap-2 bg-slate-50">

                {/* Erro de fetch */}
                {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="font-mono break-all">{error}</span>
                    </div>
                )}

                {/* Sem mensagens */}
                {!error && messages.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-xs text-slate-400 bg-white rounded-full px-4 py-1.5 shadow-sm border">
                            Início da conversa
                        </p>
                    </div>
                )}

                {/* Mensagens da tabela Message */}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={cn(
                            "max-w-[68%] px-3.5 pt-2.5 pb-1.5 rounded-2xl text-sm shadow-sm flex flex-col gap-1",
                            msg.senderType === "COMPANY"
                                ? "self-end bg-[#1a3c6e] text-white rounded-br-sm"
                                : "self-start bg-white text-slate-800 rounded-bl-sm border border-slate-100"
                        )}
                    >
                        <p className="leading-relaxed">{msg.content}</p>
                        <span className={cn(
                            "text-[10px] self-end flex items-center gap-0.5",
                            msg.senderType === "COMPANY" ? "text-blue-200" : "text-slate-400"
                        )}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {msg.senderType === "COMPANY" && <span>✓✓</span>}
                        </span>
                    </div>
                ))}
            </div>

            {/* Campo de envio */}
            <form onSubmit={handleSend} className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-3">
                <div className="flex gap-2 text-slate-400">
                    <button type="button" className="p-1.5 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Smile className="h-5 w-5" />
                    </button>
                    <button type="button" className="p-1.5 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <Paperclip className="h-5 w-5" />
                    </button>
                </div>
                <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={sending}
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                />
                <button
                    type="submit"
                    disabled={sending || !inputValue.trim()}
                    className="h-10 w-10 bg-[#1a3c6e] rounded-xl flex items-center justify-center shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-40"
                >
                    <Send className="h-4 w-4 text-white ml-0.5" />
                </button>
            </form>
        </div>
    )
}
