"use client"

import { useState, useEffect } from "react"
import { WhatsAppSidebar } from "./WhatsAppSidebar"
import { WhatsAppChatWindow } from "./WhatsAppChatWindow"

export function WhatsAppContainer() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchConversations = async () => {
        try {
            const resp = await fetch("/api/whatsapp/conversations")
            if (resp.ok) {
                const data = await resp.json()
                setConversations(data)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchConversations()
    }, [])

    return (
        <div className="flex bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200" style={{ height: "calc(100vh - 120px)" }}>
            <WhatsAppSidebar
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
                loading={loading}
            />
            <WhatsAppChatWindow
                conversationId={selectedConversationId}
                onMessageSent={fetchConversations}
            />
        </div>
    )
}
