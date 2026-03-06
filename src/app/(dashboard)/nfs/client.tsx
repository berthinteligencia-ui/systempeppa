"use client"

import { useState, useRef } from "react"
import {
  FileText, Upload, XCircle, Clock, Search, Trash2,
  FileUp, CloudUpload, ChevronLeft, ChevronRight,
  TrendingUp, AlertCircle, Receipt, SlidersHorizontal, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createNotaFiscal, updateNotaFiscalStatus, deleteNotaFiscal,
  extractNfData, type NfStatus,
} from "@/lib/actions/nfs"

// ── Types ─────────────────────────────────────────────────────────────────────

type NF = {
  id: string
  numero: string
  emitente: string
  valor: number | string
  dataEmissao: Date | string
  descricao: string | null
  status: NfStatus
  createdAt: Date | string
}

type Dept = { id: string; name: string; cnpj: string | null }

type Form = {
  numero: string
  departmentId: string
  valor: string
  dataEmissao: string
}

type TabFilter = "todas" | "pendentes" | "processadas"

const FORM_EMPTY: Form = { numero: "", departmentId: "", valor: "", dataEmissao: "" }
const PER_PAGE = 5

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function fmtDateBR(d: Date | string) {
  const dt = new Date(d)
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`
}

function fmtBRL(n: number | string) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function splitEmitente(emitente: string) {
  const idx = emitente.indexOf(" - ")
  if (idx === -1) return { tomador: emitente, cnpj: "" }
  return { tomador: emitente.slice(0, idx), cnpj: emitente.slice(idx + 3) }
}

const STATUS_MAP: Record<NfStatus, { label: string; cls: string; dot: string }> = {
  PENDENTE:  { label: "Pendente", cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  ANALISADA: { label: "Paga",     cls: "bg-green-50 text-green-700 border border-green-200", dot: "bg-green-500" },
  APROVADA:  { label: "Paga",     cls: "bg-green-50 text-green-700 border border-green-200", dot: "bg-green-500" },
  REJEITADA: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
}

function StatusBadge({ status }: { status: NfStatus }) {
  const s = STATUS_MAP[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NfsClient({ initialNfs, departments }: { initialNfs: NF[]; departments: Dept[] }) {
  const [nfs, setNfs]               = useState<NF[]>(initialNfs)
  const [tabFilter, setTabFilter]   = useState<TabFilter>("todas")
  const [search, setSearch]         = useState("")
  const [page, setPage]             = useState(1)
  const [isSaving, setIsSaving]     = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [pdfFile, setPdfFile]       = useState<File | null>(null)
  const [form, setForm]             = useState<Form>(FORM_EMPTY)
  const [cnpjWarning, setCnpjWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedDept = departments.find(d => d.id === form.departmentId) ?? null

  // ── PDF upload ─────────────────────────────────────────────────────────────

  async function handlePdfFile(file: File) {
    if (file.type !== "application/pdf") { alert("Envie apenas arquivos PDF."); return }
    setPdfFile(file)
    setIsExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const data = await extractNfData(fd)

      // Tenta encontrar a unidade pelo CNPJ extraído
      const cnpjExtracted = (data.cnpj || "").replace(/\D/g, "")
      const matchedDept = cnpjExtracted
        ? departments.find(d => (d.cnpj ?? "").replace(/\D/g, "") === cnpjExtracted)
        : undefined

      setForm(f => ({
        ...f,
        numero:      data.numero      || "",
        valor:       data.valor?.toString() || "",
        dataEmissao: data.dataEmissao || "",
        departmentId: matchedDept ? matchedDept.id : f.departmentId,
      }))

      if (cnpjExtracted && !matchedDept) {
        setCnpjWarning(`CNPJ ${data.cnpj} não corresponde a nenhuma unidade cadastrada. Selecione manualmente.`)
      } else {
        setCnpjWarning(null)
      }
    } catch (err: any) {
      alert("Erro ao extrair dados: " + err.message)
    } finally {
      setIsExtracting(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero || !form.departmentId || !form.valor || !form.dataEmissao) {
      alert("Preencha todos os campos obrigatórios."); return
    }
    const dept = departments.find(d => d.id === form.departmentId)!
    setIsSaving(true)
    try {
      const emitente = dept.cnpj ? `${dept.name} - ${dept.cnpj}` : dept.name
      const nf = await createNotaFiscal({
        numero:      form.numero,
        emitente,
        valor:       parseFloat(form.valor.replace(",", ".")),
        dataEmissao: form.dataEmissao,
      })
      setNfs(prev => [nf as unknown as NF, ...prev])
      setForm(FORM_EMPTY)
      setPdfFile(null)
      setCnpjWarning(null)
    } catch (err: any) {
      alert("Erro ao salvar NF: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Status / Delete ────────────────────────────────────────────────────────

  async function handleStatus(id: string, status: NfStatus) {
    await updateNotaFiscalStatus(id, status)
    setNfs(prev => prev.map(n => n.id === id ? { ...n, status } : n))
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta nota fiscal?")) return
    await deleteNotaFiscal(id)
    setNfs(prev => prev.filter(n => n.id !== id))
  }

  // ── Filter + Pagination ───────────────────────────────────────────────────

  const filtered = nfs
    .filter(n => {
      if (tabFilter === "pendentes")   return n.status === "PENDENTE"
      if (tabFilter === "processadas") return n.status === "APROVADA" || n.status === "ANALISADA"
      return true
    })
    .filter(n => {
      const q = search.toLowerCase()
      return !q || n.numero.toLowerCase().includes(q) || n.emitente.toLowerCase().includes(q)
    })

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const curPage     = Math.min(page, totalPages)
  const paginated   = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)

  // ── Summaries ─────────────────────────────────────────────────────────────

  const totalProcessado = nfs.filter(n => n.status === "APROVADA" || n.status === "ANALISADA").reduce((a, n) => a + Number(n.valor), 0)
  const totalPendente   = nfs.filter(n => n.status === "PENDENTE").reduce((a, n) => a + Number(n.valor), 0)
  const totalImpostos   = nfs.reduce((a, n) => a + Number(n.valor), 0)
  const pendentesCount  = nfs.filter(n => n.status === "PENDENTE").length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">

      {/* ── COLUNA ESQUERDA ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden self-start">

        {/* Header do card */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
          <div className="rounded-lg bg-slate-100 p-1.5">
            <FileText className="h-4 w-4 text-slate-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Registrar Nova NF-e</h3>
        </div>

        <div className="p-6 space-y-5">

          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
          />

          {!pdfFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-7 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
            >
              <div className="rounded-full bg-white p-3 shadow-sm border border-slate-100">
                <CloudUpload className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Upload de PDF / XML</p>
                <p className="text-xs text-slate-400 mt-0.5">Arraste a nota aqui ou clique para buscar</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{pdfFile.name}</p>
                  <p className="text-xs text-slate-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              {isExtracting ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
                  <span className="text-xs text-slate-500">Extraindo...</span>
                </div>
              ) : (
                <button onClick={() => { setPdfFile(null); setForm(FORM_EMPTY); setCnpjWarning(null) }} className="shrink-0 text-slate-400 hover:text-red-500">
                  <XCircle className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Número da NF</label>
                <Input placeholder="000.000" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Data de Emissão</label>
                <Input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Unidade <span className="text-red-400">*</span></label>
              <select
                value={form.departmentId}
                onChange={e => { setForm(f => ({ ...f, departmentId: e.target.value })); setCnpjWarning(null) }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecione a unidade...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* CNPJ da unidade selecionada */}
            {selectedDept && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">CNPJ:</span>
                <span className="text-sm text-slate-600">{selectedDept.cnpj || <span className="text-slate-300 italic">não cadastrado</span>}</span>
              </div>
            )}

            {/* Aviso de CNPJ divergente */}
            {cnpjWarning && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-700">{cnpjWarning}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Valor Retido (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                <Input
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            <Button type="submit" disabled={isSaving} className="w-full gap-2 bg-slate-900 hover:bg-slate-800">
              {isSaving ? "Salvando..." : <><Upload className="h-4 w-4" /> Salvar Nota Fiscal</>}
            </Button>
          </form>

          {/* Dica */}
          <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Dica de Produtividade</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Você pode importar arquivos PDF para preenchimento automático clicando no ícone de upload acima.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── COLUNA DIREITA ───────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Header + filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800">Notas Registradas</h3>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {nfs.length} total
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab filters */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              {(["todas", "pendentes", "processadas"] as TabFilter[]).map((t, i, arr) => (
                <button
                  key={t}
                  onClick={() => { setTabFilter(t); setPage(1) }}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${i < arr.length - 1 ? "border-r border-slate-200" : ""} ${tabFilter === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                placeholder="Buscar..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-36 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileText className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhuma nota fiscal encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Número NF</th>
                      <th className="px-5 py-3">Unidade</th>
                      <th className="px-5 py-3">Valor</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map(nf => {
                      const { tomador, cnpj } = splitEmitente(nf.emitente)
                      return (
                        <tr key={nf.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-blue-600">#{nf.numero}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-slate-800">{tomador}</p>
                            {cnpj && <p className="mt-0.5 text-xs text-slate-400">{cnpj}</p>}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-800">
                            {fmtBRL(nf.valor)}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={nf.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStatus(nf.id, nf.status === "APROVADA" || nf.status === "ANALISADA" ? "PENDENTE" : "APROVADA")}
                                title={nf.status === "APROVADA" || nf.status === "ANALISADA" ? "Marcar como Pendente" : "Marcar como Paga"}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                  nf.status === "APROVADA" || nf.status === "ANALISADA"
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {nf.status === "APROVADA" || nf.status === "ANALISADA" ? "Paga" : "Pagar"}
                              </button>
                              <button
                                onClick={() => handleDelete(nf.id)}
                                title="Excluir"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">
                  Mostrando {Math.min((curPage - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(curPage * PER_PAGE, filtered.length)} de {filtered.length} registros
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={curPage === 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[28px] rounded-lg border px-2 py-1 text-xs font-medium ${curPage === p ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={curPage === totalPages}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Processado</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{fmtBRL(totalProcessado)}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
              <TrendingUp className="h-3 w-3" /> Notas aprovadas
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pendentes</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{fmtBRL(totalPendente)}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3" /> {pendentesCount} nota{pendentesCount !== 1 ? "s" : ""} aguardando
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Impostos Retidos</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{fmtBRL(totalImpostos)}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
              <Receipt className="h-3 w-3" /> Acumulado do período
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
