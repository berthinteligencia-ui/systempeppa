"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    Search, Download, Save, Archive,
    FileSpreadsheet, CheckCircle2, X, Calendar, Building2, FileUp,
    AlertTriangle, UserPlus, Users, ChevronRight, ChevronDown, RotateCcw, Loader2, ShieldCheck,
    Trash2, Edit, Phone, Receipt, Maximize2, CirclePlus, Plus, Sparkles, Info, BellRing, Lightbulb,
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
import { registerBatchFromPayroll, getEmployeeByCpf, updateEmployeesPhone } from "@/lib/actions/employees"
import {
    savePayrollAnalysis, listPayrollAnalyses, getPayrollAnalysis, deletePayrollAnalysis
} from "@/lib/actions/payroll"
import { updateNotaFiscalStatus } from "@/lib/actions/nfs"

// ─── Types ───────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type NfRow = { id: string; numero: string; emitente: string; valor: number | string; dataEmissao: Date | string; status: string }

type FoundRow = { id: string; nome: string; cpf: string; valor: number; sheet: string; telefone?: string; cargo?: string }
type MissingRow = { cpf: string; nome: string; valor: number; sheet: string; telefone?: string; cargo?: string }
type ExtraRow = { nome: string; cpfCnpj: string; valor: number; sheet: string; telefone?: string; cargo?: string }
type SheetSummary = { sheet: string; count: number; total: number }
type PhoneUpdateRow = { id: string; nome: string; cpf: string; phoneInSheet: string }
type AnalysisResult = { found: FoundRow[]; missing: MissingRow[]; extras: ExtraRow[]; total: number; sheetSummary: SheetSummary[]; duplicates?: string[]; phoneUpdates?: PhoneUpdateRow[] }
type SheetDebug = { sheet: string; headers: string[]; totalRows: number; detected: { cpf: string | null; nome: string | null; valor: string | null; telefone: string | null; cargo: string | null } }

type AnalyzedRow =
    | (FoundRow & { status: "found" })
    | (MissingRow & { status: "missing" })
    | (ExtraRow & { status: "extra"; cpf: string })

type Phase = "form" | "confirm" | "loading" | "pending" | "result"

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
function maskCpf(c: string) {
    const d = c.replace(/\D/g, "")
    if (d.length !== 11) return c
    return `${d.slice(0, 3)}.***.***-${d.slice(9)}`
}
function fmtFile(b: number) {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
}
function fmtDate(d: Date | string) {
    const dt = new Date(d)
    return dt.toLocaleDateString("pt-BR")
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FolhaPagamentoClient({
    departments,
    nfs,
}: {
    departments: Department[]
    nfs: NfRow[]
}) {
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
    const [phoneUpdates, setPhoneUpdates] = useState<PhoneUpdateRow[]>([])
    const [isUpdatingPhones, setIsUpdatingPhones] = useState(false)

    // Manual additions
    const [isAddingEmp, setIsAddingEmp] = useState(false)
    const [isAddingExtra, setIsAddingExtra] = useState(false)
    const [isAddingSheet, setIsAddingSheet] = useState(false)
    const [newSheetName, setNewSheetName] = useState("")
    const [manualForm, setManualForm] = useState({ nome: "", cpf: "", valor: "", sheet: "", id: "", telefone: "", cargo: "" })
    const [extraForm, setExtraForm] = useState({ nome: "", cpfCnpj: "", valor: "", sheet: "", cargo: "" })
    const [isSearchingCpf, setIsSearchingCpf] = useState(false)

    // AI Analysis
    const [aiResult, setAiResult] = useState<{ resumo: string; insights: string[]; alertas: string[]; recomendacoes: string[] } | null>(null)
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
    const [isAiOpen, setIsAiOpen] = useState(false)

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

    useEffect(() => {
        const action = searchParams.get("action")
        const unidadeId = searchParams.get("unidadeId")
        if (action === "history") {
            setHistoryFilterUnit(unidadeId)
            openHistory()
            const params = new URLSearchParams(searchParams.toString())
            params.delete("action"); params.delete("unidadeId")
            const query = params.toString() ? `?${params.toString()}` : ""
            router.replace(`${pathname}${query}`, { scroll: false })
        }
    }, [searchParams])

    // Derived
    const mesLabel = MESES.find((m) => m.value === mes)?.label ?? ""
    const unidadeLabel = departments.find((d) => d.id === unidade)?.name ?? ""
    const canSubmit = !!mes && !!unidade && !!file

    const [nfsOpen, setNfsOpen] = useState(false)
    const [selectedNfId, setSelectedNfId] = useState<string | null>(null)

    const pendingNfs = nfs
    const selectedNf = nfs.find(n => n.id === selectedNfId) ?? null

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
    function handleAnalyzeClick() {
        if (!file) return
        if (!unidade) { setError("Selecione a unidade antes de analisar."); return }
        if (!mes) { setError("Selecione o mês antes de analisar."); return }
        setError(null)
        confirmAndAnalyze()
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
                setPhase("form"); return
            }
            setResult(data)
            setMissing(data.missing)
            setPhoneUpdates(data.phoneUpdates ?? [])
            setDebugInfo(data.debug as SheetDebug[])
            setPhase(data.missing.length > 0 ? "pending" : "result")
        } catch (e: any) {
            setError(e?.message ?? "Falha na conexão. Tente novamente.")
            setPhase("form")
        }
    }

    async function handleRegisterAll() {
        setRegistering(true)
        try {
            await registerBatchFromPayroll(missing.map(({ cpf, nome, valor, telefone, cargo }) => ({ cpf, nome, valor, telefone, cargo })), unidade)
            const fd = new FormData()
            fd.append("file", file!); fd.append("mes", mes); fd.append("ano", ano); fd.append("unidade", unidade)
            const res = await fetch("/api/folha/analyze", { method: "POST", body: fd })
            const data = await res.json()
            if (res.ok) setResult(data)
            setMissing([])
            setPhase("result")
        } finally { setRegistering(false) }
    }

    function handleIgnoreAndContinue() { setMissing([]); setPhase("result") }

    async function handleUpdatePhones() {
        setIsUpdatingPhones(true)
        try {
            await updateEmployeesPhone(phoneUpdates.map(u => ({ id: u.id, phone: u.phoneInSheet })))
            setPhoneUpdates([])
        } catch (err: any) {
            alert("Erro ao atualizar telefones: " + err.message)
        } finally { setIsUpdatingPhones(false) }
    }

    function reset() {
        setMes(""); setAno(String(CURRENT_YEAR)); setUnidade(""); setFile(null)
        setResult(null); setMissing([]); setPhase("form"); setError(null); setDebugInfo(null); setPhoneUpdates([])
        setManualForm({ nome: "", cpf: "", valor: "", sheet: "", id: "", telefone: "", cargo: "" })
        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: "", cargo: "" })
        setNewSheetName(""); setAnalysisId(null)
    }

    async function handleSaveClosing() {
        if (!result) return
        setIsSaving(true)
        try {
            await savePayrollAnalysis({
                id: analysisId || undefined,
                month: parseInt(mes), year: parseInt(ano),
                departmentId: unidade || null,
                total: result.total,
                analysisData: { found: result.found, missing, extras: result.extras || [], sheetSummary: result.sheetSummary }
            })
            // Avança o fluxo da NF vinculada para ANALISADA
            if (selectedNfId) {
                await updateNotaFiscalStatus(selectedNfId, "ANALISADA")
            }
            alert("Folha fechada com sucesso!")
        } catch (err: any) {
            alert("Erro ao salvar: " + err.message)
        } finally { setIsSaving(false) }
    }

    async function handleAiAnalyze() {
        if (!result) return
        setIsAiAnalyzing(true)
        setIsAiOpen(true)
        try {
            const res = await fetch("/api/folha/ai-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    found: result.found,
                    missing,
                    extras: result.extras || [],
                    total: result.total,
                    sheetSummary: result.sheetSummary,
                    mes,
                    ano,
                    unidade: unidadeLabel,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? "Erro na análise")
            setAiResult(data)
        } catch (err: any) {
            alert("Erro ao analisar com IA: " + err.message)
            setIsAiOpen(false)
        } finally {
            setIsAiAnalyzing(false)
        }
    }

    async function openHistory() {
        setIsHistoryOpen(true); setIsLoadingHistory(true)
        try {
            setHistory(await listPayrollAnalyses())
        } catch (err: any) {
            alert("Erro ao carregar histórico: " + err.message)
        } finally { setIsLoadingHistory(false) }
    }

    const filteredHistory = historyFilterUnit
        ? history.filter(h => h.departmentId === historyFilterUnit)
        : history

    async function loadAnalysis(id: string) {
        setIsLoadingHistory(true)
        try {
            const data = await getPayrollAnalysis(id)
            if (data) {
                const ad = data.data as any
                setAnalysisId(data.id); setMes(String(data.month)); setAno(String(data.year)); setUnidade(data.departmentId ?? "")
                setResult({ found: ad.found || [], missing: ad.missing || [], extras: ad.extras || [], total: Number(data.total), sheetSummary: ad.sheetSummary || [] })
                setMissing(ad.missing || []); setPhase("result"); setIsHistoryOpen(false)
            }
        } catch (err: any) { alert("Erro ao carregar: " + err.message) }
        finally { setIsLoadingHistory(false) }
    }

    async function handleDeleteAnalysis(id: string) {
        if (!confirm("Deseja excluir este fechamento?")) return
        try {
            await deletePayrollAnalysis(id)
            setHistory(h => h.filter(x => x.id !== id))
        } catch (err: any) { alert("Erro ao excluir: " + err.message) }
    }

    async function handleCpfSearch() {
        if (!manualForm.cpf || manualForm.cpf.length < 11) return
        setIsSearchingCpf(true)
        try {
            const emp = await getEmployeeByCpf(manualForm.cpf)
            if (emp) setManualForm(f => ({ ...f, nome: emp.name, id: emp.id, telefone: emp.phone || "", cargo: emp.position || "" }))
            else { setManualForm(f => ({ ...f, id: "" })); alert("Funcionário não encontrado.") }
        } finally { setIsSearchingCpf(false) }
    }

    function addManualEmployee() {
        if (!manualForm.nome || !manualForm.cpf || !manualForm.valor || !manualForm.sheet) { alert("Preencha todos os campos"); return }
        const val = parseFloat(manualForm.valor.replace(",", ".")) || 0
        if (manualForm.id) {
            const newRow: FoundRow = { id: manualForm.id, nome: manualForm.nome, cpf: manualForm.cpf.replace(/\D/g, ""), valor: val, sheet: manualForm.sheet, telefone: manualForm.telefone || undefined, cargo: manualForm.cargo || undefined }
            if (result) { const r = { ...result }; r.found = [...r.found, newRow]; r.total += val; updateSheetSummary(r, manualForm.sheet, val); setResult(r) }
        } else {
            const newRow: MissingRow = { nome: manualForm.nome, cpf: manualForm.cpf.replace(/\D/g, ""), valor: val, sheet: manualForm.sheet, telefone: manualForm.telefone || undefined }
            setMissing(prev => [...prev, newRow])
            if (result) { const r = { ...result }; r.missing = [...r.missing, newRow]; r.total += val; updateSheetSummary(r, manualForm.sheet, val); setResult(r) }
        }
        setManualForm({ nome: "", cpf: "", valor: "", sheet: manualForm.sheet, id: "", telefone: "", cargo: "" }); setIsAddingEmp(false)
    }

    function addManualExtra() {
        if (!extraForm.nome || !extraForm.cpfCnpj || !extraForm.valor || !extraForm.sheet) { alert("Preencha todos os campos"); return }
        const val = parseFloat(extraForm.valor.replace(",", ".")) || 0
        const newRow: ExtraRow = { nome: extraForm.nome, cpfCnpj: extraForm.cpfCnpj, valor: val, sheet: extraForm.sheet, cargo: extraForm.cargo || undefined }
        if (result) { const r = { ...result }; r.extras = [...(r.extras || []), newRow]; r.total += val; updateSheetSummary(r, extraForm.sheet, val); setResult(r) }
        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: extraForm.sheet, cargo: "" }); setIsAddingExtra(false)
    }

    function updateSheetSummary(res: AnalysisResult, sheet: string, val: number) {
        const i = res.sheetSummary.findIndex(s => s.sheet === sheet)
        if (i !== -1) { res.sheetSummary[i].count += 1; res.sheetSummary[i].total += val }
        else res.sheetSummary.push({ sheet, count: 1, total: val })
    }

    function addManualSheet() {
        if (!newSheetName) return
        if (result?.sheetSummary.some(s => s.sheet === newSheetName)) { alert("Esta aba já existe"); return }
        if (result) setResult({ ...result, sheetSummary: [...result.sheetSummary, { sheet: newSheetName, count: 0, total: 0 }] })
        setNewSheetName(""); setIsAddingSheet(false)
    }

    function handleExportExcel() {
        if (!result) return
        const ws = XLSX.utils.json_to_sheet(resultRows.map(r => ({ "Nome": r.nome, "CPF": r.cpf, "Valor": r.valor })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Folha Analisada")
        ws["!cols"] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }]
        XLSX.writeFile(wb, `folha-analisada-${mes}-${ano}.xlsx`)
    }

    const resultRows: AnalyzedRow[] = result
        ? [
            ...result.found.map(r => ({ ...r, status: "found" as const })),
            ...missing.map(r => ({ ...r, status: "missing" as const })),
            ...(result.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj, status: "extra" as const })),
        ] : []

    const showResults = phase === "result" || phase === "pending"

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            {/* Breadcrumb */}
            <div className="text-sm text-slate-400">
                Unidades{unidadeLabel ? <> / <span className="font-semibold text-slate-600">Unidade: {unidadeLabel}</span></> : ""}
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Processamento de Folha de Pagamento</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gestão de notas fiscais e análise de planilhas para fechamento da unidade.</p>
                </div>
                <div className="flex gap-2">
                    {showResults && (
                        <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" /> Nova análise
                        </button>
                    )}
                    <button onClick={openHistory} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Histórico
                    </button>
                </div>
            </div>

            {/* Compact selectors */}
            <div className="flex flex-wrap items-center gap-3">
                <SelectField label="" value={unidade} onChange={setUnidade}
                    options={[{ value: "", label: "Selecionar unidade..." }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
                />
                <SelectField label="" value={mes} onChange={setMes}
                    options={[{ value: "", label: "Mês..." }, ...MESES.map(m => ({ value: m.value, label: m.label }))]}
                />
                <SelectField label="" value={ano} onChange={setAno}
                    options={ANOS.map(a => ({ value: String(a), label: String(a) }))}
                />
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-red-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                    </div>
                    {debugInfo && debugInfo.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Estrutura detectada:</p>
                            {debugInfo.map((s, i) => (
                                <div key={i} className="rounded-lg border border-red-200 bg-white p-3">
                                    <p className="text-xs font-semibold text-slate-700">Aba: <span className="text-blue-700">{s.sheet}</span> — {s.totalRows} linha(s)</p>
                                    <p className="mt-1 text-xs text-slate-500">Colunas: <span className="font-mono text-slate-700">{s.headers.join(" · ")}</span></p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Main two-column layout ─────────────────────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">

                {/* LEFT COLUMN */}
                <div className="space-y-4">

                    {/* Pending NFs — lista suspensa */}
                    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setNfsOpen(o => !o)}
                            className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-blue-500" />
                                <span className="font-semibold text-slate-800 text-sm">Notas Fiscais Cadastradas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {pendingNfs.length > 0 && (
                                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                                        {pendingNfs.length} nota{pendingNfs.length > 1 ? "s" : ""}
                                    </span>
                                )}
                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${nfsOpen ? "rotate-180" : ""}`} />
                            </div>
                        </button>

                        {nfsOpen && (
                            pendingNfs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-slate-400 border-t">
                                    <p className="text-xs">Nenhuma nota cadastrada no sistema</p>
                                </div>
                            ) : (
                                <div className="border-t max-h-64 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                <th className="px-4 py-2.5">N° NF</th>
                                                <th className="px-4 py-2.5">Unidade</th>
                                                <th className="px-4 py-2.5">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {pendingNfs.map(nf => {
                                                const unidadeNome = nf.emitente.split(" - ")[0].trim()
                                                const pago = nf.status === "APROVADA" || nf.status === "ANALISADA"
                                                const isSelected = selectedNfId === nf.id
                                                return (
                                                    <tr
                                                        key={nf.id}
                                                        onClick={() => {
                                                            setSelectedNfId(nf.id)
                                                            setNfsOpen(false)
                                                            // Auto-preenche unidade com base na NF selecionada
                                                            const nfUnitName = nf.emitente.split(" - ")[0].trim()
                                                            const dept = departments.find(d => d.name === nfUnitName)
                                                            if (dept) setUnidade(dept.id)
                                                            // Auto-preenche mês de referência da NF
                                                            const nfDate = new Date(nf.dataEmissao)
                                                            const nfMes = String(nfDate.getMonth() + 1).padStart(2, "0")
                                                            const nfAno = String(nfDate.getFullYear())
                                                            setMes(nfMes)
                                                            setAno(nfAno)
                                                        }}
                                                        className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-600" : "hover:bg-slate-50"}`}
                                                    >
                                                        <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-1.5">
                                                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                                                            {nf.numero}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[100px] truncate">{unidadeNome}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pago ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                                                <span className={`h-1.5 w-1.5 rounded-full ${pago ? "bg-green-500" : "bg-amber-500"}`} />
                                                                {pago ? "Paga" : "Pendente"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </div>

                    {/* Selected NF indicator */}
                    {selectedNf && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-500">NF vinculada</p>
                                    <p className="text-sm font-bold text-slate-800 truncate">
                                        #{selectedNf.numero} — {selectedNf.emitente.split(" - ")[0].trim()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedNfId(null)}
                                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-blue-100 hover:text-slate-600 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Upload */}
                    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b">
                            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                            <h3 className="font-semibold text-slate-800">Análise de Folha (Excel)</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <input
                                ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                            />
                            {!file ? (
                                <div
                                    onClick={() => inputRef.current?.click()}
                                    onDrop={onDrop}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                    onDragLeave={() => setIsDragging(false)}
                                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-all ${isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-100/30"}`}
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                                        <FileSpreadsheet className="h-6 w-6 text-blue-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-slate-700">Carregar Planilha ou clique</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Formatos aceitos: .xlsx, .csv</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50">
                                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                                        <p className="text-xs text-slate-400">{fmtFile(file.size)}</p>
                                    </div>
                                    <button onClick={() => setFile(null)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={handleAnalyzeClick}
                                disabled={!file || phase === "loading"}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                            >
                                {phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                                {phase === "loading" ? "Analisando..." : file ? "Analisar" : "Importar Planilha"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                            <h3 className="font-semibold text-slate-800">Planilha Analisada para Fechamento</h3>
                        </div>
                        {showResults && result && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Total em destaque */}
                                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
                                    <span className="text-sm font-bold text-blue-600">{fmtBRL(result.total)}</span>
                                </div>

                                {/* Fechar Unidade */}
                                <button
                                    onClick={handleSaveClosing}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 shadow-sm shadow-blue-500/10 transition-colors"
                                >
                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Fechar Unidade
                                </button>

                                <div className="w-px h-5 bg-slate-200" />

                                <button onClick={handleExportExcel} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                    <Download className="h-3.5 w-3.5" /> Exportar
                                </button>
                                {result.sheetSummary.length > 0 && (
                                    <>
                                        <button onClick={() => setIsAddingEmp(true)} className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                                            <Plus className="h-3 w-3" /> Funcionário
                                        </button>
                                        <button onClick={() => setIsAddingExtra(true)} className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                                            <Plus className="h-3 w-3" /> Extra
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Loading */}
                    {phase === "loading" && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                            <p className="text-sm text-slate-500">Analisando planilha...</p>
                            <p className="text-xs text-slate-400">Verificando CPFs no sistema</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {(phase === "form" || phase === "confirm") && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-slate-400">
                            <FileSpreadsheet className="h-14 w-14 opacity-15" />
                            <p className="text-sm font-medium">Importe uma planilha para ver os dados analisados</p>
                            <p className="text-xs">Selecione unidade, período e arquivo</p>
                        </div>
                    )}

                    {/* Missing CPFs banner */}
                    {phase === "pending" && missing.length > 0 && (
                        <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                <p className="text-sm font-semibold text-amber-800">{missing.length} funcionário(s) não cadastrado(s)</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleRegisterAll} disabled={registering}
                                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors">
                                    {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                    Cadastrar Todos
                                </button>
                                <button onClick={handleIgnoreAndContinue} disabled={registering}
                                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60 transition-colors">
                                    <Users className="h-3.5 w-3.5" /> Ignorar e continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Results table */}
                    {showResults && result && (
                        <>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                            <th className="px-5 py-3">Colaborador</th>
                                            <th className="px-5 py-3">CPF</th>
                                            <th className="px-5 py-3 text-right">Valor Líquido</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {resultRows.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <p className="font-semibold text-slate-800">{row.nome}</p>
                                                    {row.cargo && <p className="text-xs text-slate-400 mt-0.5">{row.cargo}</p>}
                                                </td>
                                                <td className="px-5 py-3 font-mono text-xs text-slate-500">{maskCpf(row.cpf)}</td>
                                                <td className="px-5 py-3 text-right font-bold text-slate-800">{fmtBRL(row.valor)}</td>
                                                <td className="px-5 py-3">
                                                    {row.status === "found"
                                                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        : <AlertTriangle className="h-5 w-5 text-amber-400" />
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Confirmation modal ─── */}
            <Dialog open={phase === "confirm"} onOpenChange={(open) => { if (!open) setPhase("form") }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-500" /> Confirmar análise
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg bg-slate-50 border p-3">
                                <p className="text-xs text-slate-400 mb-1">Competência</p>
                                <p className="font-semibold text-slate-800">{mesLabel} / {ano}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 border p-3">
                                <p className="text-xs text-slate-400 mb-1">Unidade</p>
                                <p className="font-semibold text-slate-800">{unidadeLabel}</p>
                            </div>
                            <div className="col-span-2 rounded-lg bg-slate-50 border p-3">
                                <p className="text-xs text-slate-400 mb-1">Arquivo</p>
                                <p className="font-semibold text-slate-800 truncate">{file?.name}</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setPhase("form")}>Corrigir</Button>
                        <Button onClick={confirmAndAnalyze} className="bg-blue-600 hover:bg-blue-700 gap-2">
                            Confirmar e analisar <ChevronRight className="h-4 w-4" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Add Employee dialog ─── */}
            <Dialog open={isAddingEmp} onOpenChange={setIsAddingEmp}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Adicionar Funcionário Manualmente</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input placeholder="Nome do funcionário" value={manualForm.nome} onChange={e => setManualForm(f => ({ ...f, nome: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CPF</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="000.000.000-00" value={manualForm.cpf} onChange={e => setManualForm(f => ({ ...f, cpf: e.target.value, id: "" }))} />
                                    <Button type="button" variant="outline" size="icon" onClick={handleCpfSearch} disabled={isSearchingCpf || manualForm.cpf.length < 11}>
                                        {isSearchingCpf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-blue-600" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input placeholder="0,00" value={manualForm.valor} onChange={e => setManualForm(f => ({ ...f, valor: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone (Opcional)</Label>
                                <Input placeholder="(00) 00000-0000" value={manualForm.telefone} onChange={e => setManualForm(f => ({ ...f, telefone: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo (Opcional)</Label>
                                <Input placeholder="Ex: Vendedor" value={manualForm.cargo} onChange={e => setManualForm(f => ({ ...f, cargo: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Aba</Label>
                            <Select value={manualForm.sheet} onValueChange={v => setManualForm(f => ({ ...f, sheet: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecione a aba..." /></SelectTrigger>
                                <SelectContent>{result?.sheetSummary.map(s => <SelectItem key={s.sheet} value={s.sheet}>{s.sheet}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingEmp(false)}>Cancelar</Button>
                        <Button onClick={addManualEmployee}>Acrescentar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Add Extra dialog ─── */}
            <Dialog open={isAddingExtra} onOpenChange={setIsAddingExtra}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Adicionar Lançamento Extra</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome / Favorecido</Label>
                            <Input placeholder="Nome" value={extraForm.nome} onChange={e => setExtraForm(f => ({ ...f, nome: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CPF ou CNPJ</Label>
                                <Input placeholder="000.000.000-00" value={extraForm.cpfCnpj} onChange={e => setExtraForm(f => ({ ...f, cpfCnpj: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input placeholder="0,00" value={extraForm.valor} onChange={e => setExtraForm(f => ({ ...f, valor: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cargo (Opcional)</Label>
                                <Input placeholder="Ex: Consultor" value={extraForm.cargo} onChange={e => setExtraForm(f => ({ ...f, cargo: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Aba</Label>
                            <Select value={extraForm.sheet} onValueChange={v => setExtraForm(f => ({ ...f, sheet: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecione a aba..." /></SelectTrigger>
                                <SelectContent>{result?.sheetSummary.map(s => <SelectItem key={s.sheet} value={s.sheet}>{s.sheet}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingExtra(false)}>Cancelar</Button>
                        <Button onClick={addManualExtra}>Adicionar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Add Sheet dialog ─── */}
            <Dialog open={isAddingSheet} onOpenChange={setIsAddingSheet}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nova Aba</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>Nome da Aba</Label>
                        <Input placeholder="Ex: Administrativo" value={newSheetName} onChange={e => setNewSheetName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingSheet(false)}>Cancelar</Button>
                        <Button onClick={addManualSheet}>Criar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── AI Analysis dialog ─── */}
            <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-500" /> Análise Inteligente da Folha
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
                        {isAiAnalyzing ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                <p className="text-sm text-slate-500">IA analisando a folha de pagamento...</p>
                            </div>
                        ) : aiResult ? (
                            <>
                                {/* Resumo */}
                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-blue-500 shrink-0" />
                                        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Resumo</p>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{aiResult.resumo}</p>
                                </div>

                                {/* Insights */}
                                {aiResult.insights?.length > 0 && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Lightbulb className="h-4 w-4 text-blue-500 shrink-0" />
                                            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Insights</p>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {aiResult.insights.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Alertas */}
                                {aiResult.alertas?.length > 0 && (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BellRing className="h-4 w-4 text-amber-500 shrink-0" />
                                            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Alertas</p>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {aiResult.alertas.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Recomendações */}
                                {aiResult.recomendacoes?.length > 0 && (
                                    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                            <p className="text-xs font-bold uppercase tracking-wide text-green-600">Recomendações</p>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {aiResult.recomendacoes.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAiOpen(false)}>Fechar</Button>
                        {aiResult && (
                            <Button onClick={handleAiAnalyze} disabled={isAiAnalyzing} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                                <Sparkles className="h-4 w-4" /> Reanalisar
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── History dialog ─── */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Histórico de Fechamentos</DialogTitle></DialogHeader>
                    <div className="py-4">
                        {isLoadingHistory ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                        ) : filteredHistory.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Nenhum fechamento encontrado.</p>
                        ) : (
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
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">{MESES.find(m => m.value === String(item.month).padStart(2, "0"))?.label} / {item.year}</td>
                                                <td className="px-4 py-3">{item.department?.name || "Todas"}</td>
                                                <td className="px-4 py-3 font-medium">{fmtBRL(Number(item.total))}</td>
                                                <td className="px-4 py-3 text-right space-x-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => loadAnalysis(item.id)} title="Abrir">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteAnalysis(item.id)} title="Excluir">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

// ─── Sub-component ────────────────────────────────────────────────────────────

function SelectField({
    label, value, onChange, options, required,
}: {
    label: string; value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; required?: boolean
}) {
    return (
        <div className="relative">
            <select
                value={value} onChange={(e) => onChange(e.target.value)} required={required}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </span>
        </div>
    )
}
