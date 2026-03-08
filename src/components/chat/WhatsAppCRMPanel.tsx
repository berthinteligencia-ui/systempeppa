"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FileText, Calendar, X, Plus, ChevronDown, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

const STATUS_OPTIONS = ["Colaborador Ativo", "Colaborador Inativo", "Aguardando", "Lead"]
const STATUS_COLORS: Record<string, string> = {
    "Colaborador Ativo": "bg-emerald-100 text-emerald-700",
    "Colaborador Inativo": "bg-red-100 text-red-700",
    "Aguardando": "bg-amber-100 text-amber-700",
    "Lead": "bg-blue-100 text-blue-700",
}

const PRESET_TAGS = ["Financeiro", "Holerites", "RH", "Férias", "Urgente", "VT/VR"]

interface WhatsAppCRMPanelProps {
    conversation: any | null
}

export function WhatsAppCRMPanel({ conversation }: WhatsAppCRMPanelProps) {
    const [status, setStatus] = useState("Colaborador Ativo")
    const [showStatusDropdown, setShowStatusDropdown] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!conversation) {
        return (
            <div className="w-72 shrink-0 border-l border-slate-100 bg-white flex items-center justify-center">
                <p className="text-xs text-slate-400 text-center px-4">
                    Selecione uma conversa para ver as informações
                </p>
            </div>
        )
    }

    const employee = conversation.employee
    const name = employee?.name || "—"
    const phone = employee?.phone || "Não informado"
    const position = employee?.position || "—"
    const initial = name.charAt(0).toUpperCase()

    async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !conversation) return

        if (file.type !== "application/pdf") {
            alert("Por favor, selecione apenas arquivos PDF.")
            return
        }

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${conversation.companyId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `whatsapp/attachments/${fileName}`

            // Upload to 'backups' bucket (using it as general purpose since it exists and is configured)
            // Or ideally use an 'attachments' bucket if it existed.
            const { data, error: uploadError } = await supabase.storage
                .from("backups")
                .upload(filePath, file, { cacheControl: "3600", upsert: false })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from("backups")
                .getPublicUrl(filePath)

            // Send message with link
            const resp = await fetch("/api/whatsapp/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: `Arquivo enviado: ${publicUrl}`,
                    conversationId: conversation.id
                }),
            })

            if (!resp.ok) throw new Error("Erro ao enviar mensagem com o arquivo")

            alert("PDF enviado com sucesso!")
        } catch (err: any) {
            console.error("[CRM_PANEL] Error uploading PDF:", err)
            alert("Erro ao enviar PDF: " + err.message)
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    return (
        <div className="w-72 shrink-0 border-l border-slate-100 bg-white flex flex-col overflow-y-auto">
            {/* Profile */}
            <div className="flex flex-col items-center pt-8 pb-6 px-5 border-b border-slate-100">
                <Avatar className="h-20 w-20 mb-3">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold">
                        {initial}
                    </AvatarFallback>
                </Avatar>
                <h3 className="font-bold text-slate-900 text-base text-center">{name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{phone}</p>
                {employee?.department && (
                    <p className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">
                        {employee.department}
                    </p>
                )}
            </div>

            {/* CRM Info */}
            <div className="px-5 py-5 space-y-5 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Informações de CRM</p>

                {/* Status */}
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">Status do Lead</p>
                    <div className="relative">
                        <button
                            onClick={() => setShowStatusDropdown(o => !o)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer transition-all hover:opacity-80",
                                STATUS_COLORS[status] || "bg-slate-100 text-slate-600"
                            )}
                        >
                            {status}
                            <ChevronDown className="h-3 w-3" />
                        </button>
                        {showStatusDropdown && (
                            <div className="absolute top-8 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                                {STATUS_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => { setStatus(opt); setShowStatusDropdown(false) }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-bold", STATUS_COLORS[opt] || "bg-slate-100 text-slate-600")}>
                                            {opt}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="px-5 pb-6 border-t border-slate-100 pt-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Ações Rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="application/pdf"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 hover:border-blue-200 transition-colors group disabled:opacity-50"
                    >
                        {uploading ? (
                            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        )}
                        <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-600">
                            {uploading ? "Enviando..." : "Enviar PDF"}
                        </span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 hover:border-blue-200 transition-colors group">
                        <Calendar className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-600">Agendar</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
