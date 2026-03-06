"use client"

import { useState, useEffect } from "react"
import { WhatsAppSidebar } from "./WhatsAppSidebar"
import { WhatsAppChatWindow } from "./WhatsAppChatWindow"
import { WhatsAppCRMPanel } from "./WhatsAppCRMPanel"

export function WhatsAppContainer() {
    const [selectedConversationId, setSelectedConversationId] = useState(null)
    const [conversations, setConversations] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeConversation, setActiveConversation] = useState(null)

    const fetchConversations = async () => {
        try {
            const resp = await fetch("/api/whatsapp/conversations")
            if (resp.ok) setConversations(await resp.json())
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchConversations() }, [])

    return (
        <div className="flex bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200" style={{ height: "calc(100vh - 140px)" }}>
            <WhatsAppSidebar conversations={conversations} selectedId={selectedConversationId} onSelect={setSelectedConversationId} loading={loading} />
            <WhatsAppChatWindow conversationId={selectedConversationId} onMessageSent={fetchConversations} onConversationLoaded={setActiveConversation} />
            <WhatsAppCRMPanel conversation={activeConversation} />
        </div>
    )
}
