"use client"

import { useState, useCallback, useEffect } from "react"
import { Upload, FileText, CheckCircle2, AlertCircle, FileUp, Trash2, Building2, Calendar, Loader2, SendHorizontal, Download, Search, Info, Cloud, ChevronRight, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSearchParams, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ComprovanteData, sendMassMessage, extractComprovanteData, saveComprovantes, deleteComprovante } from "@/lib/actions/comprovante"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Department = { id: string; name: string }
type PayrollAnalysis = { 
    id: string; 
    month: number; 
    year: number; 
    department?: { name: string } | null; 
    data?: any;
}

interface ComprovanteClientProps {
    departments: Department[]
    fechamentos: PayrollAnalysis[]
    comprovantes: any[]
    companyId: string
    userRole?: string
}

const MESES = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" }, { value: 4, label: "Abril" },
    { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
]

export function ComprovanteClient({ departments, fechamentos, comprovantes, companyId, userRole }: ComprovanteClientProps) {
    const isAllowedToDelete = userRole?.toUpperCase() === "ADMIN" || userRole?.toUpperCase() === "RH"
    const searchParams = useSearchParams()
    const router = useRouter()
    const cpfFilter = searchParams.get("cpf") || ""
    
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<{ id: string; name: string; size: string; status: 'uploading' | 'analyzing' | 'done' | 'error' }[]>([])
    const [extractedRecords, setExtractedRecords] = useState<(ComprovanteData & { id: string, fileName: string })[]>([])
    const [isSending, setIsSending] = useState(false)
    const [isAnalyzingFiles, setIsAnalyzingFiles] = useState(false)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    
    const [searchTerm, setSearchTerm] = useState(cpfFilter)
    const [filterMonth, setFilterMonth] = useState<string>("all")
    const [filterUnit, setFilterUnit] = useState<string>("all")
    
    // Mass Messaging State
    const [massUnit, setMassUnit] = useState<string>("all")
    const [massMonth, setMassMonth] = useState<string>(String(new Date().getMonth() + 1))
    const [massYear, setMassYear] = useState<string>(String(new Date().getFullYear()))
    const [isSendingMass, setIsSendingMass] = useState(false)

    useEffect(() => {
        if (cpfFilter) setSearchTerm(cpfFilter)
    }, [cpfFilter])

    const filteredComprovantes = comprovantes.filter(c => {
        const s = searchTerm.toLowerCase()
        const matchesSearch = !s || 
                             c.employeeName?.toLowerCase().includes(s) || 
                             c.cpf?.includes(s) || 
                             c.employee?.name?.toLowerCase().includes(s)
        
        const date = new Date(c.extractedAt)
        const matchesMonth = filterMonth === "all" || String(date.getMonth() + 1) === filterMonth
        const matchesUnit = filterUnit === "all" || c.employee?.departmentId === filterUnit

        return matchesSearch && matchesMonth && matchesUnit
    })

    const handleExport = () => {
        const headers = ["Funcionario", "CPF", "Valor", "Data Processamento", "CNPJ Origem"]
        const csvRows = filteredComprovantes.map(c => [
            `"${c.employee?.name || c.employeeName}"`,
            `"${c.cpf}"`,
            `"${c.amount ? Number(c.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "—"}"`,
            `"${new Date(c.extractedAt).toLocaleString('pt-BR')}"`,
            `"${c.originCnpj || "N/A"}"`
        ].join(";"))

        const csvContent = [headers.join(";"), ...csvRows].join("\n")
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `extrato_pagamentos_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleDownloadAllPDFs = async () => {
        const filesWithUrl = filteredComprovantes.filter(c => c.fileUrl)
        if (filesWithUrl.length === 0) {
            alert("Nenhum arquivo encontrado para download.")
            return
        }
        
        const count = filesWithUrl.length
        if (count > 5) {
            if (!confirm(`Isso irá iniciar o download de ${count} PDFs. Seu navegador pode bloquear múltiplos downloads; autorize se solicitado. Continuar?`)) return
        }

        for (const file of filesWithUrl) {
            const link = document.createElement("a")
            link.href = file.fileUrl
            link.download = file.fileName || `comprovante_${file.id}.pdf`
            link.target = "_blank"
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            await new Promise(r => setTimeout(r, 400))
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const newFiles = Array.from(e.dataTransfer.files)
            setPendingFiles(prev => [...prev, ...newFiles])
            
            const formatted = newFiles.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                name: f.name,
                size: (f.size / 1024).toFixed(1) + " KB",
                status: 'uploading' as const
            }))
            setFiles(prev => [...(formatted as any), ...prev])
        }
    }

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const newFiles = Array.from(e.target.files)
            setPendingFiles(prev => [...prev, ...newFiles])

            const formatted = newFiles.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                name: f.name,
                size: (f.size / 1024).toFixed(1) + " KB",
                status: 'uploading' as const
            }))
            setFiles(prev => [...formatted, ...prev])
        }
    }

    const analyzeFiles = async () => {
        if (pendingFiles.length === 0) return
        setIsAnalyzingFiles(true)
        const filesToProcess = [...pendingFiles]
        setPendingFiles([])

        for (const rawFile of filesToProcess) {
            const fileId = files.find(f => f.name === rawFile.name && f.status === 'uploading')?.id 
                           || Math.random().toString(36).substr(2, 9)
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'analyzing' } : f))

            try {
                const formData = new FormData()
                formData.append("file", rawFile)
                const records = await extractComprovanteData(formData)
                const buffer = await rawFile.arrayBuffer()
                await saveComprovantes({
                    records: records.map(r => ({ ...r, fileName: rawFile.name })),
                    fileData: {
                        name: rawFile.name,
                        type: rawFile.type,
                        buffer: buffer
                    }
                })
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'done' as const } : f))
            } catch (error) {
                console.error("Erro na análise/salvamento:", error)
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' as const } : f))
            }
        }
        setIsAnalyzingFiles(false)
        router.refresh()
    }

    const handleSendMass = async () => {
        setIsSendingMass(true)
        try {
            const res = await sendMassMessage({
                departmentId: massUnit,
                month: parseInt(massMonth),
                year: parseInt(massYear)
            })
            if (res.success) {
                alert(`Sucesso! ${res.count} funcionários notificados.`)
            } else {
                alert(res.message)
            }
        } catch (err: any) {
            alert("Erro ao enviar mensagens: " + err.message)
        } finally {
            setIsSendingMass(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este comprovante?")) return
        try {
            const res = await deleteComprovante(id)
            if (res.success) {
                router.refresh()
            }
        } catch (err: any) {
            alert("Erro ao excluir: " + err.message)
        }
    }

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    return (
        <div className="p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-[#152138] tracking-tight uppercase">Análise de Comprovantes</h1>
                <p className="text-slate-500 font-medium text-xs">Upload de PDFs para análise automática.</p>
            </div>

            {/* Top Grid: Upload & Config - 50/50 Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upload Panel */}
                <div className="relative group">
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={cn(
                            "relative h-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300",
                            dragActive 
                                ? "border-blue-500 bg-blue-50/50 scale-[1.01] shadow-2xl shadow-blue-500/10" 
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/30"
                        )}
                    >
                        <input type="file" multiple accept=".pdf" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        
                        <div className="flex flex-row items-center gap-4 px-6 w-full">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100">
                                <Cloud className="h-6 w-6 animate-pulse" />
                            </div>
                            
                            <div className="flex-1 space-y-0.5 min-w-0">
                                <h3 className="text-base font-black text-[#152138] truncate">Envio de Comprovantes</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                    PDF (Max. 50MB)
                                </p>
                            </div>

                            <Button className="h-10 px-4 bg-[#0a1b4d] hover:bg-[#071335] text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-xl shadow-blue-900/10 transition-all shrink-0">
                                Selecionar
                            </Button>
                        </div>

                        {/* Status Label (Bottom Right) */}
                        <div className="absolute bottom-4 right-6 flex items-center gap-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Análise IA</span>
                        </div>
                    </div>
                    
                    {/* Floating Analize Prompt */}
                    {pendingFiles.length > 0 && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 animate-in zoom-in-95 fade-in duration-300">
                            <Button 
                                onClick={analyzeFiles} 
                                disabled={isAnalyzingFiles} 
                                className="h-10 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-full shadow-2xl shadow-emerald-600/40 gap-2"
                            >
                                {isAnalyzingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                                Analizar {pendingFiles.length}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Config Panel - Matching Height - Highlighted */}
                <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-3xl p-6 border border-blue-100/60 shadow-xl shadow-blue-500/5 flex flex-col justify-center h-40 ring-1 ring-blue-50/50 transition-all hover:shadow-blue-500/10 hover:border-blue-200/60 group/config">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 px-1">
                            <SendHorizontal className="h-4 w-4 text-blue-600" />
                            <h3 className="font-black text-[#152138] uppercase tracking-widest text-[10px]">Envio em Massa</h3>
                        </div>

                        <div className="flex flex-row items-end gap-3 w-full">
                            <div className="flex-1 space-y-1.5 min-w-0">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">Unidade</label>
                                <Select value={massUnit} onValueChange={setMassUnit}>
                                    <SelectTrigger className="h-10 bg-white border-white shadow-sm font-bold text-slate-700 rounded-xl text-[11px]">
                                        <SelectValue placeholder="Unidade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-32 space-y-1.5 shrink-0">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">Mês/Ano</label>
                                <Select value={massMonth} onValueChange={setMassMonth}>
                                    <SelectTrigger className="h-10 bg-white border-white shadow-sm font-bold text-slate-700 rounded-xl text-[11px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MESES.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}/{massYear.slice(-2)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button 
                                onClick={handleSendMass} 
                                disabled={isSendingMass}
                                className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] rounded-xl shadow-xl shadow-blue-600/20 shrink-0 transition-all"
                            >
                                {isSendingMass ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Extrato Detail */}
            <div className="space-y-8 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-[#152138] tracking-tight">Extrato de Transferências</h2>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <Input 
                                placeholder="Filtrar por funcionário..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 w-80 bg-white border-slate-100 placeholder:text-slate-300 font-bold text-sm rounded-2xl shadow-sm focus:ring-blue-500"
                            />
                        </div>
                        <Button variant="outline" className="h-12 px-6 rounded-2xl border-slate-100 font-black text-[10px] uppercase tracking-widest gap-2 bg-white shadow-sm">
                            Março <Filter className="h-3 w-3 opacity-30" />
                        </Button>
                        <Button variant="outline" className="h-12 px-6 rounded-2xl border-slate-100 font-black text-[10px] uppercase tracking-widest gap-2 bg-white shadow-sm">
                            Sede SP <Filter className="h-3 w-3 opacity-30" />
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden min-h-[500px]">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-b border-slate-50">
                                <TableHead className="h-16 pl-10 font-black text-[11px] text-slate-400 uppercase tracking-widest">Funcionário</TableHead>
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest">CPF</TableHead>
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">Valor</TableHead>
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">Processamento</TableHead>
                                <TableHead className="font-black text-[11px] text-slate-400 uppercase tracking-widest text-center">Origem</TableHead>
                                <TableHead className="pr-10 text-right font-black text-[11px] text-slate-400 uppercase tracking-widest">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredComprovantes.map((c) => (
                                <TableRow key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                    <TableCell className="py-5 pl-10">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-12 w-12 border-2 border-slate-100 shadow-sm transition-transform duration-300 group-hover:scale-105">
                                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.employee?.name || c.employeeName}`} />
                                                <AvatarFallback className="bg-blue-600 text-white font-black text-xs">
                                                    {(c.employee?.name || c.employeeName)?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-black text-[#152138] text-base leading-tight">{c.employee?.name || c.employeeName}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{c.fileName}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-500 text-sm tracking-tight">{c.cpf}</TableCell>
                                    <TableCell className="text-center font-black text-[#152138] text-lg">
                                        {c.amount ? Number(c.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "—"}
                                    </TableCell>
                                    <TableCell className="text-center text-xs font-bold text-slate-400">
                                        {new Date(c.extractedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {c.originCnpj ? (
                                            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 border border-blue-100">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">CNPJ VALIDADO</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-1.5 border border-slate-100 text-slate-400 grayscale opacity-50">
                                                <span className="text-[9px] font-black uppercase tracking-widest">S/ ORIGEM</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-10 text-right">
                                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {c.fileUrl && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-10 w-10 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                                    onClick={() => window.open(c.fileUrl, '_blank')}
                                                >
                                                    <Download className="h-4.5 w-4.5" />
                                                </Button>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                            >
                                                <Info className="h-4.5 w-4.5" />
                                            </Button>
                                            {isAllowedToDelete && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-10 w-10 text-slate-200 hover:text-red-500 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                                    onClick={() => handleDelete(c.id)}
                                                >
                                                    <Trash2 className="h-4.5 w-4.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {comprovantes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <FileText className="h-12 w-12" />
                                            <p className="font-bold text-lg">Nenhum registro encontrado</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <button className="fixed bottom-10 right-10 h-16 w-16 bg-[#152138] text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40 hover:scale-110 active:scale-95 transition-all z-50">
                <span className="text-2xl font-black">?</span>
            </button>
        </div>
    )
}
