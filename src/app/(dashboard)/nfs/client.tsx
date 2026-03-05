"use client"

import { useState, useRef, useCallback } from "react"
import {
  FileText, Upload, List, CheckCircle2, XCircle,
  Clock, Search, Trash2, ChevronDown, Eye, FileUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createNotaFiscal, updateNotaFiscalStatus, deleteNotaFiscal,
  extractNfData,
  type NfStatus,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(n: number | string) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR")
}

const STATUS_CONFIG: Record<NfStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDENTE: { label: "Pendente", icon: <Clock className="h-3 w-3" />, cls: "bg-amber-100 text-amber-700" },
  ANALISADA: { label: "Analisada", icon: <Eye className="h-3 w-3" />, cls: "bg-blue-100 text-blue-700" },
  APROVADA: { label: "Aprovada", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-100 text-emerald-700" },
  REJEITADA: { label: "Rejeitada", icon: <XCircle className="h-3 w-3" />, cls: "bg-red-100 text-red-700" },
}

function StatusBadge({ status }: { status: NfStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NfsClient({ initialNfs }: { initialNfs: NF[] }) {
  const [tab, setTab] = useState<"receber" | "lista">("receber")
  const [nfs, setNfs] = useState<NF[]>(initialNfs)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<NfStatus | "">("")
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [form, setForm] = useState({ numero: "", emitente: "", valor: "", dataEmissao: "", descricao: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── PDF drag & drop ────────────────────────────────────────────────────────

  async function handlePdfFile(file: File) {
    if (file.type !== "application/pdf") { alert("Envie apenas arquivos PDF."); return }
    setPdfFile(file)

    setIsExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const data = await extractNfData(fd)

      setForm({
        numero: data.numero || "",
        emitente: data.emitente || "",
        valor: data.valor?.toString() || "",
        dataEmissao: data.dataEmissao || "",
        descricao: data.descricao || ""
      })
    } catch (err: any) {
      alert("Erro ao extrair dados: " + err.message)
    } finally {
      setIsExtracting(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handlePdfFile(f)
  }, [])

  // ── Submit NF ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero || !form.emitente || !form.valor || !form.dataEmissao) {
      alert("Preencha todos os campos obrigatórios."); return
    }
    setIsSaving(true)
    try {
      const nf = await createNotaFiscal({
        numero: form.numero,
        emitente: form.emitente,
        valor: parseFloat(form.valor.replace(",", ".")),
        dataEmissao: form.dataEmissao,
        descricao: form.descricao || undefined,
      })
      setNfs(prev => [nf as unknown as NF, ...prev])
      setForm({ numero: "", emitente: "", valor: "", dataEmissao: "", descricao: "" })
      setPdfFile(null)
      setTab("lista")
    } catch (err: any) {
      alert("Erro ao salvar NF: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Status update ─────────────────────────────────────────────────────────

  async function handleStatus(id: string, status: NfStatus) {
    await updateNotaFiscalStatus(id, status)
    setNfs(prev => prev.map(n => n.id === id ? { ...n, status } : n))
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta nota fiscal?")) return
    await deleteNotaFiscal(id)
    setNfs(prev => prev.filter(n => n.id !== id))
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = nfs.filter(n => {
    const q = search.toLowerCase()
    const matchSearch = !q || n.numero.toLowerCase().includes(q) || n.emitente.toLowerCase().includes(q)
    const matchStatus = !filterStatus || n.status === filterStatus
    return matchSearch && matchStatus
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Notas Fiscais</h2>
        <p className="text-sm text-slate-500">Receba e gerencie documentos fiscais</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setTab("receber")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "receber" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Upload className="h-4 w-4" /> Receber NF
        </button>
        <button
          onClick={() => setTab("lista")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "lista" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <List className="h-4 w-4" /> Notas Analisadas
          {nfs.length > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{nfs.length}</span>
          )}
        </button>
      </div>

      {/* ── TAB: RECEBER NF ─────────────────────────────────────────────── */}
      {tab === "receber" && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* PDF Upload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" /> Documento PDF
            </h3>

            {!pdfFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
                />
                <FileUp className={`mb-3 h-10 w-10 ${isDragging ? "text-blue-500" : "text-slate-300"}`} />
                <p className="text-sm font-medium text-slate-600">{isDragging ? "Solte o PDF aqui" : "Arraste ou clique para selecionar"}</p>
                <p className="mt-1 text-xs text-slate-400">Apenas arquivos .pdf</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{pdfFile.name}</p>
                      <p className="text-xs text-slate-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => setPdfFile(null)} className="text-slate-400 hover:text-red-500">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                {isExtracting && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 border border-slate-100 rounded-xl bg-slate-50/50">
                    <Clock className="h-8 w-8 text-blue-500 animate-pulse" />
                    <p className="text-sm font-medium text-slate-600">Extraindo dados com IA...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Dados da Nota Fiscal</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Número NF <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Ex: NF-0001"
                    value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Emissão <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.dataEmissao}
                    onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Emitente <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Nome ou CNPJ do emitente"
                  value={form.emitente}
                  onChange={e => setForm(f => ({ ...f, emitente: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$) <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição / Observação</Label>
                <textarea
                  placeholder="Descrição do serviço ou produto..."
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <Button type="submit" disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                {isSaving ? "Salvando..." : <><Upload className="h-4 w-4" /> Registrar Nota Fiscal</>}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB: LISTA ──────────────────────────────────────────────────── */}
      {tab === "lista" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por número ou emitente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as NfStatus | "")}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ANALISADA">Analisada</option>
              <option value="APROVADA">Aprovada</option>
              <option value="REJEITADA">Rejeitada</option>
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhuma nota fiscal encontrada</p>
                <button onClick={() => setTab("receber")} className="mt-3 text-sm text-blue-600 hover:underline font-medium">
                  Registrar primeira NF
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Número</th>
                    <th className="px-5 py-3">Emitente</th>
                    <th className="px-5 py-3">Emissão</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Alterar Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(nf => (
                    <tr key={nf.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-800">{nf.numero}</td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-[180px] truncate">{nf.emitente}</td>
                      <td className="px-5 py-3.5 text-slate-500">{fmtDate(nf.dataEmissao)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-800">{fmtBRL(nf.valor)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={nf.status} /></td>
                      <td className="px-5 py-3.5">
                        <div className="relative inline-block">
                          <select
                            value={nf.status}
                            onChange={e => handleStatus(nf.id, e.target.value as NfStatus)}
                            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="PENDENTE">Pendente</option>
                            <option value="ANALISADA">Analisada</option>
                            <option value="APROVADA">Aprovada</option>
                            <option value="REJEITADA">Rejeitada</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleDelete(nf.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <p className="text-xs text-slate-400 text-right">{filtered.length} nota{filtered.length > 1 ? "s" : ""} encontrada{filtered.length > 1 ? "s" : ""}</p>
          )}
        </div>
      )}
    </div>
  )
}
