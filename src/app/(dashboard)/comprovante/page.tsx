"use client"

import { useState } from "react"
import { Upload, FileText, CheckCircle2, AlertCircle, FileUp, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ComprovantePage() {
    const [dragActive, setDragActive] = useState(false)
    const [files, setFiles] = useState<{ id: string; name: string; size: string; status: 'uploading' | 'analyzing' | 'done' | 'error' }[]>([])

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
            addFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            addFiles(Array.from(e.target.files))
        }
    }

    const addFiles = (newFiles: File[]) => {
        const formatted = newFiles.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            name: f.name,
            size: (f.size / 1024).toFixed(1) + " KB",
            status: 'analyzing' as const
        }))
        setFiles(prev => [...formatted, ...prev])

        // Mock analysis delay
        formatted.forEach(file => {
            setTimeout(() => {
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' as const } : f))
            }, 2000 + Math.random() * 2000)
        })
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
                {/* Upload Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={cn(
                            "relative group h-64 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300",
                            dragActive
                                ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                                : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                        )}
                    >
                        <input
                            type="file"
                            multiple
                            accept=".pdf"
                            onChange={handleFileInput}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center text-center p-6 pointer-events-none">
                            <div className={cn(
                                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
                                dragActive ? "bg-blue-500 text-white" : "bg-white text-blue-600 shadow-sm"
                            )}>
                                <FileUp className="h-8 w-8" />
                            </div>
                            <p className="text-lg font-semibold text-slate-900">Arraste seus PDFs aqui</p>
                            <p className="text-sm text-slate-500 mt-1">ou clique para selecionar arquivos do seu computador</p>
                            <div className="mt-4 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] uppercase font-bold text-slate-400 tracking-widest shadow-sm">
                                Apenas arquivos .PDF
                            </div>
                        </div>
                    </div>

                    {/* Recent Files */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Uploads Recentes</h2>
                            <span className="text-xs text-slate-500">{files.length} arquivos detectados</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {files.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm">Nenhum comprovante enviado ainda.</p>
                                </div>
                            ) : (
                                files.map((file) => (
                                    <div key={file.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                file.status === 'done' ? "bg-emerald-50 text-emerald-600" :
                                                    file.status === 'analyzing' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                                            )}>
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-500">{file.size}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider",
                                                        file.status === 'done' ? "text-emerald-500" :
                                                            file.status === 'analyzing' ? "text-blue-500 animate-pulse" : "text-slate-400"
                                                    )}>
                                                        {file.status === 'done' ? "Analizado" : file.status === 'analyzing' ? "Analisando..." : "Erro"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {file.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-[#152138] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-4">Como funciona?</h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                                    <p className="text-sm text-slate-300">Faça o upload de um ou mais comprovantes em formato PDF.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                                    <p className="text-sm text-slate-300">Nossa IA processa o documento extraindo valores, datas e dados do funcionário.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                                    <p className="text-sm text-slate-300">Os dados são validados contra o cadastro da empresa automaticamente.</p>
                                </li>
                            </ul>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="h-5 w-5 text-blue-600" />
                            <h4 className="font-bold text-slate-900">Estatísticas Mensais</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-bold uppercase text-slate-400 mb-1.5">
                                    <span>Concluídos</span>
                                    <span>85%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Processados</p>
                                    <p className="text-xl font-bold text-slate-900">124</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Pendentes</p>
                                    <p className="text-xl font-bold text-slate-900">12</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
