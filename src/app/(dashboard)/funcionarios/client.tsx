"use client"

import { useState } from "react"
import { UserPlus, Pencil, Trash2, CheckCircle2, AlertCircle, Clock, Filter, CheckSquare, Square } from "lucide-react"
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
import { createEmployee, updateEmployee, deleteEmployee, deleteEmployeesBatch } from "@/lib/actions/employees"

type Department = { id: string; name: string }
type Employee = {
  id: string; name: string; cpf: string | null; email: string | null
  phone: string | null; position: string; salary: number | string
  hireDate: Date; status: string; departmentId: string | null
  department: Department | null
}

const statusMap = {
  ACTIVE: { label: "Ativo", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
  INACTIVE: { label: "Inativo", icon: AlertCircle, cls: "bg-red-100 text-red-700" },
  ON_LEAVE: { label: "Afastado", icon: Clock, cls: "bg-amber-100 text-amber-700" },
}

const empty = {
  name: "", position: "", salary: "", hireDate: "", departmentId: "",
  cpf: "", email: "", phone: "", status: "ACTIVE",
}

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

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

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
      setDeleteId(null)
      setLoading(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setLoading(true)
    try {
      await deleteEmployeesBatch(Array.from(selectedIds))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    if (filterDept !== "all" && emp.departmentId !== filterDept) return false
    return true
  })

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

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Funcionários</h2>
          <p className="text-sm text-slate-500">Cadastro e gerenciamento de colaboradores</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> Excluir Selecionados ({selectedIds.size})
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4" /> Novo Funcionário
          </Button>
        </div>
      </div>

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
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center">
                    {selectedIds.size > 0 && selectedIds.size === filteredEmployees.length ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
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
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.cpf ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{emp.position}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{emp.department?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-800">
                      {Number(emp.salary).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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

      {/* Form Dialog */}
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

      {/* Delete Confirm */}
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
      {/* Bulk Delete Confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionários?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir **{selectedIds.size}** funcionário{selectedIds.size > 1 ? "s" : ""}.
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
