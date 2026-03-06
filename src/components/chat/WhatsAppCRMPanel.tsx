"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FileText, Calendar, X, Plus, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

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
    const [tags, setTags] = useState<string[]>(["Financeiro", "Holerites"])
    const [showTagPicker, setShowTagPicker] = useState(false)
    const [showStatusDropdown, setShowStatusDropdown] = useState(false)

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

    function removeTag(tag: string) {
        setTags(t => t.filter(x => x !== tag))
    }

    function addTag(tag: string) {
        if (!tags.includes(tag)) setTags(t => [...t, tag])
        setShowTagPicker(false)
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
                {position && (
                    <span className="mt-2 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600">
                        {position}
                    </span>
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

                {/* Tags */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                            >
                                {tag}
                                <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </span>
                        ))}
                        <div className="relative">
                            <button
                                onClick={() => setShowTagPicker(o => !o)}
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                            >
                                <Plus className="h-2.5 w-2.5" /> Adicionar
                            </button>
                            {showTagPicker && (
                                <div className="absolute top-7 left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                                    {PRESET_TAGS.filter(t => !tags.includes(t)).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => addTag(tag)}
                                            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 transition-colors text-slate-700"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="px-5 pb-6 border-t border-slate-100 pt-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Ações Rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                    <button className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 hover:border-blue-200 transition-colors group">
                        <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-600">Enviar PDF</span>
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
