"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Building2, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createDepartment, updateDepartment, deleteDepartment } from "@/lib/actions/departments"

type Department = { id: string; name: string; _count: { employees: number } }

export function UnidadesClient({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Department | null>(null)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  function openCreate() {
    setEditing(null)
    setName("")
    setOpen(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept)
    setName(dept.name)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await updateDepartment(editing.id, { name })
      } else {
        await createDepartment({ name })
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {departments.length === 0 && (
          <div className="col-span-3 rounded-xl border bg-white p-10 text-center text-sm text-slate-400">
            Nenhuma unidade cadastrada.
          </div>
        )}
        {departments.map((dept) => (
          <div key={dept.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{dept.name}</p>
                  <p className="text-xs text-slate-400">{dept._count.employees} colaboradores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/folha-pagamento?unidadeId=${dept.id}&action=history`}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100"
                  title="Abrir fechamentos desta unidade"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  FECHAMENTOS
                </Link>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(dept)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar unidade">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteId(dept.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir unidade">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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
