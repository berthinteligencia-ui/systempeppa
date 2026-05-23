"use client"

import { useState, useMemo, Fragment } from "react"
import {
  Plus, Pencil, Trash2, Building2, FileSpreadsheet, Search,
  Power, RotateCcw, ChevronDown, ChevronRight, FolderOpen, Folder, Crown,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createDepartment, updateDepartment, deleteDepartment, toggleDepartmentStatus,
} from "@/lib/actions/departments"
import { buildTree, flattenTree, type DeptRow } from "@/lib/utils/departments"
import { resetDepartmentPaymentStatus, deleteUnassignedEmployees } from "@/lib/actions/employees"

type Props = { departments: DeptRow[]; userRole?: string }

export function UnidadesClient({ departments, userRole }: Props) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")
  const [resetDept, setResetDept] = useState<DeptRow | null>(null)
  const [editing, setEditing] = useState<DeptRow | null>(null)
  const [name, setName] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [nivel, setNivel] = useState<string>("SUBUNIDADE")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deletingUnassigned, setDeletingUnassigned] = useState(false)

  async function handleDeleteUnassigned() {
    if (!confirm("Excluir todos os funcionários sem unidade? Esta ação não pode ser desfeita.")) return
    setDeletingUnassigned(true)
    try {
      const { deleted } = await deleteUnassignedEmployees()
      alert(`${deleted} funcionário(s) excluído(s).`)
    } catch (err: any) {
      alert("Erro: " + err.message)
    } finally {
      setDeletingUnassigned(false)
    }
  }

  // Build tree and flat list for indent-select
  const tree = useMemo(() => buildTree(departments), [departments])
  const flatList = useMemo(() => flattenTree(tree), [tree])

  // For search: show matching items (parents expanded)
  const filteredFlat = useMemo(() => {
    if (!search) return flatList
    const q = search.toLowerCase()
    const matchIds = new Set(departments.filter(d =>
      d.name.toLowerCase().includes(q) || (d.cnpj ?? "").includes(q)
    ).map(d => d.id))
    // Also include ancestors of matched items so context is visible
    departments.forEach(d => {
      if (matchIds.has(d.id) && d.parentId) matchIds.add(d.parentId)
    })
    return flatList.filter(d => matchIds.has(d.id))
  }, [search, flatList, departments])

  // Toggle expand/collapse group
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) {
        s.delete(id)
      } else {
        s.add(id)
      }
      return s
    })
  }

  // Visible rows respecting expand state (when not searching)
  const visibleRows = useMemo(() => {
    if (search) return filteredFlat
    return flatList.filter(row => {
      if (row.depth === 0) return true
      // Walk ancestors — all must be expanded
      let cur: DeptRow | undefined = departments.find(d => d.id === row.id)
      while (cur?.parentId) {
        if (!expanded.has(cur.parentId)) return false
        cur = departments.find(d => d.id === cur!.parentId!)
      }
      return true
    })
  }, [search, flatList, filteredFlat, expanded, departments])

  function openCreate(preParentId?: string) {
    setEditing(null)
    setName("")
    setCnpj("")
    setParentId(preParentId ?? "")
    setNivel(preParentId ? "SUBUNIDADE" : "SUBUNIDADE")
    setOpen(true)
  }

  function openEdit(dept: DeptRow) {
    setEditing(dept)
    setName(dept.name)
    setCnpj(dept.cnpj ?? "")
    setParentId(dept.parentId ?? "")
    setNivel(dept.nivel ?? "SUBUNIDADE")
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        cnpj: cnpj.trim() || undefined,
        parentId: nivel === "PRINCIPAL" ? null : (parentId || null),
        nivel,
      }
      if (editing) {
        await updateDepartment(editing.id, payload)
      } else {
        await createDepartment(payload)
      }
      setOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setLoading(true)
    try { await deleteDepartment(deleteId) }
    catch (err: any) { alert(err.message) }
    finally { setDeleteId(null); setLoading(false) }
  }

  async function handleToggle(dept: DeptRow) {
    setLoading(true)
    try { await toggleDepartmentStatus(dept.id, !dept.active) }
    finally { setLoading(false) }
  }

  async function handleResetPagamento() {
    if (!resetDept) return
    setLoading(true)
    try { await resetDepartmentPaymentStatus(resetDept.id); setResetDept(null) }
    finally { setLoading(false) }
  }

  // Options for parent selector (cannot select self or descendants)
  function parentOptions(excludeId?: string) {
    if (!excludeId) return flatList
    const excluded = new Set([excludeId])
    // Mark descendants
    const addDesc = (id: string) => {
      flatList.filter(d => d.parentId === id).forEach(d => {
        excluded.add(d.id)
        addDesc(d.id)
      })
    }
    addDesc(excludeId)
    return flatList.filter(d => !excluded.has(d.id))
  }

  const hasChildren = (id: string) => departments.some(d => d.parentId === id)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Unidades</h2>
          <p className="text-sm text-slate-500">Grupos, cidades, secretarias e departamentos da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDeleteUnassigned}
            disabled={deletingUnassigned}
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            {deletingUnassigned ? "Excluindo..." : "Excluir sem unidade"}
          </Button>
          <Button onClick={() => openCreate()} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nova Unidade
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela hierárquica */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {departments.length === 0 ? "Nenhuma unidade cadastrada." : "Nenhuma unidade encontrada."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Unidade / Grupo</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">CNPJ</th>
                <th className="px-5 py-3 text-center">Colaboradores</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map(dept => {
                const isGroup = hasChildren(dept.id)
                const isExpanded = expanded.has(dept.id)
                const indent = dept.depth * 24
                const isPrincipal = (dept.nivel ?? "SUBUNIDADE") === "PRINCIPAL"

                return (
                  <tr
                    key={dept.id}
                    className={`transition-colors ${!dept.active ? "opacity-60" : ""} ${
                      isPrincipal ? "bg-indigo-50/40" : "hover:bg-slate-50"
                    }`}
                  >
                    {/* Nome com indentação e expand toggle */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
                        {isGroup ? (
                          <button
                            onClick={() => toggleExpand(dept.id)}
                            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}

                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isPrincipal
                            ? "bg-indigo-100"
                            : dept.active ? "bg-blue-100" : "bg-slate-100"
                        }`}>
                          {isPrincipal
                            ? (isGroup
                              ? (isExpanded
                                ? <FolderOpen className="h-4 w-4 text-indigo-600" />
                                : <Folder className="h-4 w-4 text-indigo-600" />)
                              : <Crown className="h-4 w-4 text-indigo-600" />)
                            : <Building2 className={`h-4 w-4 ${dept.active ? "text-blue-600" : "text-slate-400"}`} />
                          }
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${dept.active ? "text-slate-800" : "text-slate-500 line-through"} ${
                              isPrincipal ? "font-semibold text-slate-900" : ""
                            }`}>
                              {dept.name}
                            </span>
                            {isPrincipal && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                <Crown className="h-2.5 w-2.5" /> Principal
                              </span>
                            )}
                            {isPrincipal && isGroup && (
                              <span className="text-[10px] text-indigo-400 font-medium">
                                {departments.filter(d => d.parentId === dept.id).length} sub
                              </span>
                            )}
                          </div>
                          {!isPrincipal && dept.parentId && (
                            <p className="text-[10px] text-slate-400">
                              {departments.find(d => d.id === dept.parentId)?.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        dept.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {dept.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-500">
                      {dept.cnpj || <span className="text-slate-300">—</span>}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-500">
                      {dept._count.employees}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Add sub-unit button for group or root items */}
                        <button
                          onClick={() => openCreate(dept.id)}
                          className="rounded p-1.5 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Adicionar sub-unidade"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>

                        <Link
                          href={`/folha-pagamento?unidadeId=${dept.id}&action=history`}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                          title="Fechamentos desta unidade"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" /> FECHAMENTOS
                        </Link>

                        <button
                          onClick={() => setResetDept(dept)}
                          disabled={loading}
                          className="rounded p-1.5 text-amber-500 hover:bg-amber-50 transition-colors"
                          title="Resetar pagamento para PENDENTE"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggle(dept)}
                          disabled={loading}
                          className={`rounded p-1.5 transition-colors ${
                            dept.active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                          }`}
                          title={dept.active ? "Desativar" : "Ativar"}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => openEdit(dept)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {userRole?.toUpperCase() === "ADMIN" && (
                          <button
                            onClick={() => { setDeleteId(dept.id); setDeleteName(dept.name) }}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Tipo da unidade */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo de Unidade *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setNivel("PRINCIPAL"); setParentId("") }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    nivel === "PRINCIPAL"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  <Crown className="h-4 w-4" /> Principal
                </button>
                <button
                  type="button"
                  onClick={() => setNivel("SUBUNIDADE")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    nivel === "SUBUNIDADE"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  <Building2 className="h-4 w-4" /> Sub-unidade
                </button>
              </div>
              {nivel === "PRINCIPAL" && (
                <p className="text-[11px] text-indigo-500 font-medium">
                  Unidades Principais ficam sempre na raiz — não podem ter unidade pai.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Secretaria de Saúde, Grupo Norte..."
                required
                autoFocus
              />
            </div>

            {nivel === "SUBUNIDADE" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Unidade pai
                  <span className="ml-1 text-slate-300 font-normal normal-case">(opcional)</span>
                </label>
                <Select
                  value={parentId || "__none__"}
                  onValueChange={v => setParentId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— Nenhum (raiz) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" textValue="Nenhum (raiz)">
                      <span className="text-slate-400 italic">— Nenhum (raiz) —</span>
                    </SelectItem>
                    {parentOptions(editing?.id).map(opt => (
                      <SelectItem key={opt.id} value={opt.id} textValue={opt.name}>
                        {opt.depth === 0 ? (
                          <div className="flex items-center gap-2 py-0.5">
                            <Crown className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                            <span className="font-bold text-indigo-800">{opt.name}</span>
                            <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                              Principal
                            </span>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 py-0.5"
                            style={{ paddingLeft: (opt.depth - 1) * 16 + 12 }}
                          >
                            <span className="text-slate-400 text-xs">↳</span>
                            <span className="text-slate-700">{opt.name}</span>
                          </div>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  Selecione para criar como sub-grupo de uma unidade existente.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                CNPJ
                <span className="ml-1 text-slate-300 font-normal normal-case">(opcional)</span>
              </label>
              <Input
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{deleteName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Sub-unidades desta serão movidas para a raiz. Funcionários e fechamentos vinculados serão mantidos.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar reset pagamento */}
      <AlertDialog open={!!resetDept} onOpenChange={open => !open && setResetDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar pagamentos de &quot;{resetDept?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os colaboradores desta unidade terão a situação de pagamento resetada para PENDENTE.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPagamento} className="bg-amber-600 hover:bg-amber-700">
              Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
