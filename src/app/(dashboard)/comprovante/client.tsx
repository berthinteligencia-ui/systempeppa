"use client"

import { useState, useEffect } from "react"
import { FileText, CheckCircle2, FileUp, Trash2, Building2, Loader2, SendHorizontal, Cloud, Receipt, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ComprovanteData, sendMassMessage, extractComprovanteData, saveComprovantes, deleteComprovante } from "@/lib/actions/comprovante"
import { Button } from "@/components/ui/button"

type Department = { id: string; name: string }
type PayrollAnalysis = {
    id: string
    month: number
    year: number
    department?: { name: string } | null
    data?: any
}

interface ComprovanteClientProps {
    departments: Department[]
    fechamentos: PayrollAnalysis[]
    comprovantes: any[]
    companyId: string
    userRole?: string
}

// Spinning ring loading overlay
function LoadingOverlay({ label }: { label: string }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1a2744]/92 rounded-2xl backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="relative h-16 w-16 mb-4">
                {/* outer track */}
                <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
                {/* fast outer ring */}
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-400 animate-spin" style={{ animationDuration: "0.9s" }} />
                {/* slow inner ring reverse */}
                <div className="absolute inset-[5px] rounded-full border-[2px] border-transparent border-t-indigo-300/60 animate-spin" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} />
                {/* center dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
                </div>
            </div>
            <span className="text-white/90 font-bold uppercase tracking-[0.2em] text-[9px]">{label}</span>
            {/* scanning bar */}
            <div className="mt-4 w-20 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-blue-400/80 rounded-full animate-[ping_1.2s_ease-in-out_infinite]" />
            </div>
        </div>
    )
}

export function ComprovanteClient({ departments, fechamentos, comprovantes, companyId, userRole }: ComprovanteClientProps) {
    const router = useRouter()

    // Per-card state
    const [pendingLote, setPendingLote] = useState<File[]>([])
    const [pendingComp, setPendingComp] = useState<File[]>([])
    const [dragActive, setDragActive] = useState<'lote' | 'comp' | null>(null)
    const [analyzingCard, setAnalyzingCard] = useState<'lote' | 'comp' | null>(null)

    const [selectedBankLote, setSelectedBankLote] = useState("")
    const [selectedBankComp, setSelectedBankComp] = useState("")

    const [lastCount, setLastCount] = useState(0)
    const [showSuccess, setShowSuccess] = useState(false)

    // Mass messaging
    const [massUnit, setMassUnit] = useState("all")
    const [isSendingMass, setIsSendingMass] = useState(false)

    useEffect(() => {
        if (showSuccess) {
            const t = setTimeout(() => setShowSuccess(false), 5000)
            return () => clearTimeout(t)
        }
    }, [showSuccess])

    // Drag handlers per card
    const makeDragHandlers = (card: 'lote' | 'comp') => ({
        onDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(card) },
        onDragOver:  (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(card) },
        onDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(null) },
        onDrop: (e: React.DragEvent) => {
            e.preventDefault(); e.stopPropagation(); setDragActive(null)
            const newFiles = Array.from(e.dataTransfer.files)
            if (card === 'lote') setPendingLote(prev => [...prev, ...newFiles])
            else setPendingComp(prev => [...prev, ...newFiles])
        },
    })

    const handleFileInputLote = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setPendingLote(prev => [...prev, ...Array.from(e.target.files!)])
    }
    const handleFileInputComp = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setPendingComp(prev => [...prev, ...Array.from(e.target.files!)])
    }

    const analyzeFiles = async (card: 'lote' | 'comp') => {
        const pending = card === 'lote' ? pendingLote : pendingComp
        const bank    = card === 'lote' ? selectedBankLote : selectedBankComp
        if (pending.length === 0) return
        if (!bank) { alert("Selecione um banco antes de analisar."); return }

        setAnalyzingCard(card)
        const filesToProcess = [...pending]
        card === 'lote' ? setPendingLote([]) : setPendingComp([])

        for (const rawFile of filesToProcess) {
            try {
                const formData = new FormData()
                formData.append("file", rawFile)
                const records = await extractComprovanteData(formData, bank)
                const buffer  = await rawFile.arrayBuffer()
                await saveComprovantes({
                    records: records.map(r => ({ ...r, fileName: rawFile.name })),
                    fileData: { name: rawFile.name, type: rawFile.type, buffer },
                })
            } catch (err) {
                console.error("Erro ao processar arquivo:", err)
            }
        }

        setLastCount(filesToProcess.length)
        setShowSuccess(true)
        setAnalyzingCard(null)
        router.refresh()
    }

    const handleSendMass = async () => {
        setIsSendingMass(true)
        try {
            const res = await sendMassMessage({
                departmentId: massUnit,
                month: new Date().getMonth() + 1,
                year:  new Date().getFullYear(),
            })
            if (res.success) alert(`Sucesso! ${res.count} funcionários notificados.`)
            else alert(res.message)
        } catch (err: any) {
            alert("Erro ao enviar mensagens: " + err.message)
        } finally {
            setIsSendingMass(false)
        }
    }

    const BANKS = [
        { value: "BANCO DO BRASIL", label: "Banco do Brasil" },
        { value: "BRADESCO",        label: "Bradesco" },
        { value: "MENTORE",         label: "Mentore" },
        { value: "CAIXA ECONOMICA", label: "Caixa Econômica" },
        { value: "ITAU",            label: "Itaú" },
    ]

    return (
        <div className="p-8 flex flex-col gap-8 animate-in fade-in duration-700">

            {/* Header */}
            <div>
                <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-2">Módulo Operacional</p>
                <h1 className="text-4xl font-black text-[#1a2744] leading-tight">Processamento de Documentos</h1>
                <p className="text-slate-500 mt-2 text-sm">Análise inteligente de relatórios e comprovantes vinculados aos funcionários.</p>
            </div>

            {/* 3-column layout — each column: card + config + button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">

                {/* ── Col 1: Relatório em Lote ── */}
                <div className="flex flex-col gap-4">
                    {/* Upload card */}
                    <div
                        {...makeDragHandlers('lote')}
                        className={cn(
                            "relative bg-white rounded-2xl p-8 shadow-sm cursor-pointer transition-all duration-200 select-none",
                            dragActive === 'lote' ? "ring-2 ring-blue-400 shadow-md scale-[1.01]" : "hover:shadow-md"
                        )}
                    >
                        <input
                            type="file" multiple accept=".pdf"
                            onChange={handleFileInputLote}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="h-14 w-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                            <FileText className="h-7 w-7 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1a2744]">Relatório em Lote</h3>
                        <p className="text-slate-500 text-sm mt-1">Processar folha completa</p>
                        {pendingLote.length > 0 && (
                            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                {pendingLote.length} arquivo{pendingLote.length > 1 ? "s" : ""} selecionado{pendingLote.length > 1 ? "s" : ""}
                            </span>
                        )}
                        {analyzingCard === 'lote' && <LoadingOverlay label="Processando..." />}
                    </div>

                    {/* Config */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-[#1a2744]" />
                            <span className="font-black text-[#1a2744] uppercase tracking-widest text-[10px]">Banco de Destino</span>
                        </div>
                        <div className="px-5 py-4">
                            <Select value={selectedBankLote} onValueChange={setSelectedBankLote}>
                                <SelectTrigger className="h-10 bg-slate-50 border-slate-200 font-semibold text-slate-700 rounded-xl text-sm">
                                    <SelectValue placeholder="Escolha o banco..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {BANKS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Analyze button */}
                    <div className="flex gap-2">
                        <Button
                            onClick={() => analyzeFiles('lote')}
                            disabled={analyzingCard !== null || !selectedBankLote || pendingLote.length === 0}
                            className="flex-1 h-11 bg-[#1a2744] hover:bg-[#0f1a30] disabled:opacity-40 text-white font-bold uppercase tracking-widest text-xs rounded-xl gap-2 transition-all"
                        >
                            {analyzingCard === 'lote'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><FileUp className="h-4 w-4" />
                                  {pendingLote.length > 0
                                    ? `Analisar ${pendingLote.length} ${pendingLote.length === 1 ? "Arquivo" : "Arquivos"}`
                                    : "Analisar Relatório"
                                  }</>
                            }
                        </Button>
                        {pendingLote.length > 0 && (
                            <Button
                                variant="ghost" size="icon"
                                onClick={() => setPendingLote([])}
                                className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Col 2: Comprovante de Pagamento ── */}
                <div className="flex flex-col gap-4">
                    {/* Upload card */}
                    <div
                        {...makeDragHandlers('comp')}
                        className={cn(
                            "relative bg-white rounded-2xl p-8 shadow-sm cursor-pointer transition-all duration-200 select-none",
                            dragActive === 'comp' ? "ring-2 ring-indigo-400 shadow-md scale-[1.01]" : "hover:shadow-md"
                        )}
                    >
                        <input
                            type="file" multiple accept=".pdf"
                            onChange={handleFileInputComp}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="h-14 w-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                            <Receipt className="h-7 w-7 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1a2744]">Comprovante de Pagamento</h3>
                        <p className="text-slate-500 text-sm mt-1">Vincular ao extrato do funcionário</p>
                        {pendingComp.length > 0 && (
                            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                                {pendingComp.length} arquivo{pendingComp.length > 1 ? "s" : ""} selecionado{pendingComp.length > 1 ? "s" : ""}
                            </span>
                        )}
                        {analyzingCard === 'comp' && <LoadingOverlay label="Vinculando..." />}
                    </div>

                    {/* Config */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-[#1a2744]" />
                            <span className="font-black text-[#1a2744] uppercase tracking-widest text-[10px]">Banco de Destino</span>
                        </div>
                        <div className="px-5 py-4">
                            <Select value={selectedBankComp} onValueChange={setSelectedBankComp}>
                                <SelectTrigger className="h-10 bg-slate-50 border-slate-200 font-semibold text-slate-700 rounded-xl text-sm">
                                    <SelectValue placeholder="Escolha o banco..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {BANKS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Analyze button */}
                    <div className="flex gap-2">
                        <Button
                            onClick={() => analyzeFiles('comp')}
                            disabled={analyzingCard !== null || !selectedBankComp || pendingComp.length === 0}
                            className="flex-1 h-11 bg-[#1a2744] hover:bg-[#0f1a30] disabled:opacity-40 text-white font-bold uppercase tracking-widest text-xs rounded-xl gap-2 transition-all"
                        >
                            {analyzingCard === 'comp'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><FileUp className="h-4 w-4" />
                                  {pendingComp.length > 0
                                    ? `Analisar ${pendingComp.length} ${pendingComp.length === 1 ? "Arquivo" : "Arquivos"}`
                                    : "Analisar Comprovante"
                                  }</>
                            }
                        </Button>
                        {pendingComp.length > 0 && (
                            <Button
                                variant="ghost" size="icon"
                                onClick={() => setPendingComp([])}
                                className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Col 3: Notifications ── */}
                <div className="flex flex-col gap-4">
                    {/* Notifications panel */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="h-11 w-11 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                                <MessageSquare className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-[#1a2744] uppercase tracking-widest text-xs leading-none">Notificações</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Informar Funcionários</p>
                            </div>
                        </div>

                        {/* Checkboxes */}
                        <div className="px-6 py-5 flex flex-col gap-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seletor de Unidade</p>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={massUnit === "all"}
                                        onChange={() => setMassUnit("all")}
                                        className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                                    />
                                    <span className={cn("text-sm font-medium transition-colors", massUnit === "all" ? "text-[#1a2744]" : "text-slate-500 group-hover:text-slate-700")}>
                                        Todas as Unidades
                                    </span>
                                </label>
                                {departments.map(d => (
                                    <label key={d.id} className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={massUnit === d.id}
                                            onChange={() => setMassUnit(d.id)}
                                            className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                                        />
                                        <span className={cn("text-sm font-medium transition-colors", massUnit === d.id ? "text-[#1a2744]" : "text-slate-500 group-hover:text-slate-700")}>
                                            {d.name}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {/* Message preview */}
                            <div className="mt-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-slate-500 text-xs italic leading-relaxed">
                                    &ldquo;Olá! Seu comprovante de pagamento já está disponível no portal. Clique para acessar o PDF completo.&rdquo;
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Enviar Avisos — aligned with the two analyze buttons */}
                    <Button
                        onClick={handleSendMass}
                        disabled={isSendingMass}
                        className="w-full h-11 bg-[#0a1b4d] hover:bg-[#071335] text-white font-black uppercase tracking-widest text-xs rounded-xl gap-2 transition-all active:scale-95"
                    >
                        {isSendingMass
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><SendHorizontal className="h-4 w-4" /> Enviar Avisos</>
                        }
                    </Button>
                </div>
            </div>

            {/* Success feedback */}
            {showSuccess && (
                <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl animate-in slide-in-from-bottom-4 duration-500">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-emerald-900 text-sm">Arquivos Processados com Sucesso</h4>
                        <p className="text-emerald-700/70 text-xs mt-0.5">{lastCount} documentos analisados e vinculados aos funcionários.</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/funcionarios')}
                        className="bg-white border border-emerald-200 text-emerald-700 font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-emerald-100 shrink-0"
                    >
                        Ver Funcionários
                    </Button>
                </div>
            )}
        </div>
    )
}
