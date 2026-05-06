"use client"

import { useState } from "react"
import { FileText, Calendar, Tag, X, Plus, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhatsAppCRMPanelProps {
    conversation: any | null
}

const AVATAR_COLORS = ["#D97706", "#7C3AED", "#0284C7", "#DC2626", "#059669", "#DB2777", "#0891B2"]

function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
}

const TAG_COLORS: Record<string, string> = {
    "Financeiro":  "bg-blue-100 text-blue-700",
    "Holerite":    "bg-purple-100 text-purple-700",
    "RH":          "bg-emerald-100 text-emerald-700",
    "Urgente":     "bg-red-100 text-red-700",
    "Benefícios":  "bg-amber-100 text-amber-700",
}

const DEFAULT_TAGS = ["Holerite", "Financeiro"]

export function WhatsAppCRMPanel({ conversation }: WhatsAppCRMPanelProps) {
    const [tags, setTags] = useState<string[]>(DEFAULT_TAGS)
    const [addingTag, setAddingTag] = useState(false)
    const [newTag, setNewTag] = useState("")

    if (!conversation) {
        return (
            <div className="w-[260px] shrink-0 border-l border-slate-200 bg-white flex items-center justify-center">
                <p className="text-xs text-slate-400 text-center px-5 leading-relaxed">
                    Selecione uma conversa para ver as informações
                </p>
            </div>
        )
    }

    const employee = conversation.employee
    const name = employee?.name || "—"
    const phone = employee?.phone || "Não informado"
    const position = employee?.position || null
    const cpf = employee?.cpf || null
    const salary = employee?.salary ?? null
    const pagamento = employee?.pagamento ?? null
    const hireDate = employee?.hireDate ? new Date(employee.hireDate).toLocaleDateString("pt-BR") : null
    const bankName = employee?.bankName || null
    const bankAgency = employee?.bankAgency || null
    const bankAccount = employee?.bankAccount || null
    const isPendente = pagamento && pagamento.toLowerCase().includes("pend")
    const deptName = employee?.department?.name || employee?.department || null

    const avatarColor = getAvatarColor(name)
    const initials = getInitials(name)

    function addTag() {
        const t = newTag.trim()
        if (t && !tags.includes(t)) setTags(prev => [...prev, t])
        setNewTag("")
        setAddingTag(false)
    }

    function removeTag(tag: string) {
        setTags(prev => prev.filter(t => t !== tag))
    }

    return (
        <div className="w-[260px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">

            {/* Avatar + Name */}
            <div className="flex flex-col items-center pt-6 pb-4 px-4 border-b border-slate-100">
                <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md mb-3"
                    style={{ background: avatarColor }}
                >
                    {initials}
                </div>
                <h3 className="font-bold text-slate-900 text-sm text-center leading-tight">{name}</h3>
                <p className="text-xs text-slate-500 mt-1 font-mono">{phone}</p>
            </div>

            {/* CRM Info */}
            <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Informações de CRM</p>

                {/* Status */}
                <div className="mb-3">
                    <p className="text-[10px] text-slate-400 mb-1">Status do Lead</p>
                    <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        isPendente ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                        {isPendente ? "Pagamento Pendente" : "Colaborador Ativo"}
                    </span>
                </div>

                {/* Vincular Unidade */}
                <div className="mb-3">
                    <p className="text-[10px] text-slate-400 mb-1">Vincular Unidade</p>
                    <div className="relative">
                        <select
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-7"
                            defaultValue={deptName ?? ""}
                        >
                            <option value="">Sem unidade</option>
                            {deptName && <option value={deptName}>{deptName}</option>}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                            <span
                                key={tag}
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium group",
                                    TAG_COLORS[tag] ?? "bg-slate-100 text-slate-600"
                                )}
                            >
                                {tag}
                                <button
                                    onClick={() => removeTag(tag)}
                                    className="opacity-40 hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </span>
                        ))}

                        {addingTag ? (
                            <input
                                autoFocus
                                value={newTag}
                                onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") addTag()
                                    if (e.key === "Escape") { setAddingTag(false); setNewTag("") }
                                }}
                                onBlur={addTag}
                                placeholder="Nova tag..."
                                className="text-[11px] border border-slate-300 rounded-full px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 w-20"
                            />
                        ) : (
                            <button
                                onClick={() => setAddingTag(true)}
                                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                <Plus className="h-3 w-3" /> Adicionar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Employee Data */}
            {(position || cpf || salary !== null || hireDate || bankName) && (
                <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Dados do Funcionário</p>
                    <div className="space-y-1.5">
                        {position && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Função</span>
                                <span className="text-xs text-slate-700 font-medium truncate max-w-[55%]">{position}</span>
                            </div>
                        )}
                        {deptName && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Unidade</span>
                                <span className="text-xs text-slate-700 font-medium truncate max-w-[55%]">{deptName}</span>
                            </div>
                        )}
                        {cpf && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">CPF</span>
                                <span className="text-xs text-slate-600 font-mono">{cpf}</span>
                            </div>
                        )}
                        {salary !== null && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Salário</span>
                                <span className={cn("text-xs font-bold", isPendente ? "text-red-600" : "text-emerald-600")}>
                                    R$ {Number(salary).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        {hireDate && (
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Admissão</span>
                                <span className="text-xs text-slate-600">{hireDate}</span>
                            </div>
                        )}
                        {bankName && (
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Banco</span>
                                <span className="text-xs text-slate-600 text-right max-w-[55%] leading-snug">
                                    {bankName}
                                    {bankAgency ? ` · Ag.${bankAgency}` : ""}
                                    {bankAccount ? ` · C.${bankAccount}` : ""}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Ações Rápidas */}
            <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Ações Rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                    <button className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors border border-slate-200">
                        <FileText className="h-5 w-5" />
                        <span className="text-[11px] font-medium">Enviar PDF</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors border border-slate-200">
                        <Calendar className="h-5 w-5" />
                        <span className="text-[11px] font-medium">Agendar</span>
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 mt-auto">
                <button className="w-full text-xs font-semibold text-red-500 hover:text-red-700 py-1.5 transition-colors">
                    Bloquear Contato
                </button>
            </div>
        </div>
    )
}
