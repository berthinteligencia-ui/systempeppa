"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface WhatsAppCRMPanelProps {
    conversation: any | null
}

export function WhatsAppCRMPanel({ conversation }: WhatsAppCRMPanelProps) {
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
    const isEmployee = conversation.isEmployee === true
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
    const initial = name.charAt(0).toUpperCase()

    return (
        <div className="w-72 shrink-0 border-l border-slate-100 bg-white flex flex-col overflow-hidden">
            {/* Profile */}
            <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-slate-100">
                <Avatar className="h-16 w-16 mb-3 shadow-lg shadow-blue-900/10">
                    <AvatarFallback className="bg-gradient-to-br from-[#1e3b8a] to-indigo-600 text-white text-xl font-black">
                        {initial}
                    </AvatarFallback>
                </Avatar>
                <h3 className="font-black text-slate-900 text-base leading-tight text-center">{name}</h3>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {isEmployee && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            Funcionário
                        </span>
                    )}
                    {isPendente && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600">
                            Salário Pendente
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-400 mt-2 font-mono">{phone}</p>
            </div>

            {/* Dados */}
            <div className="flex-1 overflow-hidden px-4 py-4">
                <div className="rounded-xl border border-slate-100 overflow-hidden text-[11px]">
                    {position && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Função</span>
                            <span className="text-slate-700 font-semibold text-right max-w-[55%] truncate">{position}</span>
                        </div>
                    )}
                    {employee?.department && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-white border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Unidade</span>
                            <span className="text-slate-700 font-semibold text-right max-w-[55%] truncate">{employee.department}</span>
                        </div>
                    )}
                    {cpf && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">CPF</span>
                            <span className="text-slate-700 font-mono">{cpf}</span>
                        </div>
                    )}
                    {salary !== null && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-white border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Salário</span>
                            <span className={cn("font-black", isPendente ? "text-red-600" : "text-emerald-600")}>
                                R$ {salary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    {pagamento && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Pagamento</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase", isPendente ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700")}>
                                {pagamento}
                            </span>
                        </div>
                    )}
                    {hireDate && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-white border-b border-slate-100">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Admissão</span>
                            <span className="text-slate-700">{hireDate}</span>
                        </div>
                    )}
                    {bankName && (
                        <div className="flex justify-between items-center px-3 py-2.5 bg-slate-50">
                            <span className="font-bold text-slate-400 uppercase tracking-wide text-[9px]">Banco</span>
                            <span className="text-slate-700 text-right max-w-[60%] truncate">
                                {bankName}{bankAgency ? ` Ag.${bankAgency}` : ""}{bankAccount ? ` C.${bankAccount}` : ""}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
