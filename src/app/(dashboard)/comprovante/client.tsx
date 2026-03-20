"use client"

import { useState, useCallback } from "react"
import { Upload, FileText, CheckCircle2, AlertCircle, FileUp, Trash2, Building2, Calendar, Loader2, SendHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ComprovanteData, sendMassMessage } from "@/lib/actions/comprovante"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
}

const MESES = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" }, { value: 4, label: "Abril" },
    { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
]

export function ComprovanteClient({ departments, fechamentos }: ComprovanteClientProps) {
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<{ id: string; name: string; size: string; status: 'uploading' | 'analyzing' | 'done' | 'error' }[]>([])
    const [extractedRecords, setExtractedRecords] = useState<(ComprovanteData & { id: string, fileName: string })[]>([])
    const [isSending, setIsSending] = useState(false)
    const [isAnalyzingFiles, setIsAnalyzingFiles] = useState(false)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    
    // Mass Messaging State
    const [massUnit, setMassUnit] = useState<string>("all")
    const [massMonth, setMassMonth] = useState<string>(String(new Date().getMonth() + 1))
    const [massYear, setMassYear] = useState<string>(String(new Date().getFullYear()))
    const [isSendingMass, setIsSendingMass] = useState(false)

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
                const response = await fetch("https://webhook.berthia.com.br/webhook/disparofolha", {
                    method: "POST",
                    body: formData
                })
                if (!response.ok) throw new Error("Falha no envio")
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'done' as const } : f))
            } catch (error) {
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' as const } : f))
            }
        }
        setIsAnalyzingFiles(false)
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

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Análise de Comprovantes</h1>
                <p className="text-slate-500">Faça o upload dos documentos PDF para análise automática dos dados dos funcionários.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="space-y-6">
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={cn(
                                "relative group h-64 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300",
                                dragActive ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                            )}
                        >
                            <input type="file" multiple accept=".pdf" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex flex-col items-center text-center p-6 pointer-events-none">
                                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-transform duration-300 group-hover:scale-110 bg-white text-blue-600")}>
                                    <FileUp className="h-8 w-8" />
                                </div>
                                <p className="text-lg font-semibold text-slate-900">Arraste seus PDFs aqui</p>
                                <p className="text-sm text-slate-500 mt-1">ou clique para selecionar arquivos do seu computador</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Arquivos Selecionados</h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-500">{files.length} arquivo(s)</span>
                                    {pendingFiles.length > 0 && (
                                        <Button size="sm" onClick={analyzeFiles} disabled={isAnalyzingFiles} className="h-8 bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            {isAnalyzingFiles ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
                                            Enviar para Análise
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {files.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <FileText className="h-6 w-6 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">Nenhum comprovante selecionado ainda.</p>
                                    </div>
                                ) : (
                                    files.map((file) => (
                                        <div key={file.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400")}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                                        {file.status === 'done' ? "Enviado" : file.status === 'analyzing' ? "Enviando..." : "Pendente"}
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={() => removeFile(file.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-sm ring-1 ring-blue-50">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                <SendHorizontal className="h-5 w-5" />
                            </div>
                            <h3 className="font-bold text-slate-900">Envio em Massa</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Unidade</label>
                                <Select value={massUnit} onValueChange={setMassUnit}>
                                    <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Selecione a unidade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as unidades</SelectItem>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mês</label>
                                    <Select value={massMonth} onValueChange={setMassMonth}>
                                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MESES.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Ano</label>
                                    <Input 
                                        type="number" 
                                        value={massYear} 
                                        onChange={e => setMassYear(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200"
                                    />
                                </div>
                            </div>

                            <Button 
                                onClick={handleSendMass} 
                                disabled={isSendingMass}
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest gap-2 shadow-lg shadow-blue-200 mt-4"
                            >
                                {isSendingMass ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                                Enviar Mensagens
                            </Button>
                            
                            <p className="text-[10px] text-center text-slate-400 italic px-4">
                                Serão enviados apenas os funcionários com status de pagamento **efetuado**.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
