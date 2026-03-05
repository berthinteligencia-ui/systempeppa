"use client"

import { useState, useRef, useCallback } from "react"
import {
  UserPlus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Filter,
  CheckSquare, Square, Download, FileDown, FileUp, Loader2, X, FileSpreadsheet,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  createEmployee, updateEmployee, deleteEmployee,
  deleteEmployeesBatch, importEmployees,
} from "@/lib/actions/employees"

// ─── Types ────────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Employee = {
  id: string; name: string; cpf: string | null; email: string | null
  phone: string | null; position: string; salary: number | string
  hireDate: Date; status: string; departmentId: string | null
  department: Department | null
}

type ImportRow = {
  name: string; cpf?: string; phone?: string; email?: string
  position?: string; salary?: number; departmentId?: string; _deptName?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusMap = {
  ACTIVE: { label: "Ativo", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
  INACTIVE: { label: "Inativo", icon: AlertCircle, cls: "bg-red-100 text-red-700" },
  ON_LEAVE: { label: "Afastado", icon: Clock, cls: "bg-amber-100 text-amber-700" },
}

const empty = {
  name: "", position: "", salary: "", hireDate: "", departmentId: "",
  cpf: "", email: "", phone: "", status: "ACTIVE",
}

function fmtBRL(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function fmtCpf(c: string | null) {
  if (!c || c.length !== 11) return c ?? "—"
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}
function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("pt-BR")
}
function fmtPhone(p: string | null) {
  if (!p) return "—"
  const d = p.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}

// Column detection for import
const NAME_COLS = ["nome", "name", "funcionario", "funcionário", "colaborador", "empregado"]
const CPF_COLS = ["cpf", "doc", "documento", "cpf/cnpj", "registro", "matricula", "matrícula"]
const PHONE_COLS = ["telefone", "fone", "celular", "cel", "phone", "whatsapp", "zap"]
const EMAIL_COLS = ["email", "e-mail", "mail", "correio"]
const POSITION_COLS = ["cargo", "position", "funcao", "função", "ocupacao", "ocupação", "atividade"]
const SALARY_COLS = ["salario", "salário", "salary", "remuneracao", "remuneração", "vencimento", "pagamento", "valor"]
const DEPT_COLS = ["unidade", "departamento", "setor", "department", "dept", "lotacao", "lotação"]

function matchCol(header: string, candidates: string[]) {
  const h = header.toLowerCase().trim().replace(/\s+/g, " ")
  return candidates.some((c) => h === c || h.includes(c))
}

function detectImportCols(headers: string[]) {
  const find = (c: string[]) => headers.findIndex((h) => matchCol(h, c))
  return {
    nameIdx: find(NAME_COLS),
    cpfIdx: find(CPF_COLS),
    phoneIdx: find(PHONE_COLS),
    emailIdx: find(EMAIL_COLS),
    positionIdx: find(POSITION_COLS),
    salaryIdx: find(SALARY_COLS),
    deptIdx: find(DEPT_COLS),
  }
}

function parseImportRows(rawRows: Record<string, unknown>[], headers: string[], departments: Department[]): ImportRow[] {
  const { nameIdx, cpfIdx, phoneIdx, emailIdx, positionIdx, salaryIdx, deptIdx } = detectImportCols(headers)
  if (nameIdx === -1) return []

  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase().trim(), d.id]))

  return rawRows
    .map((r) => {
      const name = String(r[headers[nameIdx]] ?? "").trim()
      if (!name) return null

      const cpfRaw = cpfIdx !== -1 ? String(r[headers[cpfIdx]] ?? "").replace(/\D/g, "") : ""
      const cpf = cpfRaw.length >= 11 ? cpfRaw.slice(0, 11).padStart(11, "0") : undefined

      const phone = phoneIdx !== -1
        ? String(r[headers[phoneIdx]] ?? "").replace(/\D/g, "").slice(0, 20) || undefined
        : undefined

      const email = emailIdx !== -1
        ? String(r[headers[emailIdx]] ?? "").trim().toLowerCase() || undefined
        : undefined

      const position = positionIdx !== -1
        ? String(r[headers[positionIdx]] ?? "").trim() || undefined
        : undefined

      const salaryRaw = salaryIdx !== -1
        ? parseFloat(String(r[headers[salaryIdx]] ?? "0").replace(/[^\d,.-]/g, "").replace(",", "."))
        : 0
      const salary = isNaN(salaryRaw) ? 0 : salaryRaw

      let departmentId: string | undefined
      let _deptName: string | undefined
      if (deptIdx !== -1) {
        const dName = String(r[headers[deptIdx]] ?? "").trim()
        if (dName) {
          _deptName = dName
          departmentId = deptByName.get(dName.toLowerCase()) ?? undefined
        }
      }

      return { name, cpf, phone, email, position, salary, departmentId, _deptName }
    })
    .filter(Boolean) as ImportRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FuncionariosClient({
  employees, departments,
}: { employees: Employee[]; departments: Department[] }) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [filterDept, setFilterDept] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filteredEmployees = employees.filter((emp) => {
    if (filterDept !== "all" && emp.departmentId !== filterDept) return false
    return true
  })

  // ── Selection ────────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e) => e.id)))
    }
  }

  // ── Form CRUD ─────────────────────────────────────────────────────────────────

  function openCreate() { setEditing(null); setForm(empty); setOpen(true) }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      name: emp.name,
      position: emp.position,
      salary: String(emp.salary),
      hireDate: new Date(emp.hireDate).toISOString().split("T")[0],
      departmentId: emp.departmentId ?? "",
      cpf: emp.cpf ?? "",
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      status: emp.status,
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        name: form.name,
        position: form.position.trim() || "A definir",
        salary: parseFloat(form.salary),
        hireDate: form.hireDate || new Date().toISOString().split("T")[0],
        departmentId: form.departmentId || undefined,
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      }
      if (editing) {
        await updateEmployee(editing.id, { ...data, status: form.status })
      } else {
        await createEmployee(data)
      }
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setLoading(true)
    try { await deleteEmployee(deleteId) } finally {
      setDeleteId(null); setLoading(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setLoading(true)
    try {
      await deleteEmployeesBatch(Array.from(selectedIds))
      setSelectedIds(new Set()); setBulkDeleteOpen(false)
    } finally { setLoading(false) }
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  // ── Export PDF ────────────────────────────────────────────────────────────────

  function handleExportPDF() {
    const rows = filteredEmployees
    const win = window.open("", "_blank")!
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Funcionários</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 11px; color: #64748b; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
       padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 10px; font-weight: 600; }
  .ACTIVE  { background:#d1fae5; color:#065f46; }
  .INACTIVE{ background:#fee2e2; color:#991b1b; }
  .ON_LEAVE{ background:#fef3c7; color:#92400e; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Relatório de Funcionários</h1>
<p class="sub">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · ${rows.length} funcionário${rows.length !== 1 ? "s" : ""}${filterDept !== "all" ? ` · ${departments.find(d => d.id === filterDept)?.name ?? ""}` : ""}</p>
<table>
<thead><tr>
  <th>#</th><th>Nome</th><th>CPF</th><th>Cargo</th><th>Unidade</th><th>Telefone</th><th>Salário</th><th>Status</th>
</tr></thead>
<tbody>
${rows.map((emp, i) => `<tr>
  <td>${i + 1}</td>
  <td>${emp.name}</td>
  <td>${fmtCpf(emp.cpf)}</td>
  <td>${emp.position}</td>
  <td>${emp.department?.name ?? "—"}</td>
  <td>${fmtPhone(emp.phone)}</td>
  <td>${fmtBRL(Number(emp.salary))}</td>
  <td><span class="badge ${emp.status}">${statusMap[emp.status as keyof typeof statusMap]?.label ?? emp.status}</span></td>
</tr>`).join("")}
</tbody></table>
</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  // ── Export Excel ──────────────────────────────────────────────────────────────

  function handleExportExcel() {
    const data = filteredEmployees.map((emp) => ({
      "Nome": emp.name,
      "CPF": fmtCpf(emp.cpf),
      "Cargo": emp.position,
      "Unidade": emp.department?.name ?? "",
      "E-mail": emp.email ?? "",
      "Telefone": fmtPhone(emp.phone),
      "Salário": Number(emp.salary),
      "Data Admissão": fmtDate(emp.hireDate),
      "Status": statusMap[emp.status as keyof typeof statusMap]?.label ?? emp.status,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [{ wch: 35 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `funcionarios-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Download template ─────────────────────────────────────────────────────────

  function handleDownloadTemplate() {
    const template = [
      {
        "Nome": "João da Silva",
        "CPF": "000.000.000-00",
        "Cargo": "Auxiliar Administrativo",
        "E-mail": "joao@empresa.com",
        "Telefone": "(11) 99999-9999",
        "Salário": 2000,
        "Data Admissão": "01/01/2024",
        "Unidade/Departamento": "Administrativo",
      },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    ws["!cols"] = [{ wch: 35 }, { wch: 16 }, { wch: 25 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 25 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "modelo-funcionarios.xlsx"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  function handleImportFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      alert("Envie apenas arquivos Excel (.xlsx, .xls) ou CSV.")
      return
    }
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: "binary" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
      if (!rawRows.length) { alert("Planilha vazia."); return }
      const headers = Object.keys(rawRows[0])
      setImportHeaders(headers)
      setImportRows(parseImportRows(rawRows, headers, departments))
    }
    reader.readAsBinaryString(file)
  }

  const onImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleImportFile(f)
  }, [departments])

  async function handleConfirmImport() {
    if (!importRows.length) return
    setIsImporting(true)
    try {
      const result = await importEmployees(importRows.map(({ _deptName: _, ...r }) => r))
      alert(`${result.imported} funcionário${result.imported !== 1 ? "s" : ""} importado${result.imported !== 1 ? "s" : ""} com sucesso!`)
      setImportOpen(false)
      setImportFile(null)
      setImportRows([])
    } catch (err: any) {
      alert("Erro ao importar: " + err.message)
    } finally {
      setIsImporting(false)
    }
  }

  function openImport() {
    setImportFile(null); setImportRows([]); setImportHeaders([])
    setImportOpen(true)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Funcionários</h2>
          <p className="text-sm text-slate-500">Cadastro e gerenciamento de colaboradores</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" /> Excluir ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF} className="gap-2">
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Baixar Modelo
          </Button>
          <Button variant="outline" onClick={openImport} className="gap-2">
            <FileUp className="h-4 w-4" /> Importar
          </Button>
          <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4" /> Novo Funcionário
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 py-2">
        <div className="w-full max-w-xs">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="bg-white">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Filtrar por unidade" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-slate-400">{filteredEmployees.length} funcionário{filteredEmployees.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center">
                    {selectedIds.size > 0 && selectedIds.size === filteredEmployees.length
                      ? <CheckSquare className="h-4 w-4 text-blue-600" />
                      : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-5 py-3">Nome / CPF</th>
                <th className="px-5 py-3">Cargo</th>
                <th className="px-5 py-3">Unidade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Salário</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              )}
              {filteredEmployees.map((emp) => {
                const s = statusMap[emp.status as keyof typeof statusMap] ?? statusMap.ACTIVE
                const Icon = s.icon
                const isSelected = selectedIds.has(emp.id)
                return (
                  <tr key={emp.id} className={`hover:bg-slate-50 ${isSelected ? "bg-blue-50/30" : ""}`}>
                    <td className="px-5 py-3.5">
                      <button onClick={() => toggleSelect(emp.id)} className="flex items-center">
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-blue-600" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{fmtCpf(emp.cpf)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{emp.position}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{emp.department?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-800">
                      {fmtBRL(Number(emp.salary))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(emp)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(emp.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
      </div>

      {/* ── Form Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={form.position} onChange={(e) => set("position", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Salário (R$) *</Label>
                <Input type="number" step="0.01" value={form.salary} onChange={(e) => set("salary", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Data de admissão</Label>
                <Input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="INACTIVE">Inativo</SelectItem>
                      <SelectItem value="ON_LEAVE">Afastado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-600" /> Importar Funcionários
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop zone */}
            {!importFile ? (
              <div
                onDrop={onImportDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => importInputRef.current?.click()}
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"}`}
              >
                <input
                  ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }}
                />
                <FileSpreadsheet className={`mb-2 h-8 w-8 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
                <p className="text-sm font-medium text-slate-600">{isDragging ? "Solte o arquivo aqui" : "Arraste ou clique para selecionar"}</p>
                <p className="mt-1 text-xs text-slate-400">.xlsx · .xls · .csv</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-slate-800">{importFile.name}</p>
                  <p className="text-xs text-slate-400">{importRows.length} registro{importRows.length !== 1 ? "s" : ""} detectado{importRows.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => { setImportFile(null); setImportRows([]); setImportHeaders([]) }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Detected columns hint */}
            {importHeaders.length > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
                <span className="font-semibold">Colunas detectadas: </span>
                {importHeaders.join(" · ")}
              </div>
            )}

            {/* Preview table */}
            {importRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-left">
                        <th className="px-4 py-2.5">Nome</th>
                        <th className="px-4 py-2.5">CPF</th>
                        <th className="px-4 py-2.5">Cargo</th>
                        <th className="px-4 py-2.5">Unidade</th>
                        <th className="px-4 py-2.5">Telefone</th>
                        <th className="px-4 py-2.5 text-right">Salário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{fmtCpf(r.cpf ?? null)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{r.position ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {r._deptName ? (
                              r.departmentId
                                ? <span className="text-slate-600">{r._deptName}</span>
                                : <span className="text-amber-600 text-xs">{r._deptName} (não encontrado)</span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{r.phone ? fmtPhone(r.phone) : "—"}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmtBRL(r.salary ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importRows.length === 0 && importFile && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Nenhum funcionário detectado. Certifique-se de que a planilha tem uma coluna &quot;Nome&quot; com os nomes dos colaboradores.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importRows.length === 0 || isImporting}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                <><FileUp className="h-4 w-4" /> Importar {importRows.length} funcionário{importRows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Delete Confirm ── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionários?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedIds.size} funcionário{selectedIds.size > 1 ? "s" : ""}.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
              Excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
