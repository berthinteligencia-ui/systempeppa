"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Building2, FileSpreadsheet, Search } from "lucide-react"
import Link from "next/link"
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
import { createDepartment, updateDepartment, deleteDepartment } from "@/lib/actions/departments"

type Department = { id: string; name: string; cnpj?: string | null; _count: { employees: number } }

export function UnidadesClient({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const filtered = departments.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.cnpj ?? "").includes(search)
  )

  function openCreate() {
    setEditing(null)
    setName("")
    setCnpj("")
    setOpen(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept)
    setName(dept.name)
    setCnpj(dept.cnpj ?? "")
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await updateDepartment(editing.id, { name, cnpj: cnpj || undefined })
      } else {
        await createDepartment({ name, cnpj: cnpj || undefined })
      }
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setLoading(true)
    try { await deleteDepartment(deleteId) } finally {
      setDeleteId(null)
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Unidades</h2>
          <p className="text-sm text-slate-500">Centros de custo e departamentos da empresa</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nova Unidade
        </Button>
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

      {/* Tabela */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
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
                <th className="px-5 py-3">Unidade</th>
                <th className="px-5 py-3">CNPJ</th>
                <th className="px-5 py-3 text-center">Colaboradores</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(dept => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-slate-800">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {dept.cnpj || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-500">
                    {dept._count.employees}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/folha-pagamento?unidadeId=${dept.id}&action=history`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                        title="Fechamentos desta unidade"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> FECHAMENTOS
                      </Link>
                      <button
                        onClick={() => openEdit(dept)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(dept.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {filtered.length} unidade{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da unidade *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Tecnologia e Inovação" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir unidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Funcionários vinculados ficarão sem unidade. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
