"use client"

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  UserPlus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Filter,
  CheckSquare, Square, Download, FileDown, FileUp, Loader2, X, FileSpreadsheet,
  FileText, ChevronDown, Receipt, User, Briefcase, Landmark, Eye,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createEmployee, updateEmployee, deleteEmployee,
  deleteEmployeesBatch, importEmployees, resetDepartmentPaymentStatus,
  updateEmployeePaymentStatus, updateEmployeeStatus, reactivateAllEmployees,
  deleteUnassignedEmployees, validateImportCpfs, deleteEmployeesByCpfs,
} from "@/lib/actions/employees"
import { createDepartment } from "@/lib/actions/departments"
import { getEmployeeComprovantes, deleteComprovante, saveComprovanteManual } from "@/lib/actions/comprovante"
import { buildTree, flattenTree, toTitleCase } from "@/lib/utils/departments"
import { isNameMatch } from "@/lib/utils/nameComparison"


// ─── Types ────────────────────────────────────────────────────────────────────

type Department = { id: string; name: string; parentId?: string | null; nivel?: string | null; children?: Department[] }
type Employee = {
  id: string; name: string; cpf: string | null; email: string | null
  phone: string | null; position: string; salary: number | string
  hireDate: Date; status: string; pagamento: string; departmentId: string | null
  department: Department | null; lastReceiptUrl?: string | null
  lastReceiptAmount?: number | null
  bankName?: string; bankAgency?: string; bankAccount?: string; pixKey?: string
  birthDate?: Date | string | null; motherName?: string | null
}

type ImportRow = {
  name: string; cpf?: string; phone?: string; email?: string
  position?: string; salary?: number; departmentId?: string; _deptName?: string
  bankName?: string; bankAgency?: string; bankAccount?: string; pixKey?: string
  birthDate?: string; motherName?: string
  unidade?: string
  departamento?: string
}

type RowIssue = {
  type: "dup_in_file" | "conflict_other" | "will_update" | "no_unit" | "zero_salary" | "missing_cpf"
  label: string
  severity: "error" | "warning"
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
  lancado: { label: "LANÇADO", cls: "bg-orange-500 text-white shadow-sm" },
}

const normalizePag = (v: string | null) => {
    return (v ?? "pendente").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

const empty = {
  name: "", position: "", salary: "", hireDate: "", departmentId: "",
  cpf: "", email: "", phone: "", status: "ACTIVE", pagamento: "pendente",
  bankName: "", bankAgency: "", bankAccount: "", pixKey: "",
  birthDate: "", motherName: "",
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

function getAbsoluteRoot(dept: Department | null, allDepts: Department[]): string {
  if (!dept) return ""
  const map = new Map(allDepts.map(d => [d.id, d]))
  let cur: Department = dept
  while (cur.parentId) {
    const parent = map.get(cur.parentId)
    if (!parent) break
    cur = parent
  }
  return cur.name
}

function getSecondLevelUnit(dept: Department | null, allDepts: Department[]): string {
  if (!dept) return ""
  if (!dept.parentId) return dept.name
  const map = new Map(allDepts.map(d => [d.id, d]))
  let cur: Department = dept
  while (cur.parentId) {
    const parent = map.get(cur.parentId)
    if (!parent) break
    if (!parent.parentId) return cur.name  // cur is direct child of root → it's the "Unidade"
    cur = parent
  }
  return cur.name
}

// Column detection for import
const NAME_COLS = ["nome", "name", "funcionario", "funcionário", "colaborador", "empregado", "nome completo", "trabalhador"]
const CPF_COLS = ["cpf", "doc", "documento", "cpf/cnpj"]
const PHONE_COLS = ["telefone", "fone", "celular", "cel", "phone", "whatsapp", "zap", "contato"]
const EMAIL_COLS = ["email", "e-mail", "mail", "correio", "endereço eletrônico"]
const POSITION_COLS = ["cargo", "position", "funcao", "função", "ocupacao", "ocupação", "atividade", "setor/função"]
const SALARY_COLS = ["salario", "salário", "salary", "remuneracao", "remuneração", "vencimento", "valor", "base", "líquido", "bruto"]
const UNIDADE_COLS = ["unidade", "unit", "filial", "estabelecimento", "unidade/departamento"]
const DEPAR_COLS = ["departamento", "department", "setor", "dept", "lotacao", "lotação"]
const BANK_COLS = ["banco", "bank", "instituicao", "instituição"]
const AGENCY_COLS = ["agencia", "agência", "agency", "ag"]
const ACCOUNT_COLS = ["conta", "account", "ct"]
const PIX_COLS = ["pix", "chave pix", "pix key", "chave"]
const BIRTH_COLS = ["data de nascimento", "nascimento", "data nascimento", "aniversario", "aniversário", "birthdate", "birth_date"]
const MOTHER_COLS = ["nome da mae", "nome da mãe", "mae", "mãe", "mothername", "mother_name", "genitora"]

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
    bankIdx: find(BANK_COLS),
    agencyIdx: find(AGENCY_COLS),
    accountIdx: find(ACCOUNT_COLS),
    pixIdx: find(PIX_COLS),
    birthIdx: find(BIRTH_COLS),
    motherIdx: find(MOTHER_COLS),
    unidadeIdx: find(UNIDADE_COLS),
    deparIdx: find(DEPAR_COLS),
  }
}

function parseImportRows(rawRows: Record<string, unknown>[], headers: string[], departments: Department[]): ImportRow[] {
  const { 
    nameIdx, cpfIdx, phoneIdx, emailIdx, positionIdx, salaryIdx,
    bankIdx, agencyIdx, accountIdx, pixIdx, birthIdx, motherIdx,
    unidadeIdx, deparIdx
  } = detectImportCols(headers)
  if (nameIdx === -1) return []

  const deptMap = new Map(departments.map((d) => [d.id, d]))

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

      const rawUnidade = unidadeIdx !== -1 ? String(r[headers[unidadeIdx]] ?? "").trim().toUpperCase() : ""
      const rawDepartamento = deparIdx !== -1 ? String(r[headers[deparIdx]] ?? "").trim().toUpperCase() : ""

      if (rawUnidade || rawDepartamento) {
        _deptName = [rawUnidade, rawDepartamento].filter(Boolean).join(" / ")

        const uniName = rawUnidade.toLowerCase()
        const depName = rawDepartamento.toLowerCase()

        // 1. Try to find a department matching 'Departamento' whose parent matches 'Unidade'
        if (uniName && depName) {
          const matchedDep = departments.find(d => {
            if (d.name.toLowerCase() !== depName) return false
            if (!d.parentId) return false
            const parent = deptMap.get(d.parentId)
            return parent && parent.name.toLowerCase() === uniName
          })
          if (matchedDep) {
            departmentId = matchedDep.id
          }
        }

        // 2. Fallback: Try to find by Departamento name alone
        if (!departmentId && depName) {
          const matchedDep = departments.find(d => d.name.toLowerCase() === depName)
          if (matchedDep) {
            departmentId = matchedDep.id
          }
        }

        // 3. Fallback: Try to find by Unidade name alone (typically the root)
        if (!departmentId && uniName) {
          const matchedUni = departments.find(d => d.name.toLowerCase() === uniName)
          if (matchedUni) {
            departmentId = matchedUni.id
          }
        }
      }

      const bankName = bankIdx !== -1 ? String(r[headers[bankIdx]] ?? "").trim().toUpperCase() || undefined : undefined
      const bankAgency = agencyIdx !== -1 ? String(r[headers[agencyIdx]] ?? "").trim() || undefined : undefined
      const bankAccount = accountIdx !== -1 ? String(r[headers[accountIdx]] ?? "").trim() || undefined : undefined
      const pixKey = pixIdx !== -1 ? String(r[headers[pixIdx]] ?? "").trim().toUpperCase() || undefined : undefined

      // Parse birthDate
      const birthRaw = birthIdx !== -1 ? r[headers[birthIdx]] : undefined
      let birthDate: string | undefined = undefined
      if (birthRaw) {
        if (birthRaw instanceof Date) {
          birthDate = birthRaw.toISOString().split("T")[0]
        } else {
          const birthStr = String(birthRaw).trim()
          if (birthStr) {
            const num = Number(birthStr)
            if (!isNaN(num) && num > 0) {
              const d = new Date((num - 25569) * 86400 * 1000)
              if (!isNaN(d.getTime())) {
                birthDate = d.toISOString().split("T")[0]
              }
            } else {
              let d = new Date(birthStr)
              if (isNaN(d.getTime()) && birthStr.includes("/")) {
                const parts = birthStr.split("/")
                if (parts.length === 3) {
                  const day = parts[0].padStart(2, "0")
                  const month = parts[1].padStart(2, "0")
                  const year = parts[2]
                  d = new Date(`${year}-${month}-${day}`)
                }
              }
              if (!isNaN(d.getTime())) {
                birthDate = d.toISOString().split("T")[0]
              }
            }
          }
        }
      }

      // Parse motherName
      const motherName = motherIdx !== -1 ? String(r[headers[motherIdx]] ?? "").trim().toUpperCase() || undefined : undefined

      return { 
        name, cpf, phone, email, position, salary, departmentId, _deptName,
        bankName, bankAgency, bankAccount, pixKey, birthDate, motherName,
        unidade: rawUnidade || undefined,
        departamento: rawDepartamento || undefined
      }
    })
    .filter(Boolean) as ImportRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FuncionariosClient({
  employees, departments, userRole,
}: { employees: Employee[]; departments: Department[]; userRole?: string }) {
  console.log("[DEBUG] FuncionariosClient userRole:", userRole)
  const isAllowedToDelete = userRole?.toUpperCase() === "ADMIN" || userRole?.toUpperCase() === "RH"
  const router = useRouter()


  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [filterPrincipal, setFilterPrincipal] = useState("all")
  const [filterDept, setFilterDept] = useState("all")
  const [filterPagamento, setFilterPagamento] = useState("all")
  const [filterStatus, setFilterStatus] = useState("ACTIVE")
  const [filterSearch, setFilterSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [resetPagamentoOpen, setResetPagamentoOpen] = useState(false)
  const [resetPagamentoDept, setResetPagamentoDept] = useState<string>("")
  const [reativarTodosOpen, setReativarTodosOpen] = useState(false)
  const [deleteUnassignedOpen, setDeleteUnassignedOpen] = useState(false)

  // Optimistic local employee list for instant pagamento updates
  const [localEmployees, setLocalEmployees] = useState<Employee[]>(employees)
  const [updatingPagamentoId, setUpdatingPagamentoId] = useState<string | null>(null)

  useEffect(() => {
    setLocalEmployees(employees)
  }, [employees])

  // Extrato state
  const [extratoEmployee, setExtratoEmployee] = useState<Employee | null>(null)
  const [extratoData, setExtratoData] = useState<Awaited<ReturnType<typeof getEmployeeComprovantes>>>([])
  const [extratoLoading, setExtratoLoading] = useState(false)

  // Upload manual de comprovante
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  async function openExtrato(emp: Employee) {
    setExtratoEmployee(emp)
    setExtratoData([])
    setExtratoLoading(true)
    try {
      const data = await getEmployeeComprovantes(emp.cpf ?? "", emp.id)
      setExtratoData(data)
    } finally {
      setExtratoLoading(false)
    }
  }

  async function handleUploadComprovante() {
    if (!extratoEmployee) return
    if (!uploadFile) { alert("Selecione um arquivo"); return }

    setUploadLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", uploadFile)
      fd.append("employeeId", extratoEmployee.id)
      fd.append("employeeName", extratoEmployee.name)
      fd.append("cpf", extratoEmployee.cpf ?? "")
      await saveComprovanteManual(fd)
      setUploadOpen(false)
      setUploadFile(null)
      // Recarrega extrato
      const data = await getEmployeeComprovantes(extratoEmployee.cpf ?? "", extratoEmployee.id)
      setExtratoData(data)
    } catch (e: any) {
      alert("Erro ao enviar: " + (e?.message ?? "Erro desconhecido"))
    } finally {
      setUploadLoading(false)
    }
  }

  async function handleDeleteComprovante(id: string) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return
    try {
      const res = await deleteComprovante(id)
      if (res.success) {
        setExtratoData(prev => prev.filter(r => r.id !== id))
      }
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message)
    }
  }

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importGlobalParent, setImportGlobalParent] = useState<string>("")
  const [importGlobalSubDept, setImportGlobalSubDept] = useState<string>("")
  const [rowIssues, setRowIssues] = useState<Map<number, RowIssue[]>>(new Map())
  const [isValidating, setIsValidating] = useState(false)
  const [validationDone, setValidationDone] = useState(false)
  const [deleteConflictOpen, setDeleteConflictOpen] = useState(false)
  const [isDeletingConflicts, setIsDeletingConflicts] = useState(false)

  // ── Filtering ────────────────────────────────────────────────────────────────

  // Cascata: sub-unidade tem prioridade; se não, usa a principal; se nenhum, sem filtro
  const deptFilterIds = useMemo(() => {
    const root = filterDept !== "all" ? filterDept : filterPrincipal !== "all" ? filterPrincipal : null
    if (!root) return null
    const ids = new Set<string>([root])
    const queue = [root]
    while (queue.length) {
      const current = queue.shift()!
      departments.filter(d => d.parentId === current).forEach(d => {
        ids.add(d.id)
        queue.push(d.id)
      })
    }
    return ids
  }, [filterDept, filterPrincipal, departments])

  // Sub-unidades disponíveis para o segundo select
  const principalTree = useMemo(
    () => buildTree(departments as any) as any[],
    [departments]
  )
  const selectedPrincipalNode = useMemo(
    () => principalTree.find((r: any) => r.id === filterPrincipal) ?? null,
    [principalTree, filterPrincipal]
  )
  const subUnitList = useMemo(
    () => flattenTree(selectedPrincipalNode?.children ?? [], 0) as any[],
    [selectedPrincipalNode]
  )

  const importPrincipalDepts = useMemo(
    () => departments.filter(d => !d.parentId),
    [departments]
  )
  const importSubDepts = useMemo(
    () => importGlobalParent ? departments.filter(d => d.parentId === importGlobalParent) : [],
    [departments, importGlobalParent]
  )

  const filteredEmployees = localEmployees.filter((emp) => {
    const s = filterSearch.toLowerCase().trim()
    const matchesSearch = !s ||
      emp.name.toLowerCase().includes(s) ||
      (emp.cpf && emp.cpf.includes(s))

    const matchesDept = filterPrincipal === "unassigned"
      ? emp.departmentId == null
      : !deptFilterIds || (emp.departmentId != null && deptFilterIds.has(emp.departmentId))
    const matchesPagamento = filterPagamento === "all" || normalizePag(emp.pagamento) === filterPagamento
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
      birthDate: emp.birthDate && !isNaN(new Date(emp.birthDate).getTime()) ? new Date(emp.birthDate).toISOString().split("T")[0] : "",
      motherName: emp.motherName ?? "",
      departmentId: emp.departmentId ?? "",
      cpf: emp.cpf ?? "",
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      status: emp.status,
      pagamento: normalizePag(emp.pagamento),
      bankName: emp.bankName ?? "",
      bankAgency: emp.bankAgency ?? "",
      bankAccount: emp.bankAccount ?? "",
      pixKey: emp.pixKey ?? "",
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        name: form.name.trim(),
        position: form.position.trim().toUpperCase() || "A DEFINIR",
        salary: parseFloat(form.salary),
        hireDate: form.hireDate || new Date().toISOString().split("T")[0],
        birthDate: form.birthDate || null,
        motherName: form.motherName.trim() || null,
        departmentId: form.departmentId || undefined,
        cpf: form.cpf || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      }
      const bankData = {
        bankName: form.bankName.trim().toUpperCase(),
        bankAgency: form.bankAgency.trim(),
        bankAccount: form.bankAccount.trim(),
        pixKey: form.pixKey.trim().toUpperCase(),
      }
      if (editing) {
        // Optimistic update
        const updated = {
          ...editing,
          ...data,
          ...bankData,
          status: form.status,
          pagamento: form.pagamento,
          department: departments.find(d => d.id === form.departmentId) || editing.department,
        }
        setLocalEmployees(prev => prev.map(e => e.id === editing.id ? updated as any : e))
        
        await updateEmployee(editing.id, { ...data, ...bankData, status: form.status, pagamento: form.pagamento })
      } else {
        // Optimistic add (with temp ID)
        const tempId = "temp-" + Date.now()
        const newItem = {
          id: tempId,
          ...data,
          ...bankData,
          status: "ACTIVE", // Default for new
          pagamento: form.pagamento || "pendente",
          department: departments.find(d => d.id === form.departmentId),
        }
        setLocalEmployees(prev => [newItem as any, ...prev])
        
        await createEmployee({ ...data, ...bankData, pagamento: form.pagamento })
      }
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error("[SUBMIT_ERROR]", err)
      alert("Erro ao salvar: " + (err.message || "Erro desconhecido"))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const idToDelete = deleteId
    setLoading(true)
    // Optimistic delete
    setLocalEmployees(prev => prev.filter(e => e.id !== idToDelete))
    try {
      await deleteEmployee(idToDelete)
    } catch (err: any) {
      // Rollback if error
      alert("Erro ao excluir: " + err.message)
      router.refresh()
    } finally {
      setDeleteId(null); setLoading(false)
      router.refresh()
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setLoading(true)
    // Optimistic delete
    setLocalEmployees(prev => prev.filter(e => !selectedIds.has(e.id)))
    try {
      await deleteEmployeesBatch(ids)
      setSelectedIds(new Set()); setBulkDeleteOpen(false)
    } catch (err: any) {
      alert("Erro ao excluir em massa: " + err.message)
      router.refresh()
    } finally {
      setLoading(false)
      router.refresh()
    }
  }

  async function handleDeleteUnassigned() {
    setLoading(true)
    try {
      const result = await deleteUnassignedEmployees()
      setLocalEmployees(prev => prev.filter(e => e.departmentId != null))
      setDeleteUnassignedOpen(false)
      alert(`${result.deleted} funcionário${result.deleted !== 1 ? "s" : ""} sem unidade excluído${result.deleted !== 1 ? "s" : ""}.`)
      router.refresh()
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPagamento() {
    if (!resetPagamentoDept) return
    const deptId = resetPagamentoDept
    setLoading(true)
    // Optimistic update for all in dept
    setLocalEmployees(prev => prev.map(e => e.departmentId === deptId ? { ...e, pagamento: "pendente" } : e))
    try {
      await resetDepartmentPaymentStatus(deptId)
      setResetPagamentoOpen(false)
    } catch (err: any) {
      alert("Erro ao resetar: " + err.message)
      router.refresh()
    } finally {
      setLoading(false)
      router.refresh()
    }
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleQuickPagamento(empId: string, novoPagamento: string) {
    setUpdatingPagamentoId(empId)
    setLocalEmployees(prev => prev.map(e => e.id === empId ? { ...e, pagamento: novoPagamento } : e))
    try {
      await updateEmployeePaymentStatus(empId, novoPagamento)
      router.refresh()
    } catch (err: any) {
      setLocalEmployees(prev => prev.map(e => e.id === empId ? { ...e, pagamento: employees.find(o => o.id === empId)?.pagamento ?? "pendente" } : e))
      alert("Erro ao atualizar situação de pagamento: " + err.message)
    } finally {
      setUpdatingPagamentoId(null)
    }
  }

  async function handleStatusToggle(empId: string, currentStatus: string) {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setLocalEmployees(prev => prev.map(e => e.id === empId ? { ...e, status: nextStatus } : e))
    try {
      await updateEmployeeStatus(empId, nextStatus)
      router.refresh()
    } catch (err: any) {
      setLocalEmployees(prev => prev.map(e => e.id === empId ? { ...e, status: currentStatus } : e))
      alert("Erro ao atualizar status: " + err.message)
    }
  }

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
  .lancado  { background:#f97316; color:#ffffff; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Extrato de Funcionários</h1>
<p class="sub">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · ${rows.length} funcionário${rows.length !== 1 ? "s" : ""}${filterDept !== "all" ? ` · ${departments.find(d => d.id === filterDept)?.name ?? ""}` : filterPrincipal !== "all" ? ` · ${departments.find(d => d.id === filterPrincipal)?.name ?? ""} (todos)` : ""}${filterPagamento !== "all" ? ` · Pagamento: ${pagamentoMap[filterPagamento]?.label ?? filterPagamento}` : ""}</p>
<table>
<thead><tr>
  <th>#</th><th>Nome</th><th>CPF</th><th>Cargo</th><th>Unidade</th><th>Departamento</th><th>Telefone</th><th>Salário</th><th>Status</th><th>Pagamento</th>
</tr></thead>
<tbody>
${rows.map((emp, i) => `<tr>
  <td>${i + 1}</td>
  <td>${toTitleCase(emp.name)}</td>
  <td>${fmtCpf(emp.cpf)}</td>
  <td>${emp.position}</td>
  <td>${getAbsoluteRoot(emp.department, departments)}</td>
  <td>${getSecondLevelUnit(emp.department, departments)}</td>
  <td>${fmtPhone(emp.phone)}</td>
  <td>${fmtBRL(Number(emp.salary))}</td>
  <td><span class="badge ${emp.status}">${statusMap[emp.status as keyof typeof statusMap]?.label ?? emp.status}</span></td>
  <td><span class="badge ${normalizePag(emp.pagamento)}">${pagamentoMap[normalizePag(emp.pagamento)]?.label ?? emp.pagamento}</span></td>
</tr>`).join("")}
</tbody></table>
</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  // ── Export Excel ──────────────────────────────────────────────────────────────

  function handleExportExcel() {
    const data = filteredEmployees.map((emp) => ({
      "Nome": toTitleCase(emp.name),
      "CPF": fmtCpf(emp.cpf),
      "Data de Nascimento": emp.birthDate ? fmtDate(emp.birthDate) : "",
      "Nome da Mãe": emp.motherName ? toTitleCase(emp.motherName) : "",
      "Cargo": emp.position,
      "E-mail": emp.email ?? "",
      "Telefone": fmtPhone(emp.phone),
      "Salário": Number(emp.salary),
      "Data Admissão": fmtDate(emp.hireDate),
      "Unidade": getAbsoluteRoot(emp.department, departments),
      "Departamento": getSecondLevelUnit(emp.department, departments),
      "Banco": emp.bankName ?? "",
      "Agência": emp.bankAgency ?? "",
      "Conta": emp.bankAccount ?? "",
      "Chave PIX": emp.pixKey ?? "",
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [
      { wch: 35 }, // Nome
      { wch: 16 }, // CPF
      { wch: 20 }, // Data de Nascimento
      { wch: 30 }, // Nome da Mãe
      { wch: 25 }, // Cargo
      { wch: 28 }, // E-mail
      { wch: 20 }, // Telefone
      { wch: 12 }, // Salário
      { wch: 16 }, // Data Admissão
      { wch: 25 }, // Unidade
      { wch: 25 }, // Departamento
      { wch: 15 }, // Banco
      { wch: 10 }, // Agência
      { wch: 15 }, // Conta
      { wch: 25 }  // Chave PIX
    ]
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
        "Data de Nascimento": "15/05/1990",
        "Nome da Mãe": "Maria da Silva",
        "Cargo": "Auxiliar Administrativo",
        "E-mail": "joao@empresa.com",
        "Telefone": "(11) 99999-9999",
        "Salário": 2000,
        "Data Admissão": "01/01/2024",
        "Unidade": "CONDEUBA",
        "Departamento": "Secretaria de Meio Ambiente",
        "Banco": "NUBANK",
        "Agência": "0001",
        "Conta": "1234567-8",
        "Chave PIX": "joao@email.com",
      },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    ws["!cols"] = [
      { wch: 35 }, // Nome
      { wch: 16 }, // CPF
      { wch: 20 }, // Data de Nascimento
      { wch: 30 }, // Nome da Mãe
      { wch: 25 }, // Cargo
      { wch: 28 }, // E-mail
      { wch: 20 }, // Telefone
      { wch: 12 }, // Salário
      { wch: 16 }, // Data Admissão
      { wch: 25 }, // Unidade
      { wch: 25 }, // Departamento
      { wch: 15 }, // Banco
      { wch: 10 }, // Agência
      { wch: 15 }, // Conta
      { wch: 25 }  // Chave PIX
    ]
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

  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleConfirmImport() {
    if (!importRows.length) return
    setIsImporting(true)
    setImportProgress(null)

    const rows = importRows.map(({ _deptName: _, ...r }) => {
      if (!r.departmentId && !r.unidade && !r.departamento) {
        return {
          ...r,
          departmentId: importGlobalSubDept || importGlobalParent || undefined
        }
      }
      return r
    })
    const BATCH = 100
    const batches: typeof rows[] = []
    for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH))

    let totalInserted = 0
    let totalUpdated = 0
    let totalSkipped = 0

    try {
      for (let b = 0; b < batches.length; b++) {
        setImportProgress({ done: b * BATCH, total: rows.length })
        const result = await importEmployees(batches[b])
        totalInserted += result.inserted
        totalUpdated += result.updated
        totalSkipped += result.skippedDuplicates
      }
      setImportProgress({ done: rows.length, total: rows.length })

      const parts = [`${totalInserted} novo${totalInserted !== 1 ? "s" : ""}`]
      if (totalUpdated > 0) parts.push(`${totalUpdated} atualizado${totalUpdated !== 1 ? "s" : ""}`)
      if (totalSkipped > 0) parts.push(`${totalSkipped} ignorado${totalSkipped !== 1 ? "s" : ""} (CPF conflitante)`)
      alert(`Importação concluída: ${parts.join(", ")}.`)
      setImportOpen(false)
      setImportFile(null)
      setImportRows([])
    } catch (err: any) {
      alert(`Erro no lote ${Math.ceil((importProgress?.done ?? 0) / BATCH) + 1}: ${err.message}`)
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }

  function openImport() {
    setImportFile(null); setImportRows([]); setImportHeaders([])
    setImportGlobalParent(""); setImportGlobalSubDept("")
    setRowIssues(new Map()); setValidationDone(false)
    setImportOpen(true)
  }

  const conflictCpfs = (() => {
    const cpfs: string[] = []
    rowIssues.forEach((issues, i) => {
      if (issues.some(iss => iss.type === "conflict_other")) {
        const cpf = importRows[i]?.cpf?.replace(/\D/g, "")
        if (cpf) cpfs.push(cpf)
      }
    })
    return cpfs
  })()

  async function handleDeleteConflicts() {
    setIsDeletingConflicts(true)
    try {
      const result = await deleteEmployeesByCpfs(conflictCpfs)
      setDeleteConflictOpen(false)
      await handleValidate()
      alert(`${result.deleted} funcionário${result.deleted !== 1 ? "s" : ""} excluído${result.deleted !== 1 ? "s" : ""} do banco.`)
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message)
    } finally {
      setIsDeletingConflicts(false)
    }
  }

  function invalidateValidation() {
    setRowIssues(new Map())
    setValidationDone(false)
  }

  async function handleValidate() {
    setIsValidating(true)
    try {
      const issues = new Map<number, RowIssue[]>()
      const addIssue = (i: number, issue: RowIssue) => {
        if (!issues.has(i)) issues.set(i, [])
        issues.get(i)!.push(issue)
      }

      // 0. CPF obrigatório
      importRows.forEach((r, i) => {
        if (!r.cpf) {
          addIssue(i, { type: "missing_cpf", label: "CPF é obrigatório", severity: "error" })
        }
      })

      // 1. CPF duplicado dentro da própria planilha
      const cpfIdxMap = new Map<string, number[]>()
      importRows.forEach((r, i) => {
        if (r.cpf) {
          const c = r.cpf.replace(/\D/g, "")
          if (!cpfIdxMap.has(c)) cpfIdxMap.set(c, [])
          cpfIdxMap.get(c)!.push(i)
        }
      })
      cpfIdxMap.forEach((indices) => {
        if (indices.length > 1)
          indices.slice(0, -1).forEach(i =>
            addIssue(i, { type: "dup_in_file", label: "CPF duplicado na planilha", severity: "error" })
          )
      })

      // 2. CPFs já existentes no banco
      const cpfsToCheck = importRows
        .map((r, i) => ({ i, cpf: r.cpf?.replace(/\D/g, "") }))
        .filter((x): x is { i: number; cpf: string } => !!x.cpf)
      if (cpfsToCheck.length > 0) {
        const dbResults = await validateImportCpfs(cpfsToCheck.map(x => x.cpf))
        const dbMap = new Map(dbResults.map(r => [r.cpf, r]))
        cpfsToCheck.forEach(({ i, cpf }) => {
          const dbInfo = dbMap.get(cpf)
          if (dbInfo) {
            if (dbInfo.status === "exists_other") {
              addIssue(i, { type: "conflict_other", label: "CPF pertence a outra empresa — será ignorado", severity: "error" })
            } else if (dbInfo.status === "exists_same") {
              const row = importRows[i]
              const divergencies: string[] = []

              // 1. Nome
              if (row.name && dbInfo.name && !isNameMatch(row.name, dbInfo.name)) {
                divergencies.push(`Nome: "${dbInfo.name}" vs "${row.name}"`)
              }
              // 2. Cargo
              if (row.position && dbInfo.position && row.position.trim().toUpperCase() !== dbInfo.position.trim().toUpperCase()) {
                divergencies.push(`Cargo: "${dbInfo.position}" vs "${row.position}"`)
              }
              // 3. Salário
              if (row.salary !== undefined && dbInfo.salary !== undefined && Math.abs(Number(row.salary) - Number(dbInfo.salary)) > 0.01) {
                divergencies.push(`Salário: R$ ${Number(dbInfo.salary).toFixed(2)} vs R$ ${Number(row.salary).toFixed(2)}`)
              }
              // 4. Telefone
              const cleanRowPhone = row.phone ? row.phone.replace(/\D/g, "") : ""
              const cleanDbPhone = dbInfo.phone ? dbInfo.phone.replace(/\D/g, "") : ""
              if (cleanRowPhone && cleanDbPhone && cleanRowPhone !== cleanDbPhone) {
                divergencies.push(`Telefone: "${dbInfo.phone}" vs "${row.phone}"`)
              }
              // 5. E-mail
              if (row.email && dbInfo.email && row.email.trim().toLowerCase() !== dbInfo.email.trim().toLowerCase()) {
                divergencies.push(`E-mail: "${dbInfo.email}" vs "${row.email}"`)
              }
              // 6. Data de Nascimento
              const dbBirthDateOnly = dbInfo.birthDate ? dbInfo.birthDate.split("T")[0] : ""
              const rowBirthDateOnly = row.birthDate ? row.birthDate.split("T")[0] : ""
              if (rowBirthDateOnly && dbBirthDateOnly && rowBirthDateOnly !== dbBirthDateOnly) {
                const fmtDateStr = (dStr: string) => {
                  const parts = dStr.split("-")
                  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr
                }
                divergencies.push(`Nascimento: "${fmtDateStr(dbBirthDateOnly)}" vs "${fmtDateStr(rowBirthDateOnly)}"`)
              }
              // 7. Nome da Mãe
              if (row.motherName && dbInfo.motherName && row.motherName.trim().toUpperCase() !== dbInfo.motherName.trim().toUpperCase()) {
                divergencies.push(`Mãe: "${dbInfo.motherName}" vs "${row.motherName}"`)
              }
              // 8. Banco
              if (row.bankName && dbInfo.bankName && row.bankName.trim().toUpperCase() !== dbInfo.bankName.trim().toUpperCase()) {
                divergencies.push(`Banco: "${dbInfo.bankName}" vs "${row.bankName}"`)
              }
              // 9. Agência
              if (row.bankAgency && dbInfo.bankAgency && row.bankAgency.trim() !== dbInfo.bankAgency.trim()) {
                divergencies.push(`Agência: "${dbInfo.bankAgency}" vs "${row.bankAgency}"`)
              }
              // 10. Conta
              if (row.bankAccount && dbInfo.bankAccount && row.bankAccount.trim() !== dbInfo.bankAccount.trim()) {
                divergencies.push(`Conta: "${dbInfo.bankAccount}" vs "${row.bankAccount}"`)
              }
              // 11. Chave PIX
              if (row.pixKey && dbInfo.pixKey && row.pixKey.trim().toUpperCase() !== dbInfo.pixKey.trim().toUpperCase()) {
                divergencies.push(`PIX: "${dbInfo.pixKey}" vs "${row.pixKey}"`)
              }

              // 12. Unidade / Departamento
              const existingDeptId = dbInfo.departmentId
              const sheetPath = row.departmentId
                ? (() => {
                    const mappedDept = departments.find(d => d.id === row.departmentId)
                    const p = mappedDept?.parentId ? departments.find(d => d.id === mappedDept.parentId) : null
                    return [p?.name, mappedDept?.name].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")
                  })()
                : [row.unidade, row.departamento].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")

              if (existingDeptId) {
                const currentDept = departments.find(d => d.id === existingDeptId)
                const currentParent = currentDept?.parentId ? departments.find(d => d.id === currentDept.parentId) : null
                const dbPath = [currentParent?.name, currentDept?.name].filter((s): s is string => !!s).map(s => s.trim().toUpperCase()).join(" / ")

                if (sheetPath && dbPath !== sheetPath) {
                  divergencies.push(`Unidade/Depto: "${dbPath}" vs "${sheetPath}"`)
                }
              }

              if (divergencies.length > 0) {
                divergencies.forEach((div) => {
                  addIssue(i, {
                    type: "will_update",
                    label: `Divergência: ${div} — será atualizado`,
                    severity: "warning"
                  })
                })
              } else {
                addIssue(i, { type: "will_update", label: "Já cadastrado — sem divergências", severity: "warning" })
              }
            }
          }
        })
      }

      // 3. Sem unidade
      importRows.forEach((r, i) => {
        if (!r.departmentId) {
          if (r.unidade || r.departamento) {
            // Se tiver unidade/departamento na planilha, o backend criará automaticamente.
          } else if (importGlobalParent) {
            r.departmentId = importGlobalSubDept || importGlobalParent
            addIssue(i, { type: "will_update", label: "Unidade em branco — atribuída unidade padrão", severity: "warning" })
          } else {
            addIssue(i, { type: "no_unit", label: "Sem unidade definida", severity: "warning" })
          }
        }
      })

      // 4. Salário zero
      importRows.forEach((r, i) => {
        if (!r.salary || r.salary === 0)
          addIssue(i, { type: "zero_salary", label: "Salário R$ 0,00", severity: "warning" })
      })

      setRowIssues(issues)
      setValidationDone(true)
    } catch (err: any) {
      alert("Erro na validação: " + err.message)
    } finally {
      setIsValidating(false)
    }
  }

  function removeImportRow(i: number) {
    setImportRows(prev => prev.filter((_, idx) => idx !== i))
    invalidateValidation()
  }

  function removeAllErrorRows() {
    const errorIdx = new Set<number>()
    rowIssues.forEach((issues, i) => {
      if (issues.some(iss => iss.severity === "error")) errorIdx.add(i)
    })
    setImportRows(prev => prev.filter((_, i) => !errorIdx.has(i)))
    invalidateValidation()
  }

  function downloadErrorRows() {
    const rows: Record<string, unknown>[] = []
    rowIssues.forEach((issues, i) => {
      const r = importRows[i]
      if (!r) return
      
      const mappedDept = departments.find(d => d.id === r.departmentId)
      let outUnidade = ""
      let outDepto = ""
      if (mappedDept) {
        outUnidade = getAbsoluteRoot(mappedDept, departments)
        outDepto = getSecondLevelUnit(mappedDept, departments)
        if (outUnidade === outDepto) {
          outDepto = ""
        }
      } else if (r._deptName) {
        const parts = r._deptName.split(" / ")
        outUnidade = parts[0] || ""
        outDepto = parts[1] || ""
      }

      rows.push({
        "Nome": r.name,
        "CPF": fmtCpf(r.cpf ?? null),
        "Data de Nascimento": r.birthDate ? fmtDate(r.birthDate) : "",
        "Nome da Mãe": r.motherName ?? "",
        "Cargo": r.position || "",
        "Salário": r.salary ?? 0,
        "Unidade": outUnidade,
        "Departamento": outDepto,
        "Erros": issues.filter(iss => iss.severity === "error").map(iss => iss.label).join("; "),
        "Avisos": issues.filter(iss => iss.severity === "warning").map(iss => iss.label).join("; "),
      })
    })
    if (!rows.length) return
    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [
      { wch: 35 }, // Nome
      { wch: 16 }, // CPF
      { wch: 20 }, // Data de Nascimento
      { wch: 30 }, // Nome da Mãe
      { wch: 25 }, // Cargo
      { wch: 12 }, // Salário
      { wch: 25 }, // Unidade
      { wch: 25 }, // Departamento
      { wch: 45 }, // Erros
      { wch: 35 }  // Avisos
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Divergências")
    XLSX.writeFile(wb, `divergencias-funcionarios-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`)
  }

  async function handleCreateNewPrincipalUnit() {
    const name = prompt("Digite o nome da nova Unidade Principal (ex: QUEIMADAS):")
    if (!name) return
    const cleanName = name.trim().toUpperCase()
    if (!cleanName) return

    try {
      setLoading(true)
      const res = await createDepartment({ name: cleanName, nivel: "PRINCIPAL" })
      if (res && res.id) {
        setImportGlobalParent(res.id)
        setImportGlobalSubDept("")
      }
      router.refresh()
      alert(`Unidade "${cleanName}" criada com sucesso!`)
    } catch (err: any) {
      alert("Erro ao criar unidade: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateNewSubDept() {
    if (!importGlobalParent) {
      alert("Selecione a Unidade Principal primeiro.")
      return
    }
    const name = prompt("Digite o nome do novo Sub-departamento (ex: Administrativo):")
    if (!name) return
    const cleanName = name.trim()
    if (!cleanName) return

    try {
      setLoading(true)
      const res = await createDepartment({ name: cleanName, nivel: "SUBUNIDADE", parentId: importGlobalParent })
      if (res && res.id) {
        setImportGlobalSubDept(res.id)
      }
      router.refresh()
      alert(`Departamento "${cleanName}" criado com sucesso!`)
    } catch (err: any) {
      alert("Erro ao criar departamento: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleApplyGlobalUnit() {
    if (!importGlobalParent) return
    const targetId = importGlobalSubDept || importGlobalParent

    const getAllDescendants = (pid: string): Department[] => {
      const kids = departments.filter(d => d.parentId === pid)
      return [...kids, ...kids.flatMap(k => getAllDescendants(k.id))]
    }
    const pool = [departments.find(d => d.id === importGlobalParent)!, ...getAllDescendants(importGlobalParent)].filter(Boolean)

    setImportRows(importRows.map(row => {
      if (!row._deptName) return { ...row, departmentId: targetId }
      const needle = row._deptName.toLowerCase().trim()
      const hit = pool.find(d => {
        const hay = d.name.toLowerCase().trim()
        return hay === needle || hay.includes(needle) || needle.includes(hay)
      })
      return { ...row, departmentId: hit?.id ?? targetId }
    }))
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
              <DropdownMenuItem
                onClick={() => { setResetPagamentoDept(filterDept !== "all" ? filterDept : filterPrincipal !== "all" ? filterPrincipal : ""); setResetPagamentoOpen(true) }}
                className="gap-2 cursor-pointer text-amber-700 focus:text-amber-700"
              >
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
                <span>Resetar Pagamento</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setReativarTodosOpen(true)}
                className="gap-2 cursor-pointer text-emerald-700 focus:text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Ativar Todos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteUnassignedOpen(true)}
                className="gap-2 cursor-pointer text-red-700 focus:text-red-700"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>Excluir Sem Unidade</span>
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

          {/* Nível 1 — Unidade */}
          <select
            value={filterPrincipal}
            onChange={e => { setFilterPrincipal(e.target.value); setFilterDept("all") }}
            className="h-10 min-w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">Todas as unidades</option>
            <option value="unassigned">Sem unidade</option>
            {principalTree.map((root: any) => (
              <option key={root.id} value={root.id}>
                {toTitleCase(root.name)}
              </option>
            ))}
          </select>

          {/* Nível 2 — Departamento (aparece só quando uma unidade está selecionada) */}
          {filterPrincipal !== "all" && filterPrincipal !== "unassigned" && subUnitList.length > 0 && (
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="h-10 min-w-[180px] rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">↳ Todos os departamentos</option>
              {subUnitList.map((sub: any) => (
                <option key={sub.id} value={sub.id}>
                  {"   ".repeat(sub.depth)}↳ {sub.name.toUpperCase()}
                </option>
              ))}
            </select>
          )}

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
              <SelectItem value="lancado">LANÇADO</SelectItem>
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
                          {toTitleCase(emp.name)}
                        </h3>
                        <p className="text-xs font-medium text-slate-500">{fmtCpf(emp.cpf)}</p>
                      </div>
                      
                      {/* Status & Selection Indicator */}
                      <div className="flex items-center gap-2 pt-0.5 shrink-0">
                        <button
                          onClick={() => handleStatusToggle(emp.id, emp.status)}
                          title={emp.status === "ACTIVE" ? "Desativar Funcionário" : "Ativar Funcionário"}
                          className={`h-5 w-5 rounded-full border-2 border-white shadow-md transition-transform active:scale-90 ${
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
                        <span className="font-semibold text-slate-700">{emp.position?.split(' ').slice(0, 3).join(' ')}</span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 min-w-0">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold shrink-0">Unidade</span>
                        <span className="font-semibold text-slate-700 truncate uppercase text-right" title={(getAbsoluteRoot(emp.department, departments) || "—").toUpperCase()}>
                          {(getAbsoluteRoot(emp.department, departments) || "—").toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 min-w-0">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold shrink-0">Departamento</span>
                        <span className="font-semibold text-slate-700 truncate uppercase text-right" title={(getSecondLevelUnit(emp.department, departments) || "—").toUpperCase()}>
                          {(getSecondLevelUnit(emp.department, departments) || "—").toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Pagamento</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={updatingPagamentoId === emp.id}
                              title="Clique para alterar situação de pagamento"
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 ${pagamentoMap[normalizePag(emp.pagamento)]?.cls ?? pagamentoMap.pendente.cls}`}
                            >
                              {updatingPagamentoId === emp.id ? "..." : (pagamentoMap[normalizePag(emp.pagamento)]?.label ?? emp.pagamento)}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {Object.entries(pagamentoMap).map(([value, { label, cls }]) => (
                              <DropdownMenuItem
                                key={value}
                                disabled={normalizePag(emp.pagamento) === value}
                                onClick={() => handleQuickPagamento(emp.id, value)}
                                className="gap-2 cursor-pointer"
                              >
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${cls}`}>{label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Salário</span>
                        <span className="text-lg font-black text-slate-900">{fmtBRL(Number(emp.salary))}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openExtrato(emp)}
                          title="Ver Extrato de Comprovantes"
                          className="flex h-9 items-center gap-1.5 px-2.5 justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-[11px] font-bold uppercase tracking-wide"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Extrato
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

      {/* ── Extrato Dialog ── */}
      <Dialog open={!!extratoEmployee} onOpenChange={(v) => { if (!v) { setExtratoEmployee(null); setExtratoData([]) } }}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Extrato de Comprovantes
                </DialogTitle>
                {extratoEmployee && (
                  <p className="text-sm text-slate-500 mt-1">
                    {extratoEmployee.name} · CPF {fmtCpf(extratoEmployee.cpf)}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setUploadFile(null); setUploadOpen(true) }}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <FileUp className="h-3.5 w-3.5" /> Enviar Comprovante
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            {extratoLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : extratoData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Receipt className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Nenhum comprovante encontrado</p>
                <p className="text-xs">Analise comprovantes na página de Comprovantes.</p>
                {extratoEmployee && (
                  <button
                    onClick={async () => {
                      const url = `/api/debug/comprovante?employeeId=${extratoEmployee.id}&cpf=${extratoEmployee.cpf ?? ""}`
                      const res = await fetch(url)
                      const json = await res.json()
                      alert(JSON.stringify(json, null, 2))
                    }}
                    className="mt-2 text-[10px] text-slate-300 underline hover:text-slate-500"
                  >
                    [diagnóstico]
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-2 -top-2 opacity-10 transition-transform group-hover:scale-110">
                      <FileText className="h-12 w-12 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500/70">Registros</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">{extratoData.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-2 -top-2 opacity-10 transition-transform group-hover:scale-110">
                      <Receipt className="h-12 w-12 text-emerald-600" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">Total Pago</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                      {fmtBRL(extratoData.reduce((s, r) => s + (r.amount ?? 0), 0))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-4 border border-slate-200/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-2 -top-2 opacity-10 transition-transform group-hover:scale-110">
                      <Clock className="h-12 w-12 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último</p>
                    <p className="text-sm font-black text-slate-700 mt-1 uppercase">
                      {extratoData[0] ? new Date(extratoData[0].extractedAt).toLocaleDateString("pt-BR") : "—"}
                    </p>
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-slate-200/60 overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] font-black uppercase tracking-widest text-slate-400 text-left bg-slate-50/50">
                        <th className="px-4 py-3.5">Data</th>
                        <th className="px-4 py-3.5">Mês</th>
                        <th className="px-4 py-3.5 text-right">Valor</th>
                        <th className="px-4 py-3.5 text-center">Situação</th>
                        <th className="px-4 py-3.5 text-center">PDF</th>
                        {isAllowedToDelete && <th className="px-4 py-3.5 text-center">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extratoData.map((r) => {
                        // Lógica: mês anterior à data corrente (ou extração)
                        const prevMonthDate = new Date()
                        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
                        const mesAnterior = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long' })

                        return (
                          <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900 leading-none">
                                  {new Date(r.extractedAt).toLocaleDateString("pt-BR")}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium mt-1 uppercase tracking-tight truncate max-w-[150px]">
                                  {r.fileName || r.generatedAt || "Comprovante"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs font-black text-blue-600 uppercase tracking-tight">
                                {mesAnterior}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-black text-slate-900 text-right whitespace-nowrap">
                              {r.amount != null ? fmtBRL(r.amount) : "—"}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border-2 ${
                                r.situacao.includes("LIBERAD") || r.situacao === "PAGO"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : r.situacao === "PENDENTE"
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : "bg-slate-50 text-slate-500 border-slate-100"
                              }`}>
                                {r.situacao}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {r.fileUrl ? (
                                  <>
                                    <a
                                      href={r.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                                      title="Visualizar Comprovante"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-300 font-medium">—</span>
                                )}
                              </div>
                            </td>
                            {isAllowedToDelete && (
                              <td className="px-4 py-4 text-center">
                                <button
                                  onClick={() => handleDeleteComprovante(r.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100 shadow-sm"
                                  title="Excluir Registro"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Upload Manual Comprovante ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-500" /> Enviar Comprovante
            </DialogTitle>
            {extratoEmployee && (
              <p className="text-xs text-slate-400 mt-1">{extratoEmployee.name}</p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Arquivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Arquivo PDF</Label>
              <div
                onClick={() => uploadInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
              >
                <FileText className="h-7 w-7 text-slate-300" />
                {uploadFile ? (
                  <span className="text-xs font-semibold text-blue-600 text-center break-all">{uploadFile.name}</span>
                ) : (
                  <span className="text-xs text-slate-400">Clique para selecionar PDF</span>
                )}
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <p className="text-xs text-slate-400 text-center">O CPF, valor e situação serão extraídos automaticamente do PDF.</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleUploadComprovante}
              disabled={uploadLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Form Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20">
                {editing ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </div>
              <span className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {editing ? "Editar Funcionário" : "Novo Funcionário"}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-8">
              {/* Seção: Informações Pessoais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Informações Pessoais</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome completo *</Label>
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} required 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CPF</Label>
                    <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data de Nascimento / Aniversário</Label>
                    <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Telefone</Label>
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome da Mãe</Label>
                    <Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                </div>
              </div>

              {/* Seção: Contrato e Cargo */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Contrato e Cargo</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo</Label>
                    <Input value={form.position} onChange={(e) => set("position", e.target.value)} 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Salário (R$) *</Label>
                    <Input type="number" step="0.01" value={form.salary} onChange={(e) => set("salary", e.target.value)} required 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-bold text-blue-600" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data de admissão</Label>
                    <Input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} 
                      className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unidade</Label>
                    <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                      <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {flattenTree(buildTree(departments as any)).map((d) => (
                          <SelectItem key={d.id} value={d.id}>{"  ".repeat(d.depth)}{d.depth > 0 ? "↳ " : ""}{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</Label>
                    <Select value={form.status} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Ativo</SelectItem>
                        <SelectItem value="INACTIVE">Inativo</SelectItem>
                        <SelectItem value="ON_LEAVE">Afastado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Situação de Pagamento</Label>
                    <Select value={form.pagamento} onValueChange={(v) => set("pagamento", v)}>
                      <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">PENDENTE</SelectItem>
                        <SelectItem value="efetuado">EFETUADO</SelectItem>
                        <SelectItem value="pago">PAGO</SelectItem>
                        <SelectItem value="atrasado">ATRASADO</SelectItem>
                        <SelectItem value="lancado">LANÇADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Seção: Dados Bancários / PIX */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Landmark className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Dados Bancários / PIX</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Banco</Label>
                    <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="Ex: NUBANK, ITAÚ, BRADESCO" 
                      className="h-11 bg-white border-slate-200 transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Agência</Label>
                    <Input value={form.bankAgency} onChange={(e) => set("bankAgency", e.target.value)} placeholder="0001" 
                      className="h-11 bg-white border-slate-200 transition-all font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conta com Dígito</Label>
                    <Input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} placeholder="12345-6" 
                      className="h-11 bg-white border-slate-200 transition-all font-medium" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chave PIX</Label>
                    <Input value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} placeholder="CPF, E-MAIL, CELULAR OU CHAVE ALEATÓRIA" 
                      className="h-11 bg-white border-slate-200 transition-all font-medium" />
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="bg-slate-50 p-6 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 px-8 font-bold uppercase text-[10px] tracking-widest">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="h-11 px-12 bg-blue-600 hover:bg-blue-700 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20">
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SALVANDO...</>
                ) : (
                  "SALVAR ALTERAÇÕES"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
          <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                    <FileUp className="h-4 w-4 text-white" />
                  </div>
                  IMPORTAR FUNCIONÁRIOS
                </DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-10">
                  Selecione a unidade pai e valide os dados antes de confirmar
                </p>
              </div>
              {importRows.length > 0 && (
                <div className="flex items-center gap-2 mr-8">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    {importRows.filter(r => r.departmentId).length}/{importRows.length} mapeados
                  </span>
                  {importRows.some(r => !r.departmentId) && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                      {importRows.filter(r => !r.departmentId).length} sem unidade
                    </span>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
            {/* Drop zone */}
            {!importFile ? (
              <div
                onDrop={onImportDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => importInputRef.current?.click()}
                className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"}`}
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
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-3.5 shadow-sm transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-bold text-slate-800">{importFile.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{importRows.length} registro{importRows.length !== 1 ? "s" : ""} detectado{importRows.length !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => { setImportFile(null); setImportRows([]); setImportHeaders([]); setImportGlobalParent(""); setImportGlobalSubDept(""); invalidateValidation() }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Detected columns */}
            {importHeaders.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Colunas Detectadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {importHeaders.map((h, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Global unit mapping ── */}
            {importRows.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
                    <Briefcase className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Aplicar Unidade a Todos</p>
                    <p className="text-[10px] text-slate-500">Selecione a unidade pai e os departamentos serão mapeados automaticamente pelos nomes da planilha</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Unidade Principal</p>
                      <button
                        type="button"
                        onClick={handleCreateNewPrincipalUnit}
                        className="text-[9px] font-black text-blue-600 hover:text-blue-700 hover:underline uppercase transition-all"
                      >
                        + Criar Nova
                      </button>
                    </div>
                    <Select
                      value={importGlobalParent || "none"}
                      onValueChange={(val) => { setImportGlobalParent(val === "none" ? "" : val); setImportGlobalSubDept("") }}
                    >
                      <SelectTrigger className="h-9 text-xs font-medium bg-white border-slate-200">
                        <SelectValue placeholder="Selecionar unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-slate-400 italic text-xs">Nenhuma</SelectItem>
                        {importPrincipalDepts.map((d) => (
                          <SelectItem key={d.id} value={d.id} className="text-sm font-medium">{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sub-departamento (padrão)</p>
                      {importGlobalParent && (
                        <button
                          type="button"
                          onClick={handleCreateNewSubDept}
                          className="text-[9px] font-black text-blue-600 hover:text-blue-700 hover:underline uppercase transition-all"
                        >
                          + Novo Depto
                        </button>
                      )}
                    </div>
                    <Select
                      value={importGlobalSubDept || "none"}
                      onValueChange={(val) => setImportGlobalSubDept(val === "none" ? "" : val)}
                      disabled={!importGlobalParent || importSubDepts.length === 0}
                    >
                      <SelectTrigger className="h-9 text-xs font-medium bg-white border-slate-200 disabled:opacity-50">
                        <SelectValue placeholder={importSubDepts.length === 0 ? "Sem sub-departamentos" : "Usar se não encontrar match..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-slate-400 italic text-xs">Usar unidade principal como padrão</SelectItem>
                        {importSubDepts.map((d) => (
                          <SelectItem key={d.id} value={d.id} className="text-sm font-medium">{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleApplyGlobalUnit}
                  disabled={!importGlobalParent}
                  className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-xs font-black uppercase tracking-wider gap-2"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mapear Automaticamente pelos Departamentos Existentes
                </Button>
              </div>
            )}

            {/* ── Validation ── */}
            {importRows.length > 0 && (
              <div className="space-y-2">
                {!validationDone ? (
                  <button
                    onClick={handleValidate}
                    disabled={isValidating}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-all disabled:opacity-60"
                  >
                    {isValidating ? <><Loader2 className="h-4 w-4 animate-spin" /> VERIFICANDO DIVERGÊNCIAS...</> : <><AlertCircle className="h-4 w-4" /> VERIFICAR DIVERGÊNCIAS ANTES DE IMPORTAR</>}
                  </button>
                ) : (() => {
                  const errorCount = [...rowIssues.values()].filter(iss => iss.some(i => i.severity === "error")).length
                  const warnCount = [...rowIssues.values()].filter(iss => iss.every(i => i.severity === "warning")).length
                  const okCount = importRows.length - rowIssues.size
                  return (
                    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap ${errorCount > 0 ? "border-red-200 bg-red-50" : warnCount > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className="flex-1 flex flex-wrap gap-2 items-center">
                        {errorCount > 0 && <span className="text-xs font-black text-red-700 bg-red-100 border border-red-200 rounded-full px-3 py-1">{errorCount} erro{errorCount > 1 ? "s" : ""} crítico{errorCount > 1 ? "s" : ""}</span>}
                        {warnCount > 0 && <span className="text-xs font-black text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-3 py-1">{warnCount} aviso{warnCount > 1 ? "s" : ""}</span>}
                        {okCount > 0 && <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-3 py-1">{okCount} sem problemas</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={downloadErrorRows} className="flex items-center gap-1.5 text-xs font-black text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-all">
                          <FileDown className="h-3.5 w-3.5" /> Baixar planilha
                        </button>
                        {conflictCpfs.length > 0 && (
                          <button onClick={() => setDeleteConflictOpen(true)} className="flex items-center gap-1.5 text-xs font-black text-red-700 bg-white border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-600 hover:text-white transition-all">
                            <Trash2 className="h-3.5 w-3.5" /> Excluir {conflictCpfs.length} do banco
                          </button>
                        )}
                        {errorCount > 0 && (
                          <button onClick={removeAllErrorRows} className="text-xs font-black text-red-700 bg-white border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-600 hover:text-white transition-all">
                            Remover {errorCount} da lista
                          </button>
                        )}
                        <button onClick={handleValidate} disabled={isValidating} className="text-xs font-black text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-all">
                          {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reverificar"}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Preview table */}
            {importRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">
                        <th className="px-4 py-3 w-[28%]">NOME / CARGO</th>
                        <th className="px-4 py-3 w-[12%]">CPF</th>
                        <th className="px-4 py-3 w-[22%]">UNIDADE</th>
                        <th className="px-4 py-3 w-[22%]">DEPARTAMENTO</th>
                        <th className="px-4 py-3 w-[12%] text-right">SALÁRIO</th>
                        <th className="px-2 py-3 w-[4%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {importRows.map((r, i) => {
                        const issues = rowIssues.get(i) ?? []
                        const hasError = issues.some(iss => iss.severity === "error")
                        const hasWarn = issues.some(iss => iss.severity === "warning")
                        const rowCls = hasError
                          ? "bg-red-50/60 hover:bg-red-50"
                          : hasWarn
                          ? "bg-amber-50/40 hover:bg-amber-50/60"
                          : "hover:bg-slate-50/50"

                        const currentDept = departments.find(d => d.id === r.departmentId)
                        const isSub = !!(currentDept && currentDept.parentId)
                        const principalId = (isSub ? currentDept?.parentId : r.departmentId) || "missing"
                        const subDeptId = (isSub ? r.departmentId : "none") || "none"

                        const availableSubDepts = principalId !== "missing"
                          ? departments.filter(d => d.parentId === principalId)
                          : []

                        return (
                        <tr key={i} className={`transition-colors ${rowCls}`}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 text-sm leading-tight">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{r.position?.split(' ').slice(0, 3).join(' ') || "—"}</p>
                            {(r.birthDate || r.motherName) && (
                              <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                                {r.birthDate ? `Nasc: ${fmtDate(r.birthDate)}` : ""}
                                {r.birthDate && r.motherName ? " · " : ""}
                                {r.motherName ? `Mãe: ${r.motherName}` : ""}
                              </p>
                            )}
                            {issues.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {issues.map((iss, j) => (
                                  <span key={j} className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${iss.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    {iss.severity === "error" ? "✕" : "!"} {iss.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{fmtCpf(r.cpf ?? null)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={principalId}
                                onValueChange={(val) => {
                                  const next = [...importRows]
                                  next[i] = { ...next[i], departmentId: val === "missing" ? undefined : val }
                                  setImportRows(next)
                                  invalidateValidation()
                                }}
                              >
                                <SelectTrigger className={`h-8 text-xs font-medium transition-all ${principalId === "missing" ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-white border-slate-200 text-slate-700"}`}>
                                  <SelectValue placeholder="Unidade..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="missing" disabled className="text-slate-400 italic text-xs">Unidade...</SelectItem>
                                  {importPrincipalDepts.map((parent) => (
                                    <SelectItem key={parent.id} value={parent.id} className="text-xs font-semibold text-slate-700">{parent.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {r.unidade && !r.departmentId && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span className="truncate">Planilha: &quot;{r.unidade}&quot; (Criará)</span>
                                </div>
                              )}
                              {r.unidade && r.departmentId && (
                                <p className="text-[10px] text-emerald-600 font-semibold truncate">✓ &quot;{r.unidade}&quot;</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={subDeptId}
                                onValueChange={(val) => {
                                  const next = [...importRows]
                                  next[i] = { ...next[i], departmentId: val === "none" ? (principalId === "missing" ? undefined : principalId) : val }
                                  setImportRows(next)
                                  invalidateValidation()
                                }}
                                disabled={principalId === "missing"}
                              >
                                <SelectTrigger className="h-8 text-xs font-medium bg-white border-slate-200 text-slate-700 disabled:opacity-50">
                                  <SelectValue placeholder="Nenhum (unidade principal)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-slate-400 italic text-xs">Nenhum (unidade principal)</SelectItem>
                                  {availableSubDepts.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs text-slate-600">{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {r.departamento && !r.departmentId && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span className="truncate">Planilha: &quot;{r.departamento}&quot; (Criará)</span>
                                </div>
                              )}
                              {r.departamento && r.departmentId && isSub && (
                                <p className="text-[10px] text-emerald-600 font-semibold truncate">✓ &quot;{r.departamento}&quot;</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className={`font-black text-sm ${hasError ? "text-red-400 line-through" : "text-slate-900"}`}>{fmtBRL(r.salary ?? 0)}</p>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => removeImportRow(i)}
                              className="rounded-md p-1 text-slate-300 hover:bg-red-100 hover:text-red-600 transition-all"
                              title="Remover linha"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importRows.length === 0 && importFile && (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-amber-200 bg-amber-50 text-center">
                <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
                <p className="text-xs font-black text-amber-900 uppercase tracking-widest">NENHUM FUNCIONÁRIO DETECTADO</p>
                <p className="mt-2 text-[10px] text-amber-700 font-bold max-w-xs mx-auto uppercase tracking-wider leading-relaxed px-4">
                  CERTIFIQUE-SE DE QUE A PLANILHA TEM UMA COLUNA CHAMADA &quot;NOME&quot; PARA IDENTIFICARMOS OS COLABORADORES.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-200 shrink-0 flex items-center justify-between">
            <div className="text-xs font-semibold">
              {validationDone && [...rowIssues.values()].some(iss => iss.some(i => i.severity === "error")) ? (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Resolva os erros críticos de validação para habilitar a importação
                </span>
              ) : importRows.length > 0 ? (
                <span className="text-slate-400 font-medium">{importRows.filter(r => !r.departmentId).length > 0
                  ? `⚠ ${importRows.filter(r => !r.departmentId).length} funcionário${importRows.filter(r => !r.departmentId).length > 1 ? "s" : ""} sem unidade definida`
                  : "✓ Todos os funcionários têm unidade definida"
                }</span>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setImportOpen(false)} className="text-slate-500 font-black uppercase text-xs tracking-widest">CANCELAR</Button>
              <Button
                onClick={handleConfirmImport}
                disabled={importRows.length === 0 || isImporting || (validationDone && [...rowIssues.values()].some(iss => iss.some(i => i.severity === "error")))}
                className="bg-blue-600 hover:bg-blue-700 gap-2 px-8 shadow-lg shadow-blue-600/20 font-black uppercase text-xs tracking-widest"
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {importProgress ? `${importProgress.done}/${importProgress.total}...` : "PREPARANDO..."}</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> IMPORTAR {importRows.length} {importRows.length === 1 ? 'FUNCIONÁRIO' : 'FUNCIONÁRIOS'}</>
                )}
              </Button>
            </div>
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

      {/* ── Reset Pagamento Confirm ── */}
      <AlertDialog open={resetPagamentoOpen} onOpenChange={setResetPagamentoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar pagamento da unidade?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {!resetPagamentoDept ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Selecione a unidade que terá o pagamento resetado para <strong>PENDENTE</strong>:</p>
                    <Select value={resetPagamentoDept} onValueChange={setResetPagamentoDept}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecionar unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Todos os funcionários de <strong>{departments.find(d => d.id === resetPagamentoDept)?.name}</strong> terão o status de pagamento alterado para <strong>PENDENTE</strong>. Esta ação não pode ser desfeita.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPagamento} disabled={loading || !resetPagamentoDept} className="bg-amber-600 hover:bg-amber-700">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Ativar Todos Confirm ── */}
      <AlertDialog open={reativarTodosOpen} onOpenChange={setReativarTodosOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar todos os funcionários?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os funcionários <strong>inativos</strong> serão alterados para <strong>Ativo</strong>. Funcionários afastados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                setLoading(true)
                try {
                  await reactivateAllEmployees()
                  setReativarTodosOpen(false)
                  router.refresh()
                } catch (err: any) {
                  alert("Erro: " + err.message)
                } finally {
                  setLoading(false)
                }
              }}
            >
              Ativar Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Excluir Sem Unidade Confirm ── */}
      <AlertDialog open={deleteUnassignedOpen} onOpenChange={setDeleteUnassignedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionários sem unidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os funcionários <strong>sem unidade/departamento definido</strong> serão excluídos permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnassigned} disabled={loading} className="bg-red-600 hover:bg-red-700">
              Excluir todos sem unidade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Excluir CPFs conflitantes do banco ── */}
      <AlertDialog open={deleteConflictOpen} onOpenChange={setDeleteConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {conflictCpfs.length} funcionários do banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Esses funcionários estão cadastrados em outra empresa no sistema e estão bloqueando a importação.
              Excluí-los irá <strong>removê-los permanentemente</strong> de qualquer empresa que os contenha.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingConflicts}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConflicts} disabled={isDeletingConflicts} className="bg-red-600 hover:bg-red-700">
              {isDeletingConflicts ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Excluindo...</> : `Excluir ${conflictCpfs.length} funcionários`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
