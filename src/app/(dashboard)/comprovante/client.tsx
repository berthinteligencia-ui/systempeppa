"use client"

import { useState, useEffect } from "react"
import { FileText, CheckCircle2, FileUp, Building2, Loader2, SendHorizontal, Cloud, Receipt, MessageSquare, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sendMassMessage, analisarESalvarComprovante, extractComprovanteData, saveComprovantes } from "@/lib/actions/comprovante"
import { Button } from "@/components/ui/button"

type Department = { id: string; name: string }
type Bank = { id: string; name: string; code: string }
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
    banks: Bank[]
    companyId: string
    userRole?: string
}

// Spinning ring loading overlay
function LoadingOverlay({ label }: { label: string }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1a2744]/92 rounded-2xl backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="relative h-16 w-16 mb-4">
                <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-400 animate-spin" style={{ animationDuration: "0.9s" }} />
                <div className="absolute inset-[5px] rounded-full border-[2px] border-transparent border-t-indigo-300/60 animate-spin" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
                </div>
            </div>
            <span className="text-white/90 font-bold uppercase tracking-[0.2em] text-[9px]">{label}</span>
            <div className="mt-4 w-20 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-blue-400/80 rounded-full animate-[ping_1.2s_ease-in-out_infinite]" />
            </div>
        </div>
    )
}

export function ComprovanteClient({ departments, fechamentos, banks, companyId, userRole }: ComprovanteClientProps) {
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

    // Drag handlers
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
        if (pending.length === 0) return

        setAnalyzingCard(card)
        const filesToProcess = [...pending]
        if (card === 'lote') setPendingLote([])
        else setPendingComp([])

        let count = 0
        for (const rawFile of filesToProcess) {
            try {
                const formData = new FormData()
                formData.append("file", rawFile)

                if (card === 'comp') {
                    // Extrai CPF do PDF localmente, sem webhook
                    await analisarESalvarComprovante(formData)
                    count++
                } else {
                    // Lote: usa webhook para relatório completo
                    const records = await extractComprovanteData(formData, selectedBankLote || undefined, "relatorio")
                    if (records && records.length > 0) {
                        const saveForm = new FormData()
                        saveForm.append("file", rawFile)
                        saveForm.append("records", JSON.stringify(records.map(r => ({ ...r, fileName: rawFile.name }))))
                        const res = await saveComprovantes(saveForm) as { success: boolean; count: number }
                        if (res?.success) count += res.count
                    }
                }
            } catch (err) {
                console.error("Erro ao processar arquivo:", err)
            }
        }

        setLastCount(count)
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

    return (
        <div className="p-8 flex flex-col gap-10 animate-in fade-in duration-700 max-w-[1600px] mx-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#1a2744] leading-tight tracking-tight">Processamento de Documentos</h1>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Extração inteligente e vínculo automático de comprovantes bancários.</p>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

                {/* Relatórios */}
                <div className="flex flex-col gap-5 h-full">
                    <div
                        {...makeDragHandlers('lote')}
                        className={cn(
                            "relative bg-white rounded-3xl p-10 shadow-sm border border-slate-100 cursor-pointer transition-all duration-300 group overflow-hidden flex-1",
                            dragActive === 'lote' ? "ring-4 ring-blue-500/20 border-blue-400 scale-[1.02] shadow-xl" : "hover:shadow-xl hover:-translate-y-1"
                        )}
                    >
                        <input type="file" multiple accept=".pdf" onChange={handleFileInputLote} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 border border-blue-100 transition-transform group-hover:scale-110 relative">
                            <FileText className="h-8 w-8 text-blue-600" />
                            <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-1 shadow-sm border border-blue-100">
                                <UploadCloud className="h-3 w-3 text-blue-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-[#1a2744]">Relatório em Lote</h3>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-2">Folha Mensal Completa</p>
                        {pendingLote.length > 0 && (
                            <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 animate-in zoom-in-95">
                                <FileText className="h-3 w-3" /> {pendingLote.length} Processando
                            </div>
                        )}
                        {analyzingCard === 'lote' && <LoadingOverlay label="Escaneando Relatório" />}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Banco de Origem</span>
                        </div>
                        <Select value={selectedBankLote} onValueChange={setSelectedBankLote}>
                            <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-bold text-slate-700 rounded-xl text-xs focus:ring-4 focus:ring-blue-500/10">
                                <SelectValue placeholder="Escolha o banco..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200">
                                {["BANCO DO BRASIL", "BRADESCO", "ITAÚ", "CAIXA ECONÔMICA", "SANTANDER", "MENTORE"].map(b => (
                                    <SelectItem key={b} value={b} className="font-bold text-xs py-3">{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        onClick={() => analyzeFiles('lote')}
                        disabled={analyzingCard !== null || !selectedBankLote || pendingLote.length === 0}
                        className="h-14 bg-[#1a2744] hover:bg-[#0f1a30] text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-lg shadow-[#1a2744]/20 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                    >
                        <Cloud className="h-4 w-4 mr-2" /> Analisar Lote
                    </Button>
                </div>

                {/* Comprovantes */}
                <div className="flex flex-col gap-5 h-full">
                    <div
                        {...makeDragHandlers('comp')}
                        className={cn(
                            "relative bg-white rounded-3xl p-10 shadow-sm border border-slate-100 cursor-pointer transition-all duration-300 group overflow-hidden flex-1",
                            dragActive === 'comp' ? "ring-4 ring-indigo-500/20 border-indigo-400 scale-[1.02] shadow-xl" : "hover:shadow-xl hover:-translate-y-1"
                        )}
                    >
                        <input type="file" multiple accept=".pdf" onChange={handleFileInputComp} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 border border-indigo-100 transition-transform group-hover:scale-110 relative">
                            <Receipt className="h-8 w-8 text-indigo-600" />
                            <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-1 shadow-sm border border-indigo-100">
                                <UploadCloud className="h-3 w-3 text-indigo-400" />
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-[#1a2744]">Comprovante Individual</h3>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-2">Vínculo Direto</p>
                        {pendingComp.length > 0 && (
                            <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-200 animate-in zoom-in-95">
                                <Receipt className="h-3 w-3" /> {pendingComp.length} Pendentes
                            </div>
                        )}
                        {analyzingCard === 'comp' && <LoadingOverlay label="Viculando Dados" />}
                    </div>

                    <div className="h-[92px] opacity-0 pointer-events-none md:block hidden" aria-hidden="true" />

                    <Button
                        onClick={() => analyzeFiles('comp')}
                        disabled={analyzingCard !== null || pendingComp.length === 0}
                        className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                    >
                        <FileUp className="h-4 w-4 mr-2" /> Analisar Individual
                    </Button>
                </div>

                {/* Notificações */}
                <div className="flex flex-col gap-5 h-full">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 h-full flex flex-col flex-1">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-12 w-12 bg-emerald-100 rounded-2xl flex items-center justify-center border border-emerald-200">
                                <MessageSquare className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#1a2744]">Envio em Massa</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Informar Funcionários</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8 flex-1">
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" checked={massUnit === "all"} onChange={() => setMassUnit("all")} className="h-4 w-4 rounded accent-blue-600" />
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Todas as Unidades</span>
                                </label>
                                {departments.slice(0, 3).map(d => (
                                    <label key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input type="checkbox" checked={massUnit === d.id} onChange={() => setMassUnit(d.id)} className="h-4 w-4 rounded accent-blue-600" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{d.name}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-slate-400 text-[11px] leading-relaxed">
                                "Olá! Seu comprovante de pagamento já está disponível no portal. Clique para ver."
                            </div>
                        </div>

                        <Button
                            onClick={handleSendMass}
                            disabled={isSendingMass}
                            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                        >
                            {isSendingMass ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4 mr-2" />} Iniciar Disparo
                        </Button>
                    </div>
                </div>
            </div>

            {/* Success Bar */}
            {showSuccess && (
                <div className="flex items-center gap-5 bg-white border-2 border-emerald-500/20 p-6 rounded-3xl shadow-xl animate-in slide-in-from-bottom-5 duration-500 ease-out">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-black text-[#1a2744] text-base">Extração Finalizada</h4>
                        <p className="text-slate-500 text-sm font-medium">{lastCount} arquivos processados com sucesso.</p>
                    </div>
                    <Button onClick={() => router.push('/funcionarios')} className="bg-[#1a2744] text-white font-black uppercase tracking-widest text-[10px] px-6 py-3 rounded-xl shadow-lg shadow-[#1a2744]/20">
                        Ver Funcionários
                    </Button>
                </div>
            )}

        </div>
    )
}
