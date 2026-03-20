"use client"

import { useState, useRef, useCallback } from "react"
import {
  UserPlus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Filter,
  CheckSquare, Square, Download, FileDown, FileUp, Loader2, X, FileSpreadsheet,
  Receipt, ChevronDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createEmployee, updateEmployee, deleteEmployee,
  deleteEmployeesBatch, importEmployees,
} from "@/lib/actions/employees"

// ─── Types ────────────────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Employee = {
  id: string; name: string; cpf: string | null; email: string | null
  phone: string | null; position: string; salary: number | string
  hireDate: Date; status: string; pagamento: string; departmentId: string | null
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

const pagamentoMap: Record<string, { label: string; cls: string }> = {
  pendente: { label: "PENDENTE", cls: "bg-slate-100 text-slate-600" },
  efetuado: { label: "EFETUADO", cls: "bg-emerald-600 text-white shadow-sm" },
  pago: { label: "PAGO", cls: "bg-emerald-100 text-emerald-700" },
  atrasado: { label: "ATRASADO", cls: "bg-red-100 text-red-700" },
}

const empty = {
  name: "", position: "", salary: "", hireDate: "", departmentId: "",
  cpf: "", email: "", phone: "", status: "ACTIVE", pagamento: "pendente",
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
const NAME_COLS = ["nome", "name", "funcionario", "funcionário", "colaborador", "empregado", "nome completo", "trabalhador"]
const CPF_COLS = ["cpf", "doc", "documento", "cpf/cnpj", "registro", "matricula", "matrícula", "identidade"]
const PHONE_COLS = ["telefone", "fone", "celular", "cel", "phone", "whatsapp", "zap", "contato"]
const EMAIL_COLS = ["email", "e-mail", "mail", "correio", "endereço eletrônico"]
const POSITION_COLS = ["cargo", "position", "funcao", "função", "ocupacao", "ocupação", "atividade", "setor/função"]
const SALARY_COLS = ["salario", "salário", "salary", "remuneracao", "remuneração", "vencimento", "pagamento", "valor", "base", "líquido", "bruto"]
const DEPT_COLS = ["unidade", "departamento", "setor", "department", "dept", "lotacao", "lotação", "filial", "estabelecimento"]

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
      const name = String(r[headers[nameIdx]] ?? "").trim().toUpperCase()
      if (!name) return null

      // Improved CPF cleaning: remove non-digits, take 11 digits
      const cpfRaw = cpfIdx !== -1 ? String(r[headers[cpfIdx]] ?? "").replace(/\D/g, "") : ""
      let cpf = undefined
      if (cpfRaw.length >= 11) {
        cpf = cpfRaw.slice(-11) // Take the last 11 digits in case of leading zeros or other garbage
      } else if (cpfRaw.length > 0) {
        cpf = cpfRaw.padStart(11, "0")
      }

      const phone = phoneIdx !== -1
        ? String(r[headers[phoneIdx]] ?? "").replace(/\D/g, "").slice(0, 20) || undefined
        : undefined

      const email = emailIdx !== -1
        ? String(r[headers[emailIdx]] ?? "").trim().toLowerCase() || undefined
        : undefined

      const position = positionIdx !== -1
        ? String(r[headers[positionIdx]] ?? "").trim().toUpperCase() || undefined
        : undefined

      // Improved salary parsing: handles BRL format (1.200,50) and simple dots (1200.50)
      const salaryStr = salaryIdx !== -1 ? String(r[headers[salaryIdx]] ?? "0") : "0"
      let salary = 0
      if (salaryStr) {
        const cleanSalary = salaryStr.replace(/[^\d,.-]/g, "")
        if (cleanSalary.includes(",") && cleanSalary.includes(".")) {
          // Likely 1.234,56
          salary = parseFloat(cleanSalary.replace(/\./g, "").replace(",", "."))
        } else if (cleanSalary.includes(",")) {
          // Likely 1234,56
          salary = parseFloat(cleanSalary.replace(",", "."))
        } else {
          salary = parseFloat(cleanSalary)
        }
      }
      salary = isNaN(salary) ? 0 : salary

      let departmentId: string | undefined
      let _deptName: string | undefined
      if (deptIdx !== -1) {
        const dName = String(r[headers[deptIdx]] ?? "").trim().toUpperCase()
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
  employees, departments, userRole,
}: { employees: Employee[]; departments: Department[]; userRole?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [filterDept, setFilterDept] = useState("all")
  const [filterPagamento, setFilterPagamento] = useState("all")
  const [filterStatus, setFilterStatus] = useState("ACTIVE")
  const [filterSearch, setFilterSearch] = useState("")
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
    const s = filterSearch.toLowerCase().trim()
    const matchesSearch = !s || 
      emp.name.toLowerCase().includes(s) || 
      (emp.cpf && emp.cpf.includes(s))
    
    const matchesDept = filterDept === "all" || emp.departmentId === filterDept
    const matchesPagamento = filterPagamento === "all" || (emp.pagamento && emp.pagamento.toLowerCase() === filterPagamento)
    const matchesStatus = filterStatus === "all" || emp.status === filterStatus

    return matchesSearch && matchesDept && matchesPagamento && matchesStatus
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
      pagamento: emp.pagamento || "pendente",
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        name: form.name.trim().toUpperCase(),
        position: form.position.trim().toUpperCase() || "A DEFINIR",
        salary: parseFloat(form.salary),
        hireDate: form.hireDate || new Date().toISOString().split("T")[0],
        departmentId: form.departmentId || undefined,
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      }
      if (editing) {
        await updateEmployee(editing.id, { ...data, status: form.status, pagamento: form.pagamento })
      } else {
        await createEmployee({ ...data, pagamento: form.pagamento })
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
  .pendente { background:#f1f5f9; color:#475569; }
  .efetuado { background:#059669; color:#ffffff; }
  .pago     { background:#d1fae5; color:#065f46; }
  .atrasado { background:#fee2e2; color:#991b1b; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Relatório de Funcionários</h1>
<p class="sub">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · ${rows.length} funcionário${rows.length !== 1 ? "s" : ""}${filterDept !== "all" ? ` · ${departments.find(d => d.id === filterDept)?.name ?? ""}` : ""}${filterPagamento !== "all" ? ` · Pagamento: ${pagamentoMap[filterPagamento]?.label ?? filterPagamento}` : ""}</p>
<table>
<thead><tr>
  <th>#</th><th>Nome</th><th>CPF</th><th>Cargo</th><th>Unidade</th><th>Telefone</th><th>Salário</th><th>Status</th><th>Pagamento</th>
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
  <td><span class="badge ${emp.pagamento}">${pagamentoMap[emp.pagamento]?.label ?? emp.pagamento}</span></td>
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
      "Pagamento": pagamentoMap[emp.pagamento]?.label ?? emp.pagamento,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [{ wch: 35 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários")
    const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([new Uint8Array(raw)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
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
    const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([new Uint8Array(raw)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
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
          {selectedIds.size > 0 && userRole?.toUpperCase() === "ADMIN" && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" /> Excluir ({selectedIds.size})
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ChevronDown className="h-4 w-4" /> Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileDown className="h-4 w-4 text-slate-500" />
                <span>Exportar PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                <span>Exportar Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate} className="gap-2 cursor-pointer">
                <Download className="h-4 w-4 text-slate-500" />
                <span>Baixar Modelo</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openImport} className="gap-2 cursor-pointer">
                <FileUp className="h-4 w-4 text-slate-500" />
                <span>Importar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4" /> Novo Funcionário
          </Button>
        </div>
      </div>

      {/* Filter & Selection */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors h-10 shadow-sm"
          >
            {selectedIds.size > 0 && selectedIds.size === filteredEmployees.length
              ? <CheckSquare className="h-4 w-4 text-blue-600" />
              : <Square className="h-4 w-4" />}
            <span className="hidden sm:inline">{selectedIds.size === filteredEmployees.length ? "Desvincular Tudo" : "Selecionar Tudo"}</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nome ou CPF..." 
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-9 bg-white h-10 border-slate-200"
            />
          </div>

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="bg-white min-w-[180px] h-10 border-slate-200">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPagamento} onValueChange={setFilterPagamento}>
            <SelectTrigger className="bg-white min-w-[150px] h-10 border-slate-200">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              <SelectItem value="pendente">PENDENTE</SelectItem>
              <SelectItem value="efetuado">EFETUADO</SelectItem>
              <SelectItem value="pago">PAGO</SelectItem>
              <SelectItem value="atrasado">ATRASADO</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="bg-white min-w-[150px] h-10 border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ACTIVE">ATIVOS</SelectItem>
              <SelectItem value="INACTIVE">INATIVOS</SelectItem>
              <SelectItem value="ON_LEAVE">AFASTADOS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <p className="text-sm text-slate-400 font-medium shrink-0">{filteredEmployees.length} funcionário{filteredEmployees.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Cards Grid */}
      <div className="mt-2">
        {filteredEmployees.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Nenhum funcionário</h3>
            <p className="mt-1 text-sm text-slate-500">Comece criando um novo funcionário ou importando uma lista.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEmployees.map((emp) => {
              const s = statusMap[emp.status as keyof typeof statusMap] ?? statusMap.ACTIVE
              const Icon = s.icon
              const isSelected = selectedIds.has(emp.id)
              
              return (
                <div
                  key={emp.id}
                  className={`group relative flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                    isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {emp.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500">{fmtCpf(emp.cpf)}</p>
                      </div>
                      
                      {/* Status & Selection Indicator */}
                      <div className="flex items-center gap-2 pt-0.5 shrink-0">
                        <button
                          title={s.label}
                          className={`h-4 w-4 rounded-full border-2 border-white shadow-md cursor-default ${
                            emp.status === 'ACTIVE' ? 'bg-emerald-500' : 
                            emp.status === 'INACTIVE' ? 'bg-red-500' : 
                            'bg-amber-500'
                          }`}
                        />
                        
                        <button
                          onClick={() => toggleSelect(emp.id)}
                          className={`rounded-full bg-white/80 p-0.5 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 flex-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Cargo</span>
                        <span className="font-semibold text-slate-700">{emp.position}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Unidade</span>
                        <span className="font-semibold text-slate-700">{emp.department?.name || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Pagamento</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${pagamentoMap[emp.pagamento?.toLowerCase()]?.cls ?? pagamentoMap.pendente.cls}`}>
                          {pagamentoMap[emp.pagamento?.toLowerCase()]?.label ?? emp.pagamento}
                        </span>
                      </div>


                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Salário</span>
                        <span className="text-lg font-black text-slate-900">{fmtBRL(Number(emp.salary))}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => router.push(`/comprovante?cpf=${emp.cpf || ""}`)}
                          title="Ver Comprovantes"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Receipt className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(emp)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {userRole?.toUpperCase() === "ADMIN" && (
                        <button
                          onClick={() => setDeleteId(emp.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
              <div className="space-y-1.5">
                <Label>Situação de Pagamento</Label>
                <Select value={form.pagamento} onValueChange={(v) => set("pagamento", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">PENDENTE</SelectItem>
                    <SelectItem value="efetuado">EFETUADO</SelectItem>
                    <SelectItem value="pago">PAGO</SelectItem>
                    <SelectItem value="atrasado">ATRASADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 shrink-0">
            <div className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <FileUp className="h-6 w-6 text-blue-600" /> IMPORTAR FUNCIONÁRIOS
              </DialogTitle>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                VALIDE OS DADOS E SELECIONE AS UNIDADES ANTES DE CONFIRMAR.
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
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
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4 shadow-sm transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-bold text-slate-800">{importFile.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{importRows.length} registro{importRows.length !== 1 ? "s" : ""} detectado{importRows.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => { setImportFile(null); setImportRows([]); setImportHeaders([]) }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Detected columns hint */}
            {importHeaders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Colunas Detectadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {importHeaders.map((h, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {importRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                      <tr className="border-b text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
                        <th className="px-4 py-3">NOME / CARGO</th>
                        <th className="px-4 py-3">CPF</th>
                        <th className="px-5 py-3">UNIDADE / DEPARTAMENTO</th>
                        <th className="px-4 py-3 text-right">SALÁRIO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {importRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-800 text-sm">{r.name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{r.position || "Sem cargo"}</p>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-slate-500">{fmtCpf(r.cpf ?? null)}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1.5">
                              <Select
                                value={r.departmentId ?? "missing"}
                                onValueChange={(val) => {
                                  const next = [...importRows]
                                  next[i] = { ...next[i], departmentId: val === "missing" ? undefined : val }
                                  setImportRows(next)
                                }}
                              >
                                <SelectTrigger className={`h-9 text-xs font-medium transition-all ${!r.departmentId ? "border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-200" : "bg-white border-slate-200"}`}>
                                  <SelectValue placeholder="Mapear unidade..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="missing" disabled className="text-slate-400 italic">Mapear unidade...</SelectItem>
                                  {departments.map((d) => (
                                    <SelectItem key={d.id} value={d.id} className="text-sm font-medium">{d.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {r._deptName && !r.departmentId && (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50/50 border border-amber-100 rounded px-2 py-0.5">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span>Planilha: &quot;{r._deptName}&quot;</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-black text-slate-900 text-sm">{fmtBRL(r.salary ?? 0)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importRows.length === 0 && importFile && (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-amber-200 bg-amber-50 text-center mx-1">
                <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
                <p className="text-xs font-black text-amber-900 uppercase tracking-widest">NENHUM FUNCIONÁRIO DETECTADO</p>
                <p className="mt-2 text-[10px] text-amber-700 font-bold max-w-xs mx-auto uppercase tracking-wider leading-relaxed px-4">
                  CERTIFIQUE-SE DE QUE A PLANILHA TEM UMA COLUNA CHAMADA &quot;NOME&quot; PARA IDENTIFICARMOS OS COLABORADORES.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t font-semibold shrink-0">
            <Button variant="ghost" onClick={() => setImportOpen(false)} className="text-slate-500 font-black uppercase text-xs tracking-widest">CANCELAR</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importRows.length === 0 || isImporting}
              className="bg-blue-600 hover:bg-blue-700 gap-2 px-10 shadow-lg shadow-blue-600/20 font-black uppercase text-xs tracking-widest"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> IMPORTANDO...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> IMPORTAR {importRows.length} {importRows.length === 1 ? 'FUNCIONÁRIO' : 'FUNCIONÁRIOS'}</>
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
