"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    Search, Download, Save, Archive,
    FileSpreadsheet, CheckCircle2, X, Calendar, Building2, FileUp,
    AlertTriangle, UserPlus, Users, ChevronRight, ChevronDown, RotateCcw, Loader2, ShieldCheck,
    Trash2, Edit, Phone, Receipt, Maximize2, CirclePlus, Plus, Sparkles, Info, BellRing, Lightbulb,
    AlertCircle, Hash,
} from "lucide-react"
import * as XLSX from "xlsx"
import type * as ExcelJSTypes from "exceljs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { registerBatchFromPayroll, getEmployeeByCpf, updateEmployeesPhone, updateEmployeeName, updateEmployeeSalary } from "@/lib/actions/employees"
import {
    savePayrollAnalysis, listPayrollAnalyses, getPayrollAnalysis, deletePayrollAnalysis
} from "@/lib/actions/payroll"
import { updateNotaFiscalStatus } from "@/lib/actions/nfs"

// ─── Types ───────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type NfRow = { id: string; numero: string; emitente: string; valor: number | string; dataEmissao: Date | string; status: string }

type FoundRow = { id: string; nome: string; cpf: string; valor: number; sheet: string; telefone?: string; cargo?: string; bankName?: string; bankAgency?: string; bankAccount?: string; pix?: string; isInvalidCpf?: boolean; nameMismatch?: boolean; valueMismatch?: boolean; dbName?: string; dbSalary?: number }
type MissingRow = { cpf: string; nome: string; valor: number; sheet: string; telefone?: string; cargo?: string; bankName?: string; bankAgency?: string; bankAccount?: string; pix?: string; isInvalidCpf?: boolean }
type ExtraRow = { nome: string; cpfCnpj: string; valor: number; sheet: string; telefone?: string; cargo?: string; bankName?: string; bankAgency?: string; bankAccount?: string; pix?: string }
type SheetSummary = { sheet: string; count: number; total: number }
type PhoneUpdateRow = { id: string; nome: string; cpf: string; phoneInSheet: string }
type AnalysisResult = { found: FoundRow[]; missing: MissingRow[]; extras: ExtraRow[]; total: number; sheetSummary: SheetSummary[]; duplicates?: string[]; crossAbaDuplicates?: string[]; phoneUpdates?: PhoneUpdateRow[]; sheetsNeedingMapping?: SheetNeedingMapping[] }
type SheetDebug = { sheet: string; headers: string[]; totalRows: number; detected: { cpf: string | null; nome: string | null; valor: string | null; telefone: string | null; cargo: string | null; banco: string | null; agencia: string | null; conta: string | null; pix: string | null } }
type SheetNeedingMapping = { sheet: string; availableHeaders: string[]; undetected: string[] }
type ColumnHints = Record<string, Record<string, string>> // { sheetName: { cpf?: col, nome?: col, valor?: col, "__none__" = remove } }
type ExcludedRow = AnalyzedRow & { observacao: string }

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
function getInitials(name: string) {
    if (!name) return "??"
    const parts = name.trim().split(" ")
    if (parts.length === 0) return "??"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Bank name normalization ──────────────────────────────────────────────────
// Maps raw bank name strings (from spreadsheets) to canonical bank names.
// Variations like "BRASIL", "BANCO DO BRASIL", "BB" all map to "Banco do Brasil".
// Strings that look like account numbers (CC: 12345-6) → "Não identificado".

const BANK_PATTERNS: [RegExp, string][] = [
    [/bradesco/i,                                                   "Bradesco"],
    [/banco.?do.?brasil|^brasil$|^bb$|^001$/i,                     "Banco do Brasil"],
    [/nubank|nubanck|nu.?pagamentos|nupag|^0?260$/i,               "Nubank"],
    [/caixa|cef|poupan.a.caixa|^104$/i,                           "Caixa Econômica Federal"],
    [/santander|^033$/i,                                           "Santander"],
    [/ita[uú]|^341$/i,                                             "Itaú"],
    [/\binter\b|^077$/i,                                           "Banco Inter"],
    [/\bnext\b/i,                                                  "Next"],
    [/\bneon\b/i,                                                  "Neon"],
    [/mercado.?pago/i,                                             "Mercado Pago"],
    [/banco.?c6|c6.?bank|c6.?s\.?a|^c6$|^336$/i,                 "Banco C6"],
    [/pagbank|pagseguro|pakbank|^290$/i,                           "PagBank"],
    [/nordeste|^004$/i,                                            "Banco do Nordeste"],
    [/picpay|pic.?pay/i,                                           "PicPay"],
    [/sicredi/i,                                                   "Sicredi"],
    [/sicoob/i,                                                    "Sicoob"],
    [/banco.?original|\boriginal\b|^212$/i,                        "Banco Original"],
    [/safra|^422$/i,                                               "Banco Safra"],
    [/btg.?pactual|^208$/i,                                        "BTG Pactual"],
    [/\bxp\b|^102$/i,                                              "XP"],
    [/\bstone\b|^197$/i,                                           "Stone"],
    [/banrisul|^041$/i,                                            "Banrisul"],
    [/unicred/i,                                                   "Unicred"],
    [/\bbs2\b|^218$/i,                                             "BS2"],
    [/will.?bank/i,                                                "Will Bank"],
    [/agi.?bank|agibank/i,                                         "Agibank"],
    [/creditas/i,                                                  "Creditas"],
    [/banco.?pan|\bpan\b|^623$/i,                                  "Banco Pan"],
    [/modal|^746$/i,                                               "Banco Modal"],
    [/c2.?bank/i,                                                  "C2 Bank"],
    [/^380$|limebank/i,                                            "PicPay Bank"],
    [/votorantim|^655$/i,                                          "Banco Votorantim"],
    [/daycoval|^707$/i,                                            "Banco Daycoval"],
]

function normalizeBankName(raw: string | undefined | null): string {
    if (!raw || raw.trim() === "") return "Não informado"
    const s = raw.trim()
    // Looks like an account number (CC:, C/C:, or pure number with digits/dashes/dots)
    if (/^(cc:|c\/c:|conta |ag\.|agencia)/i.test(s)) return "Não identificado"
    if (/^\d[\d.\-/\s]*\d$/.test(s)) return "Não identificado"
    for (const [pattern, canonical] of BANK_PATTERNS) {
        if (pattern.test(s)) return canonical
    }
    return "Não identificado"
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
    const [manualForm, setManualForm] = useState({ nome: "", cpf: "", valor: "", sheet: "", id: "", telefone: "", cargo: "", bankName: "", bankAgency: "", bankAccount: "", pix: "" })
    const [extraForm, setExtraForm] = useState({ nome: "", cpfCnpj: "", valor: "", sheet: "", cargo: "", pix: "" })
    const [isSearchingCpf, setIsSearchingCpf] = useState(false)

    // AI chat
    const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string; actionsCount?: number }[]>([])
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
    const [isAiOpen, setIsAiOpen] = useState(false)
    const [aiInput, setAiInput] = useState("")
    const aiChatEndRef = useRef<HTMLDivElement>(null)

    // Column mapping (when backend can't detect columns automatically)
    const [columnMappingSheets, setColumnMappingSheets] = useState<SheetNeedingMapping[] | null>(null)
    const [columnHints, setColumnHints] = useState<ColumnHints>({})
    // Column correction (post-analysis, user wants to fix wrong columns)
    const [isColumnCorrectionOpen, setIsColumnCorrectionOpen] = useState(false)
    const [correctionDraft, setCorrectionDraft] = useState<ColumnHints>({})

    // Sheet filter
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null)

    // History & Closing
    const [analysisId, setAnalysisId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [history, setHistory] = useState<any[]>([])
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyFilterUnit, setHistoryFilterUnit] = useState<string | null>(null)
    const [viewFilter, setViewFilter] = useState("GERAL")
    const [excludedRows, setExcludedRows] = useState<ExcludedRow[]>([])
    const [pendingExclude, setPendingExclude] = useState<{ row: AnalyzedRow; autoReason: string } | null>(null)
    const [excludeReasonInput, setExcludeReasonInput] = useState("")
    const [isErrorCorrectionOpen, setIsErrorCorrectionOpen] = useState(false)
    const [selectedErrorRows, setSelectedErrorRows] = useState<string[]>([])

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

    async function confirmAndAnalyze(hints?: ColumnHints) {
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
            const activeHints = hints ?? columnHints
            if (Object.keys(activeHints).length > 0) {
                fd.append("columnHints", JSON.stringify(activeHints))
            }
            const res = await fetch("/api/folha/analyze", { method: "POST", body: fd })
            const data = await res.json()
            if (!res.ok) {
                if (data.needsColumnMapping && data.sheetsNeedingMapping?.length > 0) {
                    // Backend couldn't detect columns — ask the user to map them
                    if (data.debug) setDebugInfo(data.debug as SheetDebug[])
                    setColumnMappingSheets(data.sheetsNeedingMapping)
                    setPhase("form")
                    return
                }
                setError(data.error ?? "Erro ao analisar.")
                if (data.debug) setDebugInfo(data.debug as SheetDebug[])
                setPhase("form"); return
            }
            setResult(data)
            setMissing(data.missing)
            setExcludedRows([])
            setViewFilter("GERAL")
            setPhoneUpdates(data.phoneUpdates ?? [])
            setDebugInfo(data.debug as SheetDebug[])
            // Show column mapping dialog for any sheets that still need it (but analysis still ran for others)
            if (data.sheetsNeedingMapping?.length > 0) {
                setColumnMappingSheets(data.sheetsNeedingMapping)
            }
            setPhase(data.missing.length > 0 ? "pending" : "result")
        } catch (e: any) {
            setError(e?.message ?? "Falha na conexão. Tente novamente.")
            setPhase("form")
        }
    }

    async function handleRegisterAll() {
        // Bloqueia se houver qualquer divergência que não seja apenas o fato de não estar cadastrado
        const otherDiversions = (invalidCpfCount || 0) + (nameMismatchCount || 0) + (duplicateCpfCount || 0) + (crossAbaDuplicateCount || 0) + (result?.extras?.length || 0);

        if (otherDiversions > 0) {
            alert(`Não é possível cadastrar novos funcionários enquanto houverem ${otherDiversions} outras pendências (CPFs inválidos, duplicados, divergências de nome ou registros sem CPF) na planilha. Resolva ou exclua os registros problemáticos primeiro.`);
            return;
        }

        // Filtra apenas quem tem nome e CPF preenchidos (garantia extra)
        const toRegister = missing.filter(m => m.nome && m.cpf)
        
        if (toRegister.length === 0) {
            alert("Não existem novos funcionários válidos para cadastrar automaticamente.");
            return
        }

        setRegistering(true)
        try {
            await registerBatchFromPayroll(toRegister.map(({ cpf, nome, valor, telefone, cargo, bankName, bankAgency, bankAccount, pix }) => ({
                cpf, nome, valor, telefone, cargo, bankName, bankAgency, bankAccount, pix
            })), unidade)
            const fd = new FormData()
            fd.append("file", file!); fd.append("mes", mes); fd.append("ano", ano); fd.append("unidade", unidade)
            const res = await fetch("/api/folha/analyze", { method: "POST", body: fd })
            const data = await res.json()
            if (res.ok) setResult(data)
            setMissing([])
            setPhase("result")
        } finally { setRegistering(false) }
    }

    function handleIgnoreAndContinue() { setPhase("result") }

    function handleRestoreRow(row: AnalyzedRow) {
        if (!result) return
        setExcludedRows(prev => prev.filter(r => !(r.cpf === row.cpf && r.sheet === row.sheet)))
        
        const newResult = { ...result }
        const originalStatus = (row as any).originalStatus || ((row as any).status === "excluded" ? "found" : (row.status === "missing" ? "missing" : "found"))
        const restoredRow = { ...row, status: originalStatus }
        
        if (originalStatus === "found") newResult.found.push(restoredRow as FoundRow)
        else if (originalStatus === "missing") {
            newResult.missing.push(restoredRow as MissingRow)
            setMissing(prev => [...prev, restoredRow as MissingRow])
        } else if (originalStatus === "extra") {
            if (!newResult.extras) newResult.extras = []
            newResult.extras.push(restoredRow as any)
        }
        
        newResult.total += row.valor
        setResult(newResult)
    }

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
        setResult(null); setMissing([]); setPhase("form"); setError(null); setDebugInfo(null); setPhoneUpdates([]); setColumnMappingSheets(null); setColumnHints({})
        setManualForm({ nome: "", cpf: "", valor: "", sheet: "", id: "", telefone: "", cargo: "", bankName: "", bankAgency: "", bankAccount: "", pix: "" })
        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: "", cargo: "", pix: "" })
        setNewSheetName(""); setAnalysisId(null)
    }

    function detectExcludeReason(row: AnalyzedRow): string {
        const reasons: string[] = []
        if ((row as any).isInvalidCpf)  reasons.push("CPF inválido")
        if (row.status === "found" && (row as FoundRow).nameMismatch) reasons.push("Divergência de nome")
        if (duplicateCpfSet.has(`${row.sheet}::${row.cpf}`))  reasons.push("Duplicado na mesma aba")
        if (crossAbaDuplicateSet.has(row.cpf))                reasons.push("Duplicado entre abas")
        if (row.status === "extra")      reasons.push("Sem CPF cadastrado")
        if (row.status === "missing")    reasons.push("Não cadastrado no sistema")
        if (row.valor === 0)             reasons.push("Valor zerado")
        return reasons.join(", ")
    }

    function doExcludeRow(row: AnalyzedRow, observacao: string) {
        if (!result) return
        const newResult = { ...result }
        let newMissing = [...missing]

        if (row.status === "found") {
            const idx = newResult.found.findIndex(r => r.cpf === row.cpf && r.sheet === row.sheet)
            if (idx !== -1) newResult.found.splice(idx, 1)
        } else if (row.status === "missing") {
            const idx = newResult.missing.findIndex(r => r.cpf === row.cpf && r.sheet === row.sheet)
            if (idx !== -1) newResult.missing.splice(idx, 1)
            const midx = newMissing.findIndex(r => r.cpf === row.cpf && r.sheet === row.sheet)
            if (midx !== -1) newMissing.splice(midx, 1)
        } else if (row.status === "extra") {
            const idx = (newResult.extras || []).findIndex(r => r.cpfCnpj === row.cpf && r.sheet === row.sheet)
            if (idx !== -1) newResult.extras.splice(idx, 1)
        }

        setExcludedRows(prev => [...prev, { ...row, status: "excluded" as any, observacao }])

        // Update total
        newResult.total -= row.valor

        // Recalculate sheetSummary to be sure
        const sheetMap = new Map<string, { count: number; total: number }>()
        const all = [
            ...newResult.found,
            ...newMissing,
            ...(newResult.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj }))
        ]
        all.forEach(r => {
            const entry = sheetMap.get(r.sheet) || { count: 0, total: 0 }
            entry.count++; entry.total += r.valor
            sheetMap.set(r.sheet, entry)
        })
        newResult.sheetSummary = Array.from(sheetMap.entries()).map(([sheet, data]) => ({ sheet, ...data }))
        
        // If the selected sheet is now empty, reset filter
        if (selectedSheet && !newResult.sheetSummary.some(s => s.sheet === selectedSheet)) {
            setSelectedSheet(null)
        }

        setResult(newResult)
        setMissing(newMissing)
    }

    function handleDeleteRow(row: AnalyzedRow) {
        if (!result) return
        const autoReason = detectExcludeReason(row)
        if (autoReason) {
            // Has an auto-detected reason — confirm and proceed
            if (!confirm(`Excluir "${row.nome}"?\nMotivo detectado: ${autoReason}`)) return
            doExcludeRow(row, autoReason)
        } else {
            // No auto reason — ask the user
            setExcludeReasonInput("")
            setPendingExclude({ row, autoReason: "" })
        }
    }

    function handleMergeDuplicates(cpf: string) {
        if (!result) return
        const rowsToMerge = resultRows.filter(r => r.cpf === cpf)
        if (rowsToMerge.length <= 1) return

        if (!confirm(`Deseja mesclar ${rowsToMerge.length} entradas do CPF ${fmtCpf(cpf)}? Os valores serão somados em uma única entrada.`)) return

        const totalValue = rowsToMerge.reduce((sum, r) => sum + r.valor, 0)
        
        const newResult = { ...result }
        let newMissing = [...missing]

        // Find a principal row from original arrays
        const fPrincipal = newResult.found.find(r => r.cpf === cpf)
        const mPrincipal = newResult.missing.find(r => r.cpf === cpf)
        
        if (fPrincipal) {
            fPrincipal.valor = totalValue
            newResult.found = newResult.found.filter(r => r.cpf !== cpf || r === fPrincipal)
            newResult.missing = newResult.missing.filter(r => r.cpf !== cpf)
            newMissing = newMissing.filter(r => r.cpf !== cpf)
        } else if (mPrincipal) {
            mPrincipal.valor = totalValue
            newResult.missing = newResult.missing.filter(r => r.cpf !== cpf || r === mPrincipal)
            newMissing = newMissing.filter(r => r.cpf !== cpf || (r.cpf === cpf && r.sheet === mPrincipal.sheet)) // heuristic for matching in missing array
            newResult.found = newResult.found.filter(r => r.cpf !== cpf)
        }

        // Recalculate sheetSummary
        const sheetMap = new Map<string, { count: number; total: number }>()
        const all = [
            ...newResult.found,
            ...newMissing,
            ...(newResult.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj }))
        ]
        all.forEach(r => {
            const entry = sheetMap.get(r.sheet) || { count: 0, total: 0 }
            entry.count++; entry.total += r.valor
            sheetMap.set(r.sheet, entry)
        })
        newResult.sheetSummary = Array.from(sheetMap.entries()).map(([sheet, data]) => ({ sheet, ...data }))

        setResult(newResult)
        setMissing(newMissing)
    }

    function handleMergeDuplicatesByName(nome: string) {
        if (!result) return
        const nKey = nome.toLowerCase().trim()
        const rowsToMerge = resultRows.filter(r => r.nome.toLowerCase().trim() === nKey)
        if (rowsToMerge.length <= 1) return

        if (!confirm(`Deseja mesclar ${rowsToMerge.length} entradas com o nome "${nome}"? Os valores serão somados em uma única entrada.`)) return

        const totalValue = rowsToMerge.reduce((sum, r) => sum + r.valor, 0)
        
        const newResult = { ...result }
        let newMissing = [...missing]

        // Find a principal row
        const fPrincipal = newResult.found.find(r => r.nome.toLowerCase().trim() === nKey)
        const mPrincipal = newResult.missing.find(r => r.nome.toLowerCase().trim() === nKey)
        const ePrincipal = (newResult.extras || []).find(r => r.nome.toLowerCase().trim() === nKey)
        
        if (fPrincipal) {
            fPrincipal.valor = totalValue
            newResult.found = newResult.found.filter(r => r.nome.toLowerCase().trim() !== nKey || r === fPrincipal)
            newResult.missing = newResult.missing.filter(r => r.nome.toLowerCase().trim() !== nKey)
            newMissing = newMissing.filter(r => r.nome.toLowerCase().trim() !== nKey)
            newResult.extras = (newResult.extras || []).filter(r => r.nome.toLowerCase().trim() !== nKey)
        } else if (mPrincipal) {
            mPrincipal.valor = totalValue
            newResult.missing = newResult.missing.filter(r => r.nome.toLowerCase().trim() !== nKey || r === mPrincipal)
            newMissing = newMissing.filter(r => r.nome.toLowerCase().trim() !== nKey || (r.nome.toLowerCase().trim() === nKey && r.sheet === mPrincipal.sheet))
            newResult.found = newResult.found.filter(r => r.nome.toLowerCase().trim() !== nKey)
            newResult.extras = (newResult.extras || []).filter(r => r.nome.toLowerCase().trim() !== nKey)
        } else if (ePrincipal) {
            ePrincipal.valor = totalValue
            newResult.extras = (newResult.extras || []).filter(r => r.nome.toLowerCase().trim() !== nKey || r === ePrincipal)
            newResult.found = newResult.found.filter(r => r.nome.toLowerCase().trim() !== nKey)
            newResult.missing = newResult.missing.filter(r => r.nome.toLowerCase().trim() !== nKey)
            newMissing = newMissing.filter(r => r.nome.toLowerCase().trim() !== nKey)
        }

        // Recalculate sheetSummary
        const sheetMap = new Map<string, { count: number; total: number }>()
        const all = [
            ...newResult.found,
            ...newMissing,
            ...(newResult.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj }))
        ]
        all.forEach(r => {
            const entry = sheetMap.get(r.sheet) || { count: 0, total: 0 }
            entry.count++; entry.total += r.valor
            sheetMap.set(r.sheet, entry)
        })
        newResult.sheetSummary = Array.from(sheetMap.entries()).map(([sheet, data]) => ({ sheet, ...data }))

        setResult(newResult)
        setMissing(newMissing)
    }

    async function handleSaveClosing() {
        if (!result) return
        
        // Bloqueia se houver qualquer divergência pendente (incluindo extras sem CPF)
        if (totalDiversions > 0) {
            alert(`Não é possível fechar a unidade. Existem ${totalDiversions} pendências (funcionários não encontrados, sem CPF, CPFs inválidos ou duplicados) que precisam ser resolvidas ou excluídas antes de finalizar.`)
            return
        }

        setIsSaving(true)
        try {
            await savePayrollAnalysis({
                id: analysisId || undefined,
                month: parseInt(mes), year: parseInt(ano),
                departmentId: unidade || null,
                total: result.total,
                analysisData: { 
                    found: result.found, 
                    missing, 
                    extras: result.extras || [], 
                    excluded: excludedRows,
                    sheetSummary: result.sheetSummary 
                }
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

    async function handleReconcileName(row: FoundRow) {
        if (!confirm(`Deseja atualizar o nome de "${row.dbName}" para "${row.nome}" no sistema?`)) return
        try {
            await updateEmployeeName(row.id, row.nome)
            // Update local state without full reload
            if (result) {
                const newResult = { ...result }
                const idx = newResult.found.findIndex(r => r.id === row.id)
                if (idx !== -1) {
                    newResult.found[idx].dbName = row.nome
                    newResult.found[idx].nameMismatch = false
                }
                setResult(newResult)
            }
            alert("Nome atualizado com sucesso!")
        } catch (err: any) {
            alert("Erro ao atualizar nome: " + err.message)
        }
    }

    async function handleReconcileSalary(row: FoundRow) {
        if (!confirm(`Deseja atualizar o salário de "${row.nome}" de ${fmtBRL(row.dbSalary || 0)} para ${fmtBRL(row.valor)} no sistema?`)) return
        try {
            await updateEmployeeSalary(row.id, row.valor)
            // Update local state
            if (result) {
                const newResult = { ...result }
                const idx = newResult.found.findIndex(r => r.id === row.id)
                if (idx !== -1) {
                    newResult.found[idx].dbSalary = row.valor
                    newResult.found[idx].valueMismatch = false
                }
                setResult(newResult)
            }
            alert("Salário atualizado com sucesso!")
        } catch (err: any) {
            alert("Erro ao atualizar salário: " + err.message)
        }
    }

    function applyAiActions(actions: any[]): number {
        if (!result) return 0
        let count = 0
        let newFound = result.found.map(r => ({ ...r }))
        let newMissing = missing.map(r => ({ ...r }))
        let newExtras = (result.extras || []).map(r => ({ ...r }))

        for (const action of actions) {
            if (action.type === "update_valor") {
                const fi = newFound.findIndex(r => r.cpf === action.cpf && r.sheet === action.sheet)
                if (fi !== -1) { newFound[fi].valor = action.newValor; count++ }
                const mi = newMissing.findIndex(r => r.cpf === action.cpf && r.sheet === action.sheet)
                if (mi !== -1) { newMissing[mi].valor = action.newValor; count++ }
            } else if (action.type === "remove_row") {
                const beforeFound = newFound.length
                const beforeMissing = newMissing.length
                const beforeExtras = newExtras.length
                
                // Track removed
                const removedFound = newFound.filter(r => r.cpf === action.cpf && r.sheet === action.sheet)
                const removedMissing = newMissing.filter(r => r.cpf === action.cpf && r.sheet === action.sheet)
                const removedExtras = newExtras.filter((r: any) => r.cpfCnpj === action.cpf && r.sheet === action.sheet)
                
                newFound = newFound.filter(r => !(r.cpf === action.cpf && r.sheet === action.sheet))
                newMissing = newMissing.filter(r => !(r.cpf === action.cpf && r.sheet === action.sheet))
                newExtras = newExtras.filter((r: any) => !(r.cpfCnpj === action.cpf && r.sheet === action.sheet))
                
                if (newFound.length < beforeFound || newMissing.length < beforeMissing || newExtras.length < beforeExtras) {
                    count++
                    setExcludedRows(prev => [...prev, ...[...removedFound, ...removedMissing].map(r => ({ ...r, status: "excluded" as any, observacao: "Removido pela IA" })), ...removedExtras.map((r: any) => ({ ...r, cpf: r.cpfCnpj ?? "", status: "excluded" as any, observacao: "Removido pela IA" }))])
                }
            } else if (action.type === "update_field") {
                const val = action.field === "valor" ? parseFloat(action.newValue) : action.newValue
                const fi = newFound.findIndex(r => r.cpf === action.cpf && r.sheet === action.sheet)
                if (fi !== -1) { (newFound[fi] as any)[action.field] = val; count++ }
                const mi = newMissing.findIndex(r => r.cpf === action.cpf && r.sheet === action.sheet)
                if (mi !== -1) { (newMissing[mi] as any)[action.field] = val; count++ }
            }
        }

        // Recalculate sheetSummary
        const sheetMap = new Map<string, { count: number; total: number }>()
        const all = [...newFound, ...newMissing, ...newExtras.map(r => ({ ...r, cpf: r.cpfCnpj }))]
        all.forEach(r => {
            const entry = sheetMap.get(r.sheet) || { count: 0, total: 0 }
            entry.count++; entry.total += (r as any).valor || 0
            sheetMap.set(r.sheet, entry)
        })
        const newSheetSummary = Array.from(sheetMap.entries()).map(([sheet, data]) => ({ sheet, ...data }))

        const newTotal = all.reduce((s: number, r: any) => s + (r.valor || 0), 0)
        setResult({ ...result, found: newFound, extras: newExtras, total: newTotal, sheetSummary: newSheetSummary })
        setMissing(newMissing)
        return count
    }

    async function handleAiSend() {
        const command = aiInput.trim()
        if (!command || !result) return
        setAiInput("")
        setAiMessages(prev => [...prev, { role: "user", text: command }])
        setIsAiAnalyzing(true)
        try {
            const res = await fetch("/api/folha/ai-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    found: result.found,
                    missing,
                    extras: result.extras || [],
                    sheetSummary: result.sheetSummary,
                    mes,
                    ano,
                    unidade: unidadeLabel,
                    command,
                    history: aiMessages.slice(-6),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? "Erro no comando")
            const actionsCount = applyAiActions(data.actions || [])
            setAiMessages(prev => [...prev, { role: "assistant", text: data.message || "Pronto.", actionsCount }])
            setTimeout(() => aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
        } catch (err: any) {
            setAiMessages(prev => [...prev, { role: "assistant", text: `Erro: ${err.message}` }])
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
                setResult({ 
                    found: ad.found || [], 
                    missing: ad.missing || [], 
                    extras: ad.extras || [], 
                    total: Number(data.total), 
                    sheetSummary: ad.sheetSummary || [] 
                })
                setMissing(ad.missing || [])
                setExcludedRows(ad.excluded || [])
                setPhase("result"); setIsHistoryOpen(false)
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
            if (emp) setManualForm(f => ({ ...f, nome: emp.name, id: emp.id, telefone: emp.phone || "", cargo: emp.position || "", bankName: emp.bankName || "", bankAgency: emp.bankAgency || "", bankAccount: emp.bankAccount || "", pix: emp.pixKey || "" }))
            else { setManualForm(f => ({ ...f, id: "" })); alert("Funcionário não encontrado.") }
        } finally { setIsSearchingCpf(false) }
    }

    function addManualEmployee() {
        if (!manualForm.nome || !manualForm.cpf || !manualForm.valor || !manualForm.sheet) { alert("Preencha todos os campos"); return }
        const val = parseFloat(manualForm.valor.replace(",", ".")) || 0
        if (manualForm.id) {
            const newRow: FoundRow = { id: manualForm.id, nome: manualForm.nome, cpf: manualForm.cpf.replace(/\D/g, ""), valor: val, sheet: manualForm.sheet, telefone: manualForm.telefone || undefined, cargo: manualForm.cargo || undefined, bankName: manualForm.bankName || undefined, bankAgency: manualForm.bankAgency || undefined, bankAccount: manualForm.bankAccount || undefined, pix: manualForm.pix || undefined }
            if (result) { const r = { ...result }; r.found = [...r.found, newRow]; r.total += val; updateSheetSummary(r, manualForm.sheet, val); setResult(r) }
        } else {
            const newRow: MissingRow = { nome: manualForm.nome, cpf: manualForm.cpf.replace(/\D/g, ""), valor: val, sheet: manualForm.sheet, telefone: manualForm.telefone || undefined, bankName: manualForm.bankName || undefined, bankAgency: manualForm.bankAgency || undefined, bankAccount: manualForm.bankAccount || undefined, pix: manualForm.pix || undefined }
            setMissing(prev => [...prev, newRow])
            if (result) { const r = { ...result }; r.missing = [...r.missing, newRow]; r.total += val; updateSheetSummary(r, manualForm.sheet, val); setResult(r) }
        }
        setManualForm({ nome: "", cpf: "", valor: "", sheet: manualForm.sheet, id: "", telefone: "", cargo: "", bankName: "", bankAgency: "", bankAccount: "", pix: "" }); setIsAddingEmp(false)
    }

    function addManualExtra() {
        if (!extraForm.nome || !extraForm.cpfCnpj || !extraForm.valor || !extraForm.sheet) { alert("Preencha todos os campos"); return }
        const val = parseFloat(extraForm.valor.replace(",", ".")) || 0
        const newRow: ExtraRow = { nome: extraForm.nome, cpfCnpj: extraForm.cpfCnpj, valor: val, sheet: extraForm.sheet, cargo: extraForm.cargo || undefined, pix: extraForm.pix || undefined }
        if (result) { const r = { ...result }; r.extras = [...(r.extras || []), newRow]; r.total += val; updateSheetSummary(r, extraForm.sheet, val); setResult(r) }
        setExtraForm({ nome: "", cpfCnpj: "", valor: "", sheet: extraForm.sheet, cargo: "", pix: "" }); setIsAddingExtra(false)
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

    async function handleExportExcel() {
        if (!result) return

        // ── Exportação específica Banco do Brasil (mantém xlsx simples) ───────
        if (viewFilter === "BANCO DO BRASIL") {
            const aoa: any[][] = [["CPF", "Agência com DV", "Conta com DV", "Valor"]]
            filteredRows.forEach(r => {
                const cpfBB = r.cpf.length === 11 ? r.cpf.substring(0, 9) + "-" + r.cpf.substring(9) : r.cpf
                aoa.push([cpfBB, r.bankAgency || "", (r.bankAccount || "").replace(/\./g, ""), r.valor.toFixed(2).replace(".", ",")])
            })
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Banco do Brasil")
            XLSX.writeFile(wb, `folha-bb-${mes}-${ano}.xlsx`)
            return
        }

        // ── ExcelJS: cabeçalho amarelo + negrito + autofilter ─────────────────
        const ExcelJS = (await import("exceljs")).default
        const wb = new ExcelJS.Workbook()
        wb.creator = "PepaCorp"
        wb.created = new Date()

        const HEADER_FILL: ExcelJSTypes.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } }
        const HEADER_FONT: Partial<ExcelJSTypes.Font> = { bold: true, size: 11 }
        const TOTAL_FILL: ExcelJSTypes.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } }
        const TOTAL_FONT: Partial<ExcelJSTypes.Font> = { bold: true }

        function styleHeaderRow(ws: ExcelJSTypes.Worksheet, colCount: number) {
            const row = ws.getRow(1)
            row.font = HEADER_FONT
            row.fill = HEADER_FILL
            row.alignment = { vertical: "middle", horizontal: "center" }
            row.height = 18
            // AutoFilter across all header columns
            ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } }
        }

        function styleTotalRow(ws: ExcelJSTypes.Worksheet) {
            const row = ws.getRow(ws.rowCount)
            row.font = TOTAL_FONT
            row.fill = TOTAL_FILL
        }

        // ── Abas de dados ─────────────────────────────────────────────────────
        const allExportRows = viewFilter === "EXCLUIDOS" ? [] : resultRows
        const sheetNames = Array.from(new Set(allExportRows.map(r => r.sheet))).sort()

        const usedNames = new Set<string>()
        for (const sheetName of sheetNames) {
            const rowsInSheet = allExportRows.filter(r => r.sheet === sheetName)
            if (rowsInSheet.length === 0) continue

            const totalInSheet = rowsInSheet.reduce((acc, r) => acc + r.valor, 0)

            let baseName = (sheetName || "Geral").substring(0, 31).replace(/[\[\]?*/\\:]/g, "")
            let finalName = baseName
            let counter = 1
            while (usedNames.has(finalName)) {
                const suffix = ` (${counter})`
                finalName = baseName.substring(0, 31 - suffix.length) + suffix
                counter++
            }
            usedNames.add(finalName)

            const ws = wb.addWorksheet(finalName)
            ws.columns = [
                { header: "Nome",           key: "nome",    width: 42 },
                { header: "CPF",            key: "cpf",     width: 18 },
                { header: "Status",         key: "status",  width: 18 },
                { header: "Banco",          key: "banco",   width: 24 },
                { header: "Agência",        key: "agencia", width: 14 },
                { header: "Conta",          key: "conta",   width: 18 },
                { header: "PIX",            key: "pix",     width: 30 },
                { header: "Salário Líquido",key: "valor",   width: 18 },
                { header: "Aba Origem",     key: "aba",     width: 18 },
            ]

            rowsInSheet.forEach(r => {
                ws.addRow({
                    nome:   r.nome,
                    cpf:    fmtCpf(r.cpf),
                    status: r.status === "found" ? "Cadastrado" : r.status === "missing" ? "Não cadastrado" : "Sem CPF",
                    banco:  r.bankName  || "—",
                    agencia:r.bankAgency|| "—",
                    conta:  r.bankAccount|| "—",
                    pix:    r.pix       || "—",
                    valor:  r.valor,
                    aba:    r.sheet,
                })
            })

            ws.addRow({ nome: "TOTAL", cpf: "", status: "", banco: "", agencia: "", conta: "", pix: "", valor: totalInSheet, aba: "" })

            styleHeaderRow(ws, 9)
            styleTotalRow(ws)

            // Formata coluna Salário Líquido como moeda
            ws.getColumn("valor").numFmt = '"R$"#,##0.00'
        }

        // ── Aba "Motivo" ──────────────────────────────────────────────────────
        if (excludedRows.length > 0) {
            const wsMotivo = wb.addWorksheet("Motivo")
            wsMotivo.columns = [
                { header: "Nome",               key: "nome",    width: 42 },
                { header: "CPF",                key: "cpf",     width: 18 },
                { header: "Aba Origem",         key: "aba",     width: 18 },
                { header: "Salário Líquido",    key: "valor",   width: 18 },
                { header: "Motivo / Observação",key: "motivo",  width: 52 },
            ]

            excludedRows.forEach(r => {
                wsMotivo.addRow({
                    nome:   r.nome,
                    cpf:    fmtCpf(r.cpf),
                    aba:    r.sheet,
                    valor:  r.valor,
                    motivo: (r as ExcludedRow).observacao || "Sem motivo informado",
                })
            })

            const totalExcluido = excludedRows.reduce((acc, r) => acc + r.valor, 0)
            wsMotivo.addRow({ nome: "TOTAL EXCLUÍDO", cpf: "", aba: "", valor: totalExcluido, motivo: "" })

            styleHeaderRow(wsMotivo, 5)
            styleTotalRow(wsMotivo)
            wsMotivo.getColumn("valor").numFmt = '"R$"#,##0.00'
        }

        // Gera e faz download
        const buffer = await wb.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `folha-analisada-${mes}-${ano}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    }

    const resultRows: AnalyzedRow[] = result
        ? [
            ...result.found.map(r => ({ ...r, status: "found" as const })),
            ...missing.map(r => ({ ...r, status: "missing" as const })),
            ...(result.extras || []).map(r => ({ ...r, cpf: r.cpfCnpj, status: "extra" as const })),
        ] : []

    const { duplicateCpfSet, crossAbaDuplicateSet, duplicateNomeSet } = useMemo(() => {
        const counts = new Map<string, number>()
        const sheetsMap = new Map<string, Set<string>>()
        const nomeCounts = new Map<string, number>()
        
        resultRows.forEach(r => {
            const nKey = r.nome.toLowerCase().trim()
            nomeCounts.set(nKey, (nomeCounts.get(nKey) ?? 0) + 1)

            if (!r.cpf || r.cpf === "—") return
            const key = `${r.sheet}::${r.cpf}`
            counts.set(key, (counts.get(key) ?? 0) + 1)
            if (!sheetsMap.has(r.cpf)) sheetsMap.set(r.cpf, new Set())
            sheetsMap.get(r.cpf)!.add(r.sheet)
        })

        const dupCpf = new Set<string>()
        const crossDup = new Set<string>()
        const dupNome = new Set<string>()

        counts.forEach((count, key) => { if (count > 1) dupCpf.add(key) })
        sheetsMap.forEach((sheets, cpf) => { if (sheets.size > 1) crossDup.add(cpf) })
        nomeCounts.forEach((count, name) => { if (count > 1) dupNome.add(name) })

        return { duplicateCpfSet: dupCpf, crossAbaDuplicateSet: crossDup, duplicateNomeSet: dupNome }
    }, [resultRows])

    // Priority: 0 = inconsistência (CPF inválido, dup, divergência, extra) → topo
    //           1 = não cadastrado (missing sem outra inconsistência)
    //           2 = cadastrado sem problemas → base
    const rowPriority = useCallback((r: AnalyzedRow): number => {
        const hasInconsistency =
            !!(r as any).isInvalidCpf ||
            (r.status === "found" && !!(r as FoundRow).nameMismatch) ||
            (r.status === "found" && !!(r as FoundRow).valueMismatch) ||
            duplicateCpfSet.has(`${r.sheet}::${r.cpf}`) ||
            crossAbaDuplicateSet.has(r.cpf) ||
            duplicateNomeSet.has(r.nome.toLowerCase().trim()) ||
            r.status === "extra"
        if (hasInconsistency) return 0
        if (r.status === "missing") return 1
        return 2
    }, [duplicateCpfSet, crossAbaDuplicateSet, duplicateNomeSet])

    const sortedResultRows = useMemo(() => {
        return [...resultRows].sort((a, b) => {
            const pa = rowPriority(a)
            const pb = rowPriority(b)
            if (pa !== pb) return pa - pb
            return a.nome.localeCompare(b.nome)
        })
    }, [resultRows, rowPriority])

    const filteredRows = useMemo(() => {
        const sortFn = (a: AnalyzedRow, b: AnalyzedRow) => {
            const pa = rowPriority(a), pb = rowPriority(b)
            if (pa !== pb) return pa - pb
            return a.nome.localeCompare(b.nome)
        }

        let base = viewFilter === "EXCLUIDOS" ? [...excludedRows].sort(sortFn) : sortedResultRows
        
        if (viewFilter === "BANCO") {
            base = sortedResultRows.filter(r => r.bankName && r.bankName !== "—")
        } else if (viewFilter === "NAO_IDENTIFICADO") {
            base = sortedResultRows.filter(r => normalizeBankName(r.bankName) === "Não identificado")
        } else if (viewFilter === "CAIXA") {
            base = sortedResultRows.filter(r => (r.bankName || "").toUpperCase().startsWith("CAIXA"))
        } else if (viewFilter !== "GERAL" && viewFilter !== "EXCLUIDOS") {
            base = sortedResultRows.filter(r => (r.bankName || "").toUpperCase() === viewFilter)
        }

        return selectedSheet ? base.filter(r => r.sheet === selectedSheet) : base
    }, [viewFilter, sortedResultRows, excludedRows, selectedSheet, duplicateCpfSet, crossAbaDuplicateSet, duplicateNomeSet])

    const invalidCpfCount = resultRows.filter(r => (r as any).isInvalidCpf).length
    const nameMismatchCount = resultRows.filter(r => r.status === "found" && (r as FoundRow).nameMismatch).length
    const valMismatchCount = resultRows.filter(r => r.status === "found" && (r as FoundRow).valueMismatch).length
    const duplicateCpfCount = duplicateCpfSet.size
    const crossAbaDuplicateCount = crossAbaDuplicateSet.size

    const totalDiversions = useMemo(() => {
        if (!result) return 0
        return invalidCpfCount + 
               nameMismatchCount + 
               valMismatchCount +
               duplicateCpfCount + 
               crossAbaDuplicateCount + 
               missing.length +
               (result?.extras?.length || 0)
    }, [result, resultRows, invalidCpfCount, nameMismatchCount, valMismatchCount, duplicateCpfCount, crossAbaDuplicateCount, missing])

    const errorGroups = useMemo(() => {
        if (!result) return { unregistered: [], invalidCpfs: [], nameMismatches: [], valueMismatches: [], duplicates: [], extras: [] }
        
        const unregistered = missing.map(r => ({ ...r, status: "missing" as const, errorType: "unregistered" as const }))
        const invalidCpfs = resultRows.filter(r => (r as any).isInvalidCpf).map(r => ({ ...r, errorType: "invalidCpf" as const }))
        const nameMismatches = resultRows.filter(r => r.status === "found" && (r as FoundRow).nameMismatch).map(r => ({ ...r, status: "found" as const, errorType: "nameMismatch" as const }))
        const valueMismatches = resultRows.filter(r => r.status === "found" && (r as FoundRow).valueMismatch).map(r => ({ ...r, status: "found" as const, errorType: "valueMismatch" as const }))
        
        // Group duplicates by CPF or Name
        const duplicates: AnalyzedRow[] = resultRows.filter(r => 
            duplicateCpfSet.has(`${r.sheet}::${r.cpf}`) || 
            crossAbaDuplicateSet.has(r.cpf) || 
            duplicateNomeSet.has(r.nome.toLowerCase().trim())
        ).map(r => ({ ...r, errorType: "duplicate" as const }))
        
        const extras = (result.extras || []).map(r => ({ ...r, status: "extra" as const, cpf: (r as any).cpfCnpj || "", errorType: "extra" as const }))

        return { unregistered, invalidCpfs, nameMismatches, valueMismatches, duplicates, extras }
    }, [result, resultRows, missing, duplicateCpfSet, crossAbaDuplicateSet, duplicateNomeSet])

    const [activeErrorTab, setActiveErrorTab] = useState<"unregistered" | "invalidCpfs" | "duplicates" | "nameMismatches" | "valueMismatches" | "extras">("invalidCpfs")

    const showResults = phase === "result" || phase === "pending"

    const bankSummary = useMemo(() => {
        if (!result) return []
        const counts: Record<string, { count: number; total: number }> = {}
        resultRows.forEach(r => {
            const bank = normalizeBankName(r.bankName)
            if (!counts[bank]) counts[bank] = { count: 0, total: 0 }
            counts[bank].count++
            counts[bank].total += r.valor
        })
        return Object.entries(counts).map(([bank, data]) => ({ bank, ...data })).sort((a, b) => b.total - a.total)
    }, [result, resultRows])

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

                                {/* Corrigir colunas */}
                                {debugInfo && debugInfo.length > 0 && (
                                    <button
                                        onClick={() => {
                                            // Pre-populate draft with current detected values
                                            const draft: ColumnHints = {}
                                            for (const s of debugInfo) {
                                                draft[s.sheet] = {
                                                    nome:     columnHints[s.sheet]?.nome     ?? s.detected.nome     ?? "",
                                                    valor:    columnHints[s.sheet]?.valor    ?? s.detected.valor    ?? "",
                                                    cpf:      columnHints[s.sheet]?.cpf      ?? s.detected.cpf      ?? "",
                                                    telefone: columnHints[s.sheet]?.telefone ?? s.detected.telefone ?? "",
                                                    cargo:    columnHints[s.sheet]?.cargo    ?? s.detected.cargo    ?? "",
                                                    banco:    columnHints[s.sheet]?.banco    ?? s.detected.banco    ?? "",
                                                    agencia:  columnHints[s.sheet]?.agencia  ?? s.detected.agencia  ?? "",
                                                    conta:    columnHints[s.sheet]?.conta    ?? s.detected.conta    ?? "",
                                                    pix:      columnHints[s.sheet]?.pix      ?? s.detected.pix      ?? "",
                                                }
                                            }
                                            setCorrectionDraft(draft)
                                            setIsColumnCorrectionOpen(true)
                                        }}
                                        className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                                    >
                                        <Edit className="h-3.5 w-3.5" /> Corrigir colunas
                                    </button>
                                )}

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

                                <SelectField
                                    label="Visão"
                                    value={viewFilter}
                                    onChange={setViewFilter}
                                    options={[
                                        { value: "GERAL", label: "Geral" },
                                        { value: "EXCLUIDOS", label: "Excluídos" },
                                        { value: "BANCO", label: "Banco (Todos)" },
                                        { value: "NAO_IDENTIFICADO", label: "Banco não identificado" },
                                        { value: "MENTORE", label: "Mentore" },
                                        { value: "BANCO DO BRASIL", label: "Banco do Brasil" },
                                        { value: "CAIXA", label: "Caixa" },
                                        { value: "BRADESCO", label: "Bradesco" },
                                    ]}
                                />

                                <button onClick={handleExportExcel} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                    <Download className="h-3.5 w-3.5" /> Exportar
                                </button>
                                <button
                                    onClick={() => setIsAiOpen(true)}
                                    className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> IA
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Resumo por Banco */}
                    {showResults && bankSummary.length > 0 && (
                        <div className="px-5 py-3 border-b bg-white flex flex-wrap items-center gap-6 animate-in slide-in-from-top-1 duration-300">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-400" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                    {selectedSheet ? filteredRows.length : resultRows.length} Colaboradores
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-5">
                                {bankSummary.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 border-l border-slate-200 pl-5 first:border-0 first:pl-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.bank}</span>
                                        <span className="text-xs font-black text-blue-600 tabular-nums">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resumo por Aba */}
                    {showResults && result && result.sheetSummary.length > 0 && (
                        <div className="px-5 py-4 border-b bg-white animate-in fade-in slide-in-from-top-1 duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Resumo por Aba</p>
                            <div className="flex flex-wrap gap-2">
                                {/* Card Todas */}
                                <button
                                    onClick={() => setSelectedSheet(null)}
                                    className={cn(
                                        "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all min-w-[130px]",
                                        selectedSheet === null
                                            ? "border-blue-300 bg-blue-50 shadow-sm"
                                            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                                    )}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Todas as abas</span>
                                    <span className="text-xl font-black text-slate-800 mt-1">{resultRows.length}</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">colaboradores</span>
                                    <span className="text-xs font-black text-blue-600 mt-1">{fmtBRL(result.total)}</span>
                                </button>
                                {/* Um card por aba */}
                                {result.sheetSummary.map((s) => (
                                    <button
                                        key={s.sheet}
                                        onClick={() => setSelectedSheet(prev => prev === s.sheet ? null : s.sheet)}
                                        className={cn(
                                            "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all min-w-[130px]",
                                            selectedSheet === s.sheet
                                                ? "border-blue-300 bg-blue-50 shadow-sm"
                                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                                        )}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate max-w-[160px]" title={s.sheet}>{s.sheet}</span>
                                        <span className="text-xl font-black text-slate-800 mt-1">{s.count}</span>
                                        <span className="text-[10px] text-slate-500 font-semibold">colaboradores</span>
                                        <span className="text-xs font-black text-emerald-600 mt-1">{fmtBRL(s.total)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading/Analyzing Phase */}
                    {phase === "loading" && (
                        <div className="flex flex-1 flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-700">
                            <div className="relative h-40 w-40">
                                {/* Outer glowing ring */}
                                <div className="absolute inset-0 rounded-full border-8 border-blue-50/50" />
                                <div className="absolute inset-0 rounded-full border-8 border-t-blue-600 animate-spin shadow-[0_0_20px_rgba(37,99,235,0.2)]" />
                                
                                {/* Inner counter-rotating ring */}
                                <div className="absolute inset-4 rounded-full border-4 border-slate-50" />
                                <div className="absolute inset-4 rounded-full border-4 border-b-indigo-500 animate-spin-reverse opacity-70" style={{ animationDuration: '3s' }} />
                                
                                {/* Central content */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Sparkles className="h-10 w-10 text-blue-600 animate-pulse mb-1" />
                                    <div className="h-1 w-12 bg-blue-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 animate-shimmer" style={{ width: '50%' }} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-12 text-center max-w-sm px-6">
                                <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">IA ANALISANDO FOLHA</h3>
                                
                                <div className="flex items-center justify-center gap-1.5 mt-4">
                                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
                                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
                                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" />
                                </div>
                                
                                <p className="text-slate-500 mt-6 text-sm font-medium leading-relaxed">
                                    Estamos processando cada linha, validando CPFs e organizando os dados bancários para o seu fechamento.
                                </p>
                                
                                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                                    <FileSpreadsheet className="h-3 w-3" />
                                    Verificando Consistência
                                </div>
                            </div>
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

                    {/* Missing CPFs and Inconsistencies banner */}
                    {phase === "pending" && (missing.length > 0 || invalidCpfCount > 0 || nameMismatchCount > 0 || valMismatchCount > 0 || duplicateCpfCount > 0 || crossAbaDuplicateCount > 0) && (
                        <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                <div>
                                    <h3 className="text-sm font-bold text-amber-900">Atenção Necessária ({missing.length + invalidCpfCount + nameMismatchCount + valMismatchCount + duplicateCpfCount + crossAbaDuplicateCount})</h3>
                                    <p className="text-[11px] text-amber-700">
                                        {missing.length > 0 && `${missing.length} não cadastrados. `}
                                        {invalidCpfCount > 0 && `${invalidCpfCount} CPF(s) inválidos. `}
                                        {nameMismatchCount > 0 && `${nameMismatchCount} divergências de nome. `}
                                        {valMismatchCount > 0 && `${valMismatchCount} divergências de valor. `}
                                        {duplicateCpfCount > 0 && `${duplicateCpfCount} CPF(s) dup. mesma aba. `}
                                        {crossAbaDuplicateCount > 0 && `${crossAbaDuplicateCount} CPF(s) dup. entre abas.`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleRegisterAll} disabled={registering}
                                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors">
                                    {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                    Cadastrar Todos
                                </button>
                                <button onClick={() => setIsErrorCorrectionOpen(true)} disabled={registering}
                                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100/50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60 transition-colors">
                                    <Edit className="h-3.5 w-3.5" /> Corrigir Erros
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
                                            <th className="px-5 py-3">ABA</th>
                                            {viewFilter === "EXCLUIDOS"
                                                ? <th className="px-5 py-3 text-amber-600">Observação / Motivo</th>
                                                : <><th className="px-5 py-3">Dados Bancários</th>
                                                    <th className="px-5 py-3 text-left border-l border-slate-100 italic font-medium text-blue-500">Pix</th></>
                                            }
                                            <th className="px-5 py-3 text-right">Valor Líquido</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRows.map((row, i) => {
                                            const isDupSameAba = duplicateCpfSet.has(`${row.sheet}::${row.cpf}`);
                                            const isDupCrossAba = !isDupSameAba && crossAbaDuplicateSet.has(row.cpf);
                                            const hasNameIssue = !!(row as any).isInvalidCpf || (row.status === "found" && (row as FoundRow).nameMismatch);
                                            const rowBg = isDupSameAba
                                                ? "bg-purple-50/70 hover:bg-purple-100/70"
                                                : isDupCrossAba
                                                    ? "bg-indigo-50/70 hover:bg-indigo-100/70"
                                                    : hasNameIssue
                                                        ? "bg-amber-50/70 hover:bg-amber-100/70"
                                                        : "hover:bg-slate-50";
                                            return (
                                                <tr key={i} className={`transition-colors ${rowBg}`}>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-slate-800">{row.nome}</p>
                                                        {row.status === "found" && (row as FoundRow).nameMismatch && (
                                                            <Badge variant="outline" className="h-5 px-1.5 border-amber-200 bg-amber-50 text-amber-700 text-[9px] gap-1 animate-pulse">
                                                                <AlertCircle className="h-3 w-3" /> Divergência
                                                            </Badge>
                                                        )}
                                                        {isDupSameAba && (
                                                            <Badge variant="outline" className="h-5 px-1.5 border-purple-200 bg-purple-50 text-purple-700 text-[9px] gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Dup. mesma aba
                                                            </Badge>
                                                        )}
                                                        {isDupCrossAba && (
                                                            <Badge variant="outline" className="h-5 px-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 text-[9px] gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Dup. outra aba
                                                            </Badge>
                                                        )}
                                                        {duplicateNomeSet.has(row.nome.toLowerCase().trim()) && (
                                                            <Badge variant="outline" className="h-5 px-1.5 border-teal-200 bg-teal-50 text-teal-700 text-[9px] gap-1">
                                                                <AlertCircle className="h-3 w-3" /> Divergência (Nome)
                                                            </Badge>
                                                        )}
                                                        {row.status === "extra" && (
                                                            <Badge variant="outline" className="h-5 px-1.5 border-orange-200 bg-orange-50 text-orange-700 text-[9px] gap-1 animate-pulse">
                                                                <AlertCircle className="h-3 w-3" /> Divergência (Sem CPF)
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-[10px] font-mono ${isDupSameAba ? "text-purple-500" : isDupCrossAba ? "text-indigo-500" : "text-slate-400"}`}>{fmtCpf(row.cpf)}</p>
                                                        {(row as any).isInvalidCpf && (
                                                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">CPF Inválido</span>
                                                        )}
                                                    </div>
                                                    {row.status === "found" && (row as FoundRow).nameMismatch && (
                                                        <p className="text-[9px] text-slate-400 italic mt-0.5">Sist: {(row as FoundRow).dbName}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                                                        {row.sheet}
                                                    </span>
                                                </td>
                                                {viewFilter === "EXCLUIDOS" ? (
                                                    <td className="px-5 py-3 max-w-[260px]">
                                                        {(row as ExcludedRow).observacao ? (
                                                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 block">
                                                                {(row as ExcludedRow).observacao}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 italic text-[11px]">Sem observação</span>
                                                        )}
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="px-5 py-3 text-xs text-slate-500">
                                                            {(row.bankName || row.bankAgency || row.bankAccount) ? (
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-slate-700">{row.bankName || "—"}</span>
                                                                    <span className="text-[10px]">Ag: {row.bankAgency || "—"} | Cc: {row.bankAccount || "—"}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 italic text-[11px]">Não informado</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 border-l border-slate-50">
                                                            {row.pix ? (
                                                                <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md truncate max-w-[150px] block" title={row.pix}>
                                                                    {row.pix}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300 italic text-[11px]">Não inf.</span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-5 py-3 text-right font-bold text-slate-800">{fmtBRL(row.valor)}</td>
                                                <td className="px-5 py-3">
                                                    {row.status === "found"
                                                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        : <AlertTriangle className="h-5 w-5 text-amber-400" />
                                                    }
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {viewFilter === "EXCLUIDOS" ? (
                                                            <button
                                                                onClick={() => handleRestoreRow(row)}
                                                                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                                                                title="Restaurar Linha"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </button>
                                                        ) : (
                                                            <>
                                                                {(isDupSameAba || isDupCrossAba) && (
                                                                    <button
                                                                        onClick={() => handleMergeDuplicates(row.cpf)}
                                                                        className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                                                                        title="Mesclar por CPF"
                                                                    >
                                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                                {duplicateNomeSet.has(row.nome.toLowerCase().trim()) && (
                                                                    <button
                                                                        onClick={() => handleMergeDuplicatesByName(row.nome)}
                                                                        className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50 transition-colors"
                                                                        title="Mesclar por Nome"
                                                                    >
                                                                        <Users className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteRow(row)}
                                                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                                                                    title="Excluir Linha"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Exclude reason dialog ─── */}
            <Dialog open={!!pendingExclude} onOpenChange={(open) => { if (!open) setPendingExclude(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-500" /> Excluir funcionário
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        Excluindo <strong>{pendingExclude?.row.nome}</strong>.<br />
                        Informe o motivo da exclusão para registro:
                    </p>
                    <Textarea
                        placeholder="Ex: Férias, afastamento, pagamento em duplicidade, rescisão..."
                        value={excludeReasonInput}
                        onChange={e => setExcludeReasonInput(e.target.value)}
                        className="resize-none h-24"
                        autoFocus
                    />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setPendingExclude(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (pendingExclude) {
                                    doExcludeRow(pendingExclude.row, excludeReasonInput.trim() || "Sem motivo informado")
                                    setPendingExclude(null)
                                }
                            }}
                        >
                            Confirmar exclusão
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Column Correction dialog (post-analysis) ─── */}
            <Dialog open={isColumnCorrectionOpen} onOpenChange={setIsColumnCorrectionOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5 text-amber-500" /> Corrigir mapeamento de colunas
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Selecione a coluna correta para cada campo ou escolha <strong>&quot;Não existe&quot;</strong> para remover o mapeamento.
                        A planilha será reanalisada ao confirmar.
                    </p>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {(debugInfo ?? []).map((sheetInfo) => {
                            const sheetDraft = correctionDraft[sheetInfo.sheet] ?? {}
                            const nonEmptyHeaders = sheetInfo.headers.filter(h => h.trim() !== "")
                            const FIELDS: { key: string; label: string; critical?: boolean }[] = [
                                { key: "nome",     label: "Nome do funcionário", critical: true },
                                { key: "valor",    label: "Valor / Salário",     critical: true },
                                { key: "cpf",      label: "CPF / Documento",     critical: true },
                                { key: "telefone", label: "Telefone" },
                                { key: "cargo",    label: "Cargo / Função" },
                                { key: "banco",    label: "Banco" },
                                { key: "agencia",  label: "Agência" },
                                { key: "conta",    label: "Conta" },
                                { key: "pix",      label: "Chave PIX" },
                            ]
                            return (
                                <div key={sheetInfo.sheet} className="rounded-lg border p-3 space-y-3">
                                    <p className="text-sm font-semibold flex items-center gap-1.5">
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                                        Aba: <span className="text-blue-600">{sheetInfo.sheet}</span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {FIELDS.map(({ key, label, critical }) => (
                                            <div key={key} className="space-y-0.5">
                                                <Label className="text-xs flex items-center gap-1">
                                                    {label}
                                                    {critical && <span className="text-red-400">*</span>}
                                                </Label>
                                                <Select
                                                    value={sheetDraft[key] ?? ""}
                                                    onValueChange={(val) => setCorrectionDraft(prev => ({
                                                        ...prev,
                                                        [sheetInfo.sheet]: { ...(prev[sheetInfo.sheet] ?? {}), [key]: val }
                                                    }))}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="— não mapeado —" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__" className="text-slate-400 italic">Não existe (remover)</SelectItem>
                                                        {nonEmptyHeaders.map(h => (
                                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsColumnCorrectionOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => {
                                const hints = { ...correctionDraft }
                                setColumnHints(hints)
                                setIsColumnCorrectionOpen(false)
                                confirmAndAnalyze(hints)
                            }}
                        >
                            Reanalisar com correções
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Column Mapping dialog ─── */}
            <Dialog open={!!columnMappingSheets} onOpenChange={(open) => { if (!open) setColumnMappingSheets(null) }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> Mapeamento de colunas necessário
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Não foi possível identificar automaticamente as colunas de algumas abas. Selecione abaixo qual coluna corresponde a cada campo:
                    </p>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {(columnMappingSheets ?? []).map((sheetInfo) => {
                            const sheetHints = columnHints[sheetInfo.sheet] ?? {}
                            const FIELD_LABELS: Record<string, string> = { nome: "Nome do funcionário", valor: "Valor / Salário", cpf: "CPF / Documento" }
                            return (
                                <div key={sheetInfo.sheet} className="rounded-lg border p-3 space-y-3">
                                    <p className="text-sm font-semibold">Aba: <span className="text-blue-600">{sheetInfo.sheet}</span></p>
                                    {sheetInfo.undetected.map(field => (
                                        <div key={field} className="space-y-1">
                                            <Label className="text-xs">{FIELD_LABELS[field] ?? field}</Label>
                                            <Select
                                                value={sheetHints[field] ?? ""}
                                                onValueChange={(val) => setColumnHints(prev => ({
                                                    ...prev,
                                                    [sheetInfo.sheet]: { ...(prev[sheetInfo.sheet] ?? {}), [field]: val }
                                                }))}
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue placeholder="Selecione a coluna..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sheetInfo.availableHeaders.filter(h => h).map(h => (
                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setColumnMappingSheets(null)}>Cancelar</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                                const hints = { ...columnHints }
                                setColumnMappingSheets(null)
                                confirmAndAnalyze(hints)
                            }}
                        >
                            Reanalisar com mapeamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <Button onClick={() => confirmAndAnalyze()} className="bg-blue-600 hover:bg-blue-700 gap-2">
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
                            <div className="space-y-2">
                                <Label>Banco (Opcional)</Label>
                                <Input placeholder="Ex: Itaú" value={manualForm.bankName} onChange={e => setManualForm(f => ({ ...f, bankName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Agência (Opcional)</Label>
                                <Input placeholder="0000" value={manualForm.bankAgency} onChange={e => setManualForm(f => ({ ...f, bankAgency: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Conta (Opcional)</Label>
                                <Input placeholder="00000-0" value={manualForm.bankAccount} onChange={e => setManualForm(f => ({ ...f, bankAccount: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>PIX (Opcional)</Label>
                                <Input placeholder="Chave PIX" value={manualForm.pix} onChange={e => setManualForm(f => ({ ...f, pix: e.target.value }))} />
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
                            <div className="space-y-2">
                                <Label>PIX (Opcional)</Label>
                                <Input placeholder="Chave PIX" value={extraForm.pix || ""} onChange={e => setExtraForm(f => ({ ...f, pix: e.target.value }))} />
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

            {/* ─── AI Chat Widget ─── */}
            {isAiOpen && (
                <div className="fixed bottom-6 right-6 w-[440px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col overflow-hidden z-[100] animate-in slide-in-from-bottom-5 duration-300">
                    <div className="px-5 py-4 border-b flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Assistente de Folha (IA)</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider">Correções e Análise</p>
                            </div>
                        </div>
                        <button onClick={() => { setIsAiOpen(false); setAiMessages([]) }} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-[350px] max-h-[480px] bg-slate-50/50">
                        {aiMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full py-12 gap-3 text-slate-400">
                                <div className="h-16 w-16 rounded-3xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
                                    <Sparkles className="h-8 w-8 text-purple-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-600">Pronto para corrigir sua planilha</p>
                                    <p className="text-xs text-slate-400 max-w-[240px] mx-auto mt-1 leading-relaxed">
                                        Digite comandos como: Remova duplicados ou Mude o valor de João para 2500.
                                    </p>
                                </div>
                            </div>
                        )}
                        {aiMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                    msg.role === "user"
                                        ? "bg-purple-600 text-white rounded-br-sm"
                                        : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                                }`}>
                                    <p>{msg.text}</p>
                                    {msg.role === "assistant" && msg.actionsCount !== undefined && msg.actionsCount > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-emerald-600 font-black uppercase tracking-wider">
                                            <ShieldCheck className="h-3 w-3" /> {msg.actionsCount} Alteração(ões) Aplicada(s)
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isAiAnalyzing && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Processando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={aiChatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-5 py-4 border-t bg-white flex gap-2">
                        <textarea
                            placeholder="Descreva o que deseja corrigir..."
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSend() } }}
                            className="flex-1 min-h-[50px] max-h-[120px] resize-none text-sm border-slate-200 focus:border-purple-300 focus:ring-0 focus:outline-none rounded-xl p-3 bg-slate-50/50"
                            disabled={isAiAnalyzing}
                        />
                        <button
                            onClick={handleAiSend}
                            disabled={isAiAnalyzing || !aiInput.trim()}
                            className="self-end bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-200 transition-all active:scale-95"
                        >
                            <Sparkles className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

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

            {/* ─── Error Correction Dialog ─── */}
            <Dialog open={isErrorCorrectionOpen} onOpenChange={setIsErrorCorrectionOpen}>
                <DialogContent size="xl" className="p-0 h-[85vh] overflow-hidden bg-slate-50 border-none shadow-2xl block">
                    <div className="flex h-full w-full">
                        {/* Sidebar Tabs */}
                        <div className="w-64 bg-white border-r flex flex-col pt-6">
                            <DialogHeader className="px-6 mb-8 pt-0">
                                <DialogTitle className="text-lg font-bold text-slate-800">Correção de Erros</DialogTitle>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Total de {totalDiversions} pendências</p>
                            </DialogHeader>
                            
                            <div className="flex-1 px-3 space-y-1">
                                {[
                                    { id: "unregistered", label: "Não Cadastrados", count: errorGroups.unregistered.length, icon: UserPlus, color: "text-amber-500" },
                                    { id: "invalidCpfs", label: "CPFs Inválidos", count: errorGroups.invalidCpfs.length, icon: ShieldCheck, color: "text-red-500" },
                                    { id: "duplicates", label: "Duplicidades", count: errorGroups.duplicates.length, icon: RotateCcw, color: "text-purple-500" },
                                    { id: "nameMismatches", label: "Divergência Nome", count: errorGroups.nameMismatches.length, icon: Info, color: "text-blue-500" },
                                    { id: "valueMismatches", label: "Divergência Valor", count: errorGroups.valueMismatches.length, icon: Receipt, color: "text-emerald-500" },
                                    { id: "extras", label: "Sem CPF (Extras)", count: errorGroups.extras.length, icon: AlertCircle, color: "text-orange-500" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveErrorTab(tab.id as any)}
                                        disabled={tab.count === 0}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group",
                                            activeErrorTab === tab.id ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50",
                                            tab.count === 0 && "opacity-30 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <tab.icon className={cn("h-4 w-4", activeErrorTab === tab.id ? "text-blue-600" : tab.color)} />
                                            <span className="text-xs font-semibold">{tab.label}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                                            activeErrorTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                                        )}>{tab.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
                            <div className="px-8 py-6 bg-white border-b flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">
                                        {activeErrorTab === "unregistered" && "Funcionários não encontrados no sistema"}
                                        {activeErrorTab === "invalidCpfs" && "CPFs com formato ou dígitos inválidos"}
                                        {activeErrorTab === "duplicates" && "Registros duplicados detectados"}
                                        {activeErrorTab === "nameMismatches" && "Divergências entre planilha e sistema"}
                                        {activeErrorTab === "valueMismatches" && "Divergências de valores (spreadsheet vs sistema)"}
                                        {activeErrorTab === "extras" && "Registros extras sem CPF identificado"}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 font-medium">Selecione os registros para correção ou exclusão em massa.</p>
                                </div>
                                <button onClick={() => setIsErrorCorrectionOpen(false)} className="h-10 w-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                                {/* Bulk Actions Header */}
                                <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedErrorRows.length === errorGroups[activeErrorTab].length && errorGroups[activeErrorTab].length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedErrorRows(errorGroups[activeErrorTab].map(r => `${r.sheet}::${r.cpf || (r as any).nome}`))
                                                } else {
                                                    setSelectedErrorRows([])
                                                }
                                            }}
                                        />
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selecionar todos os {errorGroups[activeErrorTab].length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedErrorRows.length > 0 && (
                                            <>
                                                <button 
                                                    onClick={() => {
                                                        const rows = errorGroups[activeErrorTab].filter(r => selectedErrorRows.includes(`${r.sheet}::${r.cpf || (r as any).nome}`))
                                                        if (confirm(`Remover ${rows.length} registros selecionados?`)) {
                                                            rows.forEach(r => doExcludeRow(r as any, "Remoção em lote via ferramenta de correção"))
                                                            setSelectedErrorRows([])
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-colors"
                                                >
                                                    <Trash2 className="h-3 w-3" /> Excluir ({selectedErrorRows.length})
                                                </button>


                                                {activeErrorTab === "duplicates" && (
                                                    <button 
                                                        onClick={() => {
                                                            const rows = errorGroups.duplicates.filter(r => selectedErrorRows.includes(`${r.sheet}::${r.cpf}`))
                                                            const cpfs = Array.from(new Set(rows.map(r => r.cpf).filter(Boolean)))
                                                            if (confirm(`Mesclar e somar valores para ${cpfs.length} CPFs selecionados?`)) {
                                                                cpfs.forEach(cpf => handleMergeDuplicates(cpf!))
                                                                setSelectedErrorRows([])
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-purple-700 transition-colors"
                                                    >
                                                        <RotateCcw className="h-3 w-3" /> Consolidar Selecionados
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {errorGroups[activeErrorTab].map((row, idx) => {
                                        const rowId = `${row.sheet}::${row.cpf || (row as any).nome}`
                                        const isSelected = selectedErrorRows.includes(rowId)
                                        
                                        // Configurações de estilo por tipo de aba
                                        const tabStyles: Record<string, { border: string, bg: string, text: string, icon: any }> = {
                                            unregistered: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", icon: UserPlus },
                                            invalidCpfs: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700", icon: ShieldCheck },
                                            duplicates: { border: "border-l-purple-500", bg: "bg-purple-50", text: "text-purple-700", icon: RotateCcw },
                                            nameMismatches: { border: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-700", icon: Info },
                                            valueMismatches: { border: "border-l-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", icon: Receipt },
                                            extras: { border: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-700", icon: AlertCircle }
                                        }
                                        const style = tabStyles[activeErrorTab] || tabStyles.unregistered

                                        return (
                                            <div 
                                                key={idx}
                                                className={cn(
                                                    "flex items-center gap-4 p-4 rounded-xl bg-white border border-l-4 transition-all hover:shadow-md hover:translate-x-1 group relative",
                                                    style.border,
                                                    isSelected ? "border-blue-400 ring-4 ring-blue-50 bg-blue-50/30" : "border-slate-100 shadow-sm"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="checkbox" 
                                                        className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedErrorRows(prev => [...prev, rowId])
                                                            else setSelectedErrorRows(prev => prev.filter(id => id !== rowId))
                                                        }}
                                                    />
                                                    
                                                    {/* Avatar / Iniciais */}
                                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-inner", style.bg, style.text)}>
                                                        {getInitials(row.nome)}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-extrabold text-slate-800 text-sm truncate uppercase tracking-tight">{row.nome}</p>
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                                                            <FileSpreadsheet className="h-2.5 w-2.5" />
                                                            {row.sheet}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 mt-1 underline-offset-2">
                                                        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                            <Hash className="h-2.5 w-2.5" />
                                                            {fmtCpf(row.cpf || "")}
                                                        </div>
                                                        
                                                        {/* Alertas de Divergência integrados */}
                                                        {activeErrorTab === "nameMismatches" && (
                                                            <div className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 font-bold animate-in fade-in slide-in-from-left-1">
                                                                <Info className="h-2.5 w-2.5" />
                                                                SISTEMA: {(row as FoundRow).dbName}
                                                            </div>
                                                        )}
                                                        {activeErrorTab === "duplicates" && (
                                                            <div className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100 font-bold">
                                                                <RotateCcw className="h-2.5 w-2.5" />
                                                                {duplicateCpfSet.has(`${row.sheet}::${row.cpf}`) ? "DUPLICADO NESTA ABA" : "DUPLICADO ENTRE ABAS"}
                                                            </div>
                                                        )}
                                                        {activeErrorTab === "valueMismatches" && (
                                                            <div className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold underline decoration-dotted">
                                                                <Receipt className="h-2.5 w-2.5" />
                                                                SISTEMA: {fmtBRL((row as FoundRow).dbSalary || 0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-slate-800 tabular-nums">{fmtBRL(row.valor)}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-60">Valor Planilha</p>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4 py-1">
                                                        {activeErrorTab === "nameMismatches" && (
                                                            <button 
                                                                onClick={() => handleReconcileName(row as FoundRow)}
                                                                className="h-8 px-3 rounded-lg flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-[9px] uppercase tracking-wider shadow-sm hover:shadow-blue-200"
                                                            >
                                                                <CheckCircle2 className="h-3 w-3" /> Conciliar
                                                            </button>
                                                        )}
                                                        {activeErrorTab === "duplicates" && (
                                                            <button 
                                                                onClick={() => handleMergeDuplicates(row.cpf!)}
                                                                className="h-8 px-3 rounded-lg flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700 transition-all font-black text-[9px] uppercase tracking-wider shadow-sm hover:shadow-purple-200"
                                                            >
                                                                <RotateCcw className="h-3 w-3" /> Consolidar
                                                            </button>
                                                        )}
                                                        {activeErrorTab === "valueMismatches" && (
                                                            <button 
                                                                onClick={() => handleReconcileSalary(row as FoundRow)}
                                                                className="h-8 px-3 rounded-lg flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-black text-[9px] uppercase tracking-wider shadow-sm hover:shadow-emerald-200"
                                                            >
                                                                <CheckCircle2 className="h-3 w-3" /> Conciliar
                                                            </button>
                                                        )}
                                                        
                                                        <button 
                                                            onClick={() => handleDeleteRow(row)}
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent transition-all"
                                                            title="Excluir Registro"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="px-8 py-4 bg-white border-t flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setIsErrorCorrectionOpen(false)} className="rounded-xl px-6">Fechar</Button>
                                {activeErrorTab === "unregistered" && errorGroups.unregistered.length > 0 && (
                                    <Button 
                                        onClick={handleRegisterAll}
                                        disabled={registering}
                                        className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-6 gap-2"
                                    >
                                        {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                        Cadastrar Todos ({errorGroups.unregistered.length})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
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
