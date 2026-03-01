"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    Plus, CirclePlus, Search, SearchSlash, Download, History, Save, Archive,
    FileSpreadsheet, Upload, CheckCircle2, X, Calendar, Building2, FileUp,
    AlertTriangle, UserPlus, Users, ChevronRight, RotateCcw, Loader2, ShieldCheck,
    Trash2, Edit
} from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { registerBatchFromPayroll, getEmployeeByCpf } from "@/lib/actions/employees"
import {
    savePayrollAnalysis,
    listPayrollAnalyses,
    getPayrollAnalysis,
    deletePayrollAnalysis
} from "@/lib/actions/payroll"

// ─── Types ───────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }

type FoundRow = { id: string; nome: string; cpf: string; valor: number; sheet: string }
type MissingRow = { cpf: string; nome: string; valor: number; sheet: string }
type ExtraRow = { nome: string; cpfCnpj: string; valor: number; sheet: string }
type SheetSummary = { sheet: string; count: number; total: number }
type AnalysisResult = { found: FoundRow[]; missing: MissingRow[]; extras: ExtraRow[]; total: number; sheetSummary: SheetSummary[]; duplicates?: string[] }
type SheetDebug = { sheet: string; headers: string[]; totalRows: number; detected: { cpf: string | null; nome: string | null; valor: string | null } }

type AnalyzedRow =
    | (FoundRow & { status: "found" })
    | (MissingRow & { status: "missing" })
    | (ExtraRow & { status: "extra"; cpf: string })

type Phase =
    | "form"          // fill month/unit/file
    | "confirm"       // modal: show selections, ask to proceed
    | "loading"       // calling API
    | "pending"       // show missing CPFs banner
    | "result"        // show summary table

// ─── Constants ───────────────────────────────────────────────────────────────

const MESES = [
    { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" }, { value: "04", label: "Abril" },
    { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
    { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
]

const CURRENT_YEAR = new Date().getFullYear()
const ANOS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

function fmtBRL(n: number) {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtCpf(c: string) {
    if (c.length !== 11) return c
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}
function fmtFile(b: number) {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function getSheetColor(sheetName: string) {
    if (!sheetName) return "bg-white"
    const colors = [
        "bg-slate-50",
        "bg-gray-50",
        "bg-zinc-50",
        "bg-stone-50",
        "bg-slate-100/50",
        "bg-gray-100/50",
        "bg-zinc-100/50",
        "bg-stone-100/50",
    ]
    let hash = 0
    for (let i = 0; i < sheetName.length; i++) {
        hash = sheetName.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % colors.length
    return colors[index]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FolhaPagamentoClient({ departments }: { departments: Department[] }) {
    // Form state
    const [mes, setMes] = useState("")
    const [ano, setAno] = useState(String(CURRENT_YEAR))
    const [unidade, setUnidade] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Phase & analysis state
    const [phase, setPhase] = useState<Phase>("form")
    const [result, setResult] = useState<AnalysisResult | null>(null)
    const [missing, setMissing] = useState<MissingRow[]>([])
    const [registering, setRegistering] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [debugInfo, setDebugInfo] = useState<SheetDebug[] | null>(null)

    // Manual additions
    const [isAddingEmp, setIsAddingEmp] = useState(false)
    const [isAddingExtra, setIsAddingExtra] = useState(false)
    const [isAddingSheet, setIsAddingSheet] = useState(false)
    const [newSheetName, setNewSheetName] = useState("")
    const [manualForm, setManualForm] = useState({ nome: "", cpf: "", valor: "", sheet: "", id: "" })
    const [extraForm, setExtraForm] = useState({ nome: "", cpfCnpj: "", valor: "", sheet: "" })
    const [isSearchingCpf, setIsSearchingCpf] = useState(false)

    // History & Closing
    const [analysisId, setAnalysisId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [history, setHistory] = useState<any[]>([])
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyFilterUnit, setHistoryFilterUnit] = useState<string | null>(null)

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Handle deep linking from Unidades
    useEffect(() => {
        const action = searchParams.get("action")
        const unidadeId = searchParams.get("unidadeId")

        if (action === "history") {
            setHistoryFilterUnit(unidadeId)
            openHistory()

            // Clear params from URL without refreshing
            const params = new URLSearchParams(searchParams.toString())
            params.delete("action")
            params.delete("unidadeId")
            const query = params.toString() ? `?${params.toString()}` : ""
            router.replace(`${pathname}${query}`, { scroll: false })
        }
    }, [searchParams])

    // Derived
    const mesLabel = MESES.find((m) => m.value === mes)?.label ?? ""
    const unidadeLabel = departments.find((d) => d.id === unidade)?.name ?? ""
    const canSubmit = !!mes && !!unidade && !!file

    // ── File handlers ──────────────────────────────────────────────────────────
    const handleFile = (f: File) => {
        if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
            alert("Por favor, envie apenas arquivos Excel (.xlsx, .xls) ou CSV.")
            return
        }
        setFile(f)
        setError(null)
    }

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false)
        const f = e.dataTransfer.files[0]; if (f) handleFile(f)
    }, [])

    // ── Analysis flow ──────────────────────────────────────────────────────────
    function handleAnalyzeClick(e: React.FormEvent) {
        e.preventDefault()
        if (!canSubmit) return
        setPhase("confirm")  // ← show confirmation modal first
    }

    async function confirmAndAnalyze() {
        if (!file) return
        setPhase("loading")
        setError(null)
        setDebugInfo(null)
        try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("mes", mes)
            fd.append("ano", ano)
            fd.append("unidade", unidade)

            const res = await fetch("/api/folha/analyze", { method: "POST", body: fd })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error ?? "Erro ao analisar.")
                if (data.debug) setDebugInfo(data.debug as SheetDebug[])
                setPhase("form")
                return
            }

            setResult(data)
            setMissing(data.missing)

            if (data.missing.length > 0) {
                setPhase("pending")
            } else {
                setPhase("result")
            }
        } catch (e: any) {
            console.error("[FOLHA] fetch error:", e)
            setError(e?.message ?? "Falha na conexão. Tente novamente.")
            setPhase("form")
        }
    }

    async function handleRegisterAll() {
        setRegistering(true)
        try {
            await registerBatchFromPayroll(missing.map(({ cpf, nome, valor }) => ({ cpf, nome, valor })), unidade)
            // Re-fetch analysis after registration
            const fd = new FormData()
            fd.append("file", file!)
            fd.append("mes", mes); fd.append("ano", ano); fd.append("unidade", unidade)
            const res = await fetch("/api/folha/analyze", { method: "POST", body: fd })
            const data = await res.json()
            if (res.ok) setResult(data)
            setMissing([])
            setPhase("result")
        } finally {
            setRegistering(false)
        }
    }

    function handleIgnoreAndContinue() {
        setMissing([])
        setPhase("result")
    }

    function setFormCpf(val: string) {
        setManualForm(f => ({ ...f, cpf: val, id: "" }))
    }

    function reset() {
        setMes(""); setAno(String(CURRENT_YEAR)); setUnidade(""); setFile(null)
        setResult(null); setMissing([]); setPhase("form"); setError(null); setDebugInfo(null)
        setManualForm({ nome: "", cpf: "", valor: "", sheet: "", id: "" })
        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: "" })
        setNewSheetName("")
        setAnalysisId(null)
    }

    async function handleSaveClosing() {
        if (!result) return
        setIsSaving(true)
        try {
            await savePayrollAnalysis({
                id: analysisId || undefined,
                month: parseInt(mes),
                year: parseInt(ano),
                departmentId: unidade || null,
                total: result.total,
                analysisData: {
                    found: result.found,
                    missing: missing,
                    extras: result.extras || [],
                    sheetSummary: result.sheetSummary
                }
            })
            alert("Folha fechada/salva com sucesso!")
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    async function openHistory() {
        setIsHistoryOpen(true)
        setIsLoadingHistory(true)
        try {
            const list = await listPayrollAnalyses()
            setHistory(list)
        } catch (err: any) {
            alert("Erro ao carregar histórico: " + err.message)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const filteredHistory = historyFilterUnit
        ? history.filter(h => h.departmentId === historyFilterUnit)
        : history

    async function loadAnalysis(id: string) {
        setIsLoadingHistory(true)
        try {
            const data = await getPayrollAnalysis(id)
            if (data) {
                const analysisData = data.data as any
                setAnalysisId(data.id)
                setMes(String(data.month))
                setAno(String(data.year))
                setUnidade(data.departmentId ?? "")

                setResult({
                    found: analysisData.found || [],
                    missing: analysisData.missing || [],
                    extras: analysisData.extras || [],
                    total: Number(data.total),
                    sheetSummary: analysisData.sheetSummary || []
                })
                setMissing(analysisData.missing || [])
                setPhase("result")
                setIsHistoryOpen(false)
            }
        } catch (err: any) {
            alert("Erro ao carregar análise: " + err.message)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    async function handleDeleteAnalysis(id: string) {
        if (!confirm("Deseja realmente excluir este fechamento?")) return
        try {
            await deletePayrollAnalysis(id)
            setHistory(h => h.filter(x => x.id !== id))
        } catch (err: any) {
            alert("Erro ao excluir: " + err.message)
        }
    }

    async function handleCpfSearch() {
        if (!manualForm.cpf || manualForm.cpf.length < 11) return
        setIsSearchingCpf(true)
        try {
            const emp = await getEmployeeByCpf(manualForm.cpf)
            if (emp) {
                setManualForm(f => ({ ...f, nome: emp.name, id: emp.id }))
            } else {
                setManualForm(f => ({ ...f, id: "" }))
                alert("Funcionário não encontrado no sistema. Ele será adicionado como pendente de cadastro.")
            }
        } finally {
            setIsSearchingCpf(false)
        }
    }

    function addManualEmployee() {
        if (!manualForm.nome || !manualForm.cpf || !manualForm.valor || !manualForm.sheet) {
            alert("Preencha todos os campos")
            return
        }
        const val = parseFloat(manualForm.valor.replace(",", ".")) || 0
        const isFound = !!manualForm.id

        if (isFound) {
            const newRow: FoundRow = {
                id: manualForm.id,
                nome: manualForm.nome,
                cpf: manualForm.cpf.replace(/\D/g, ""),
                valor: val,
                sheet: manualForm.sheet
            }
            if (result) {
                const nextResult = { ...result }
                nextResult.found = [...nextResult.found, newRow]
                nextResult.total += val
                updateSheetSummary(nextResult, manualForm.sheet, val)
                setResult(nextResult)
            }
        } else {
            const newRow: MissingRow = {
                nome: manualForm.nome,
                cpf: manualForm.cpf.replace(/\D/g, ""),
                valor: val,
                sheet: manualForm.sheet
            }
            setMissing(prev => [...prev, newRow])
            if (result) {
                const nextResult = { ...result }
                nextResult.missing = [...nextResult.missing, newRow]
                nextResult.total += val
                updateSheetSummary(nextResult, manualForm.sheet, val)
                setResult(nextResult)
            }
        }

        setManualForm({ nome: "", cpf: "", valor: "", sheet: manualForm.sheet, id: "" })
        setIsAddingEmp(false)
    }

    function addManualExtra() {
        if (!extraForm.nome || !extraForm.cpfCnpj || !extraForm.valor || !extraForm.sheet) {
            alert("Preencha todos os campos")
            return
        }
        const val = parseFloat(extraForm.valor.replace(",", ".")) || 0
        const newRow: ExtraRow = {
            nome: extraForm.nome,
            cpfCnpj: extraForm.cpfCnpj,
            valor: val,
            sheet: extraForm.sheet
        }

        if (result) {
            const nextResult = { ...result }
            nextResult.extras = [...(nextResult.extras || []), newRow]
            nextResult.total += val
            updateSheetSummary(nextResult, extraForm.sheet, val)
            setResult(nextResult)
        }

        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: extraForm.sheet })
        setIsAddingExtra(false)
    }

    function updateSheetSummary(res: AnalysisResult, sheet: string, val: number) {
        const sIdx = res.sheetSummary.findIndex(s => s.sheet === sheet)
        if (sIdx !== -1) {
            res.sheetSummary[sIdx].count += 1
            res.sheetSummary[sIdx].total += val
        } else {
            res.sheetSummary.push({ sheet, count: 1, total: val })
        }
    }

    function addManualSheet() {
        if (!newSheetName) return
        if (result?.sheetSummary.some(s => s.sheet === newSheetName)) {
            alert("Esta aba já existe")
            return
        }
        if (result) {
            setResult({
                ...result,
                sheetSummary: [...result.sheetSummary, { sheet: newSheetName, count: 0, total: 0 }]
            })
        }
        setNewSheetName("")
        setIsAddingSheet(false)
    }

    function handleExportExcel() {
        if (!result) return

        const dataToExport = resultRows.map(row => ({
            "Nome do empregado": row.nome,
            "CPF": row.cpf,
            "Valor": row.valor
        }))

        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Folha Analisada")

        // Formatting column widths
        const wscols = [
            { wch: 40 }, // Nome
            { wch: 15 }, // CPF
            { wch: 15 }, // Valor
        ]
        worksheet["!cols"] = wscols

        XLSX.writeFile(workbook, `folha-analisada-${mes}-${ano}.xlsx`)
    }

    // ── Combined rows for result table ─────────────────────────────────────────
    const resultRows: AnalyzedRow[] = result
        ? [
            ...result.found.map(r => ({ ...r, status: "found" as const })),
            ...missing.map(r => ({ ...r, status: "missing" as const })),
            ...(result.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj, status: "extra" as const })),
        ]
        : []

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Page header ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/25">
                    <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Folha de Pagamento</h1>
                    <p className="text-sm text-slate-500">Importe e analise a folha por período e unidade</p>
                </div>
                {phase !== "form" && (
                    <button
                        onClick={reset}
                        className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Nova análise
                    </button>
                )}
            </div>

            {/* ── Error banner ─────────────────────────────────────────────────── */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-red-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                    {debugInfo && debugInfo.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Estrutura detectada na planilha:</p>
                            {debugInfo.map((s, i) => (
                                <div key={i} className="rounded-lg border border-red-200 bg-white p-3">
                                    <p className="text-xs font-semibold text-slate-700">Aba: <span className="text-blue-700">{s.sheet}</span> — {s.totalRows} linha{s.totalRows !== 1 ? "s" : ""}</p>
                                    <p className="mt-1 text-xs text-slate-500">Colunas encontradas: <span className="font-mono text-slate-700">{s.headers.join(" · ")}</span></p>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                        <span className={s.detected.cpf ? "text-green-600" : "text-red-500"}>CPF: {s.detected.cpf ?? "não detectado"}</span>
                                        <span className={s.detected.nome ? "text-green-600" : "text-amber-500"}>Nome: {s.detected.nome ?? "não detectado"}</span>
                                        <span className={s.detected.valor ? "text-green-600" : "text-amber-500"}>Valor: {s.detected.valor ?? "não detectado"}</span>
                                    </div>
                                </div>
                            ))}
                            <p className="text-xs text-red-600">Renomeie as colunas para incluir &quot;CPF&quot;, &quot;Nome&quot; e &quot;Valor&quot; e tente novamente.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          PHASE: FORM
      ════════════════════════════════════════════════════════════════════ */}
            {phase === "form" && (
                <form onSubmit={handleAnalyzeClick}>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Left: filters */}
                        <div className="lg:col-span-1 space-y-4">
                            {/* Período */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Calendar className="h-4 w-4 text-blue-500" /> Período de Competência
                                </h2>
                                <SelectField
                                    label="Mês" value={mes} onChange={setMes} required
                                    options={[{ value: "", label: "Selecione o mês" }, ...MESES.map((m) => ({ value: m.value, label: m.label }))]}
                                />
                                <div className="mt-4">
                                    <SelectField
                                        label="Ano" value={ano} onChange={setAno}
                                        options={ANOS.map((a) => ({ value: String(a), label: String(a) }))}
                                    />
                                </div>
                            </div>

                            {/* Unidade */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Building2 className="h-4 w-4 text-blue-500" /> Unidade
                                </h2>
                                <SelectField
                                    label="Selecione a unidade" value={unidade} onChange={setUnidade} required
                                    options={[
                                        { value: "", label: "Selecione..." },
                                        ...departments.map((d) => ({ value: d.id, label: d.name })),
                                    ]}
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Upload className="h-4 w-4" /> Analisar Folha
                            </button>
                        </div>

                        {/* Right: upload */}
                        <div className="lg:col-span-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full">
                                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FileUp className="h-4 w-4 text-blue-500" /> Arquivo da Folha
                                </h2>
                                {!file ? (
                                    <DropZone
                                        isDragging={isDragging}
                                        onDrop={onDrop}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onClick={() => inputRef.current?.click()}
                                    >
                                        <input
                                            ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                                        />
                                    </DropZone>
                                ) : (
                                    <FileCard file={file} onRemove={() => setFile(null)} />
                                )}
                                {mes && unidade && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Chip icon={<Calendar className="h-3 w-3" />}>{mesLabel} / {ano}</Chip>
                                        <Chip icon={<Building2 className="h-3 w-3" />}>{unidadeLabel}</Chip>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          PHASE: CONFIRM
      ════════════════════════════════════════════════════════════════════ */}
            {phase === "confirm" && (
                <div className="flex items-center justify-center py-8">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
                        <div className="mb-6 flex flex-col items-center gap-3 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                                <ShieldCheck className="h-7 w-7 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">Confirmar análise</h2>
                            <p className="text-sm text-slate-500">Verifique os dados abaixo antes de prosseguir</p>
                        </div>

                        {/* Summary cards */}
                        <div className="mb-6 grid grid-cols-2 gap-3">
                            <InfoCard label="Mês de Competência" icon={<Calendar className="h-4 w-4 text-blue-500" />}>
                                {mesLabel} / {ano}
                            </InfoCard>
                            <InfoCard label="Unidade" icon={<Building2 className="h-4 w-4 text-blue-500" />}>
                                {unidadeLabel}
                            </InfoCard>
                            <div className="col-span-2">
                                <InfoCard label="Arquivo" icon={<FileSpreadsheet className="h-4 w-4 text-blue-500" />}>
                                    <span className="truncate">{file?.name}</span>
                                    <span className="ml-1 text-slate-400">({fmtFile(file?.size ?? 0)})</span>
                                </InfoCard>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setPhase("form")}
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Corrigir
                            </button>
                            <button
                                onClick={confirmAndAnalyze}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700"
                            >
                                Confirmar e analisar <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          PHASE: LOADING
      ════════════════════════════════════════════════════════════════════ */}
            {phase === "loading" && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-20 shadow-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-slate-600">Analisando planilha...</p>
                    <p className="text-xs text-slate-400">Verificando CPFs no sistema</p>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          PHASE: PENDING (missing CPFs)
      ════════════════════════════════════════════════════════════════════ */}
            {phase === "pending" && result && (
                <div className="space-y-6">
                    {/* Context chips */}
                    <div className="flex flex-wrap gap-2">
                        <Chip icon={<Calendar className="h-3 w-3" />}>{mesLabel} / {ano}</Chip>
                        <Chip icon={<Building2 className="h-3 w-3" />}>{unidadeLabel}</Chip>
                    </div>

                    {/* Alert banner */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-amber-800">
                                    {missing.length} funcionário{missing.length > 1 ? "s" : ""} não cadastrado{missing.length > 1 ? "s" : ""}
                                </p>
                                <p className="mt-0.5 text-sm text-amber-700">
                                    Os CPFs abaixo constam na planilha mas não foram encontrados no sistema.
                                    Você pode cadastrá-los agora ou ignorar e continuar para o resumo.
                                </p>
                            </div>
                        </div>

                        {/* Missing table */}
                        <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-amber-50 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                                        <th className="px-4 py-2.5">Nome do empregado</th>
                                        <th className="px-4 py-2.5">CPF</th>
                                        <th className="px-4 py-2.5 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-100">
                                    {missing.map((row, i) => (
                                        <tr key={i} className="hover:bg-amber-50/50">
                                            <td className="px-4 py-2.5 font-medium text-slate-800">{row.nome || "—"}</td>
                                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.cpf}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmtBRL(row.valor)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <button
                                onClick={handleRegisterAll}
                                disabled={registering}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
                            >
                                {registering ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Cadastrando...</>
                                ) : (
                                    <><UserPlus className="h-4 w-4" /> Cadastrar Todos ({missing.length})</>
                                )}
                            </button>
                            <button
                                onClick={handleIgnoreAndContinue}
                                disabled={registering}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                                <Users className="h-4 w-4" /> Ignorar e ver resumo
                            </button>
                        </div>
                    </div>

                    {/* Already found summary */}
                    {result.found.length > 0 && (
                        <p className="text-sm text-slate-500">
                            ✓ <strong className="text-slate-700">{result.found.length}</strong> funcionário{result.found.length > 1 ? "s" : ""} já cadastrado{result.found.length > 1 ? "s" : ""} na planilha.
                        </p>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          PHASE: RESULT (summary table)
      ════════════════════════════════════════════════════════════════════ */}
            {phase === "result" && result && (
                <div className="space-y-6">
                    {/* Context */}
                    <div className="flex flex-wrap gap-2">
                        <Chip icon={<Calendar className="h-3 w-3" />}>{mesLabel} / {ano}</Chip>
                        <Chip icon={<Building2 className="h-3 w-3" />}>{unidadeLabel}</Chip>
                    </div>

                    {/* Success banner */}
                    <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                        <div className="flex-1">
                            <p className="font-semibold text-green-800">Análise concluída</p>
                            <p className="text-sm text-green-700">{resultRows.length} registro{resultRows.length !== 1 ? "s" : ""} processados</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Total da folha</p>
                            <p className="text-xl font-bold text-green-800">{fmtBRL(result.total)}</p>
                        </div>
                        <div className="flex items-end self-end ml-auto gap-2">
                            <Button
                                onClick={handleExportExcel}
                                variant="outline"
                                className="border-green-200 text-green-700 hover:bg-green-50 gap-2 h-10"
                            >
                                <Download className="h-4 w-4" /> Exportar Planilha
                            </Button>
                            <Button
                                onClick={handleSaveClosing}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-700 gap-2 h-10 shadow-md shadow-blue-600/20"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : analysisId ? (
                                    <Save className="h-4 w-4" />
                                ) : (
                                    <Archive className="h-4 w-4" />
                                )}
                                {analysisId ? "Salvar Alterações" : "Fechar Folha"}
                            </Button>
                        </div>
                    </div>

                    {/* Duplicates warning */}
                    {result.duplicates && result.duplicates.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 px-6">
                            <div className="flex items-start gap-4">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 shadow-sm border border-amber-200/50">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg font-bold text-amber-900 leading-tight">
                                        CPFs duplicados detectados!
                                    </p>
                                    <p className="mt-1 text-sm text-amber-800/80 max-w-2xl leading-relaxed">
                                        Existem <strong>{result.duplicates.length}</strong> CPF{result.duplicates.length > 1 ? "s" : ""} com mais de uma ocorrência na planilha. Verifique se os lançamentos múltiplos estão corretos para:
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {result.duplicates.slice(0, 10).map((cpf) => (
                                            <span key={cpf} className="inline-flex items-center rounded-md bg-white border border-amber-200 px-2.5 py-1 text-xs font-mono font-semibold text-amber-700 shadow-sm">
                                                {fmtCpf(cpf)}
                                            </span>
                                        ))}
                                        {result.duplicates.length > 10 && (
                                            <span className="inline-flex items-center rounded-md bg-amber-100/50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-600">
                                                +{result.duplicates.length - 10} outros
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pending registration warning if manual items were added */}
                    {missing.length > 0 && (
                        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <p className="text-sm text-amber-800">
                                    Há <strong>{missing.length}</strong> funcionário{missing.length > 1 ? "s" : ""} adicionado{missing.length > 1 ? "s" : ""} manualmente que não {missing.length > 1 ? "estão" : "está"} no sistema.
                                </p>
                            </div>
                            <Button
                                size="sm" className="bg-amber-500 hover:bg-amber-600 h-8"
                                onClick={() => setPhase("pending")}
                            >
                                Cadastrar Agora
                            </Button>
                        </div>
                    )}

                    {/* Sheet summary cards */}
                    {result.sheetSummary && result.sheetSummary.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo por aba</p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                        onClick={() => setIsAddingSheet(true)}
                                    >
                                        <CirclePlus className="h-3 w-3" /> Nova Aba
                                    </Button>
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                        onClick={() => setIsAddingEmp(true)}
                                    >
                                        <Plus className="h-3 w-3" /> Funcionário
                                    </Button>
                                    <Button
                                        variant="outline" size="sm"
                                        className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                        onClick={() => setIsAddingExtra(true)}
                                    >
                                        <Plus className="h-3 w-3" /> Extra
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {result.sheetSummary.map((s) => (
                                    <div key={s.sheet} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileSpreadsheet className="h-4 w-4 text-blue-500 shrink-0" />
                                            <p className="font-semibold text-slate-800 truncate text-sm">{s.sheet}</p>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-xs text-slate-400">Funcionários</p>
                                                <p className="text-2xl font-bold text-slate-800">{s.count}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">Total da aba</p>
                                                <p className="text-base font-bold text-blue-700">{fmtBRL(s.total)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results table */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        <th className="px-5 py-3">Nome do empregado</th>
                                        <th className="px-5 py-3">CPF</th>
                                        <th className="px-5 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resultRows.map((row, i) => {
                                        const isDuplicate = result.duplicates?.includes(row.cpf)
                                        return (
                                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${isDuplicate ? "bg-amber-100/40" : getSheetColor(row.sheet)}`}>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${isDuplicate ? "font-bold text-amber-900" : "text-slate-900"}`}>{row.nome}</span>
                                                        {isDuplicate && (
                                                            <div className="flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 shadow-sm">
                                                                <AlertTriangle className="h-2.5 w-2.5" /> Duplicado
                                                            </div>
                                                        )}
                                                        {row.status === "missing" && (
                                                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Pendente</span>
                                                        )}
                                                        {row.status === "extra" && (
                                                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Extra</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-5 py-3 font-mono text-xs ${isDuplicate ? "font-bold text-amber-700" : "text-slate-600"}`}>
                                                    {row.cpf ? fmtCpf(row.cpf) : "—"}
                                                </td>
                                                <td className={`px-5 py-3 text-right font-bold ${isDuplicate ? "text-amber-900" : "text-slate-900"}`}>
                                                    {fmtBRL(row.valor)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                                        <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-slate-700">Total Geral</td>
                                        <td className="px-5 py-3 text-right text-base font-bold text-blue-700">{fmtBRL(result.total)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Dialogs ─── */}
            <Dialog open={isAddingEmp} onOpenChange={setIsAddingEmp}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Funcionário Manualmente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input
                                placeholder="Nome do funcionário"
                                value={manualForm.nome}
                                onChange={e => setManualForm(f => ({ ...f, nome: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CPF</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="000.000.000-00"
                                        value={manualForm.cpf}
                                        onChange={e => setFormCpf(e.target.value)}
                                    />
                                    <Button
                                        type="button" variant="outline" size="icon"
                                        onClick={handleCpfSearch}
                                        disabled={isSearchingCpf || manualForm.cpf.length < 11}
                                        title="Buscar funcionário pelo CPF"
                                    >
                                        {isSearchingCpf ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Search className="h-4 w-4 text-blue-600" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input
                                    placeholder="0,00"
                                    value={manualForm.valor}
                                    onChange={e => setManualForm(f => ({ ...f, valor: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Selecionar Aba</Label>
                            <Select
                                value={manualForm.sheet}
                                onValueChange={v => setManualForm(f => ({ ...f, sheet: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a aba..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {result?.sheetSummary.map(s => (
                                        <SelectItem key={s.sheet} value={s.sheet}>{s.sheet}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingEmp(false)}>Cancelar</Button>
                        <Button onClick={addManualEmployee}>Acrescentar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingSheet} onOpenChange={setIsAddingSheet}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Aba</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>Nome da Aba</Label>
                        <Input
                            placeholder="Ex: Administrativo, Operacional..."
                            value={newSheetName}
                            onChange={e => setNewSheetName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingSheet(false)}>Cancelar</Button>
                        <Button onClick={addManualSheet}>Criar Aba</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Lançamento Extra</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome / Favorecido</Label>
                            <Input
                                placeholder="Nome do favorecido ou serviço"
                                value={extraForm.nome}
                                onChange={e => setExtraForm(f => ({ ...f, nome: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CPF ou CNPJ</Label>
                                <Input
                                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                    value={extraForm.cpfCnpj}
                                    onChange={e => setExtraForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input
                                    placeholder="0,00"
                                    value={extraForm.valor}
                                    onChange={e => setExtraForm(f => ({ ...f, valor: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Selecionar Aba</Label>
                            <Select
                                value={extraForm.sheet}
                                onValueChange={v => setExtraForm(f => ({ ...f, sheet: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a aba..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {result?.sheetSummary.map(s => (
                                        <SelectItem key={s.sheet} value={s.sheet}>{s.sheet}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                        <Button onClick={addManualExtra}>Adicionar Extra</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Histórico de Fechamentos</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {isLoadingHistory ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Nenhum fechamento encontrado.</p>
                        ) : (
                            <div className="space-y-4">
                                {historyFilterUnit && (
                                    <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2 border border-blue-100">
                                        <div className="flex items-center gap-2 text-sm text-blue-700">
                                            <Building2 className="h-4 w-4" />
                                            <span>Filtrando por unidade: <strong>{history.find(h => h.departmentId === historyFilterUnit)?.department?.name || "Selecionada"}</strong></span>
                                        </div>
                                        <Button
                                            variant="ghost" size="sm"
                                            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                            onClick={() => setHistoryFilterUnit(null)}
                                        >
                                            Limpar filtro
                                        </Button>
                                    </div>
                                )}
                                <div className="max-h-[400px] overflow-y-auto border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr className="text-left border-b">
                                                <th className="px-4 py-2 font-semibold text-slate-600">Competência</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600">Unidade</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600">Total</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredHistory.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        {MESES.find(m => m.value === String(item.month).padStart(2, "0"))?.label} / {item.year}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {item.department?.name || "Todas"}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                        {fmtBRL(Number(item.total))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right space-x-2">
                                                        <Button
                                                            variant="ghost" size="icon" className="h-8 w-8 text-blue-600"
                                                            onClick={() => loadAnalysis(item.id)}
                                                            title="Abrir para editar"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost" size="icon" className="h-8 w-8 text-red-600"
                                                            onClick={() => handleDeleteAnalysis(item.id)}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Small presentational sub-components ─────────────────────────────────────

function SelectField({
    label, value, onChange, options, required,
}: {
    label: string; value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; required?: boolean
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
            <div className="relative">
                <select
                    value={value} onChange={(e) => onChange(e.target.value)} required={required}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-700 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </div>
        </div>
    )
}

function DropZone({
    isDragging, onDrop, onDragOver, onDragLeave, onClick, children,
}: React.PropsWithChildren<{
    isDragging: boolean; onDrop: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onClick: () => void
}>) {
    return (
        <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={onClick}
            className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
                }`}
        >
            <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${isDragging ? "bg-blue-100" : "bg-slate-100"}`}>
                    <FileSpreadsheet className={`h-8 w-8 transition-colors ${isDragging ? "text-blue-600" : "text-slate-400"}`} />
                </div>
                <div>
                    <p className="text-base font-semibold text-slate-700">{isDragging ? "Solte o arquivo aqui" : "Arraste e solte o arquivo"}</p>
                    <p className="mt-1 text-sm text-slate-400">ou <span className="font-medium text-blue-600 underline underline-offset-2">clique para selecionar</span></p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5">
                    <span className="text-xs font-medium text-slate-500">Formatos aceitos:</span>
                    <span className="text-xs font-semibold text-slate-700">.xlsx · .xls · .csv</span>
                </div>
            </div>
            {children}
        </div>
    )
}

function FileCard({ file, onRemove }: { file: File; onRemove: () => void }) {
    return (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
            </div>
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                        <p className="text-xs text-slate-400">{fmtFile(file.size)}</p>
                    </div>
                    <button type="button" onClick={onRemove}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

function InfoCard({ label, icon, children }: React.PropsWithChildren<{ label: string; icon: React.ReactNode }>) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                {icon} {label}
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-slate-800">{children}</div>
        </div>
    )
}

function Chip({ icon, children }: React.PropsWithChildren<{ icon: React.ReactNode }>) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {icon} {children}
        </span>
    )
}
