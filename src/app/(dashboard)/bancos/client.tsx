"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
import { createBank, updateBank, deleteBank } from "@/lib/actions/banks"

type Bank = { id: string; name: string; code: string; active: boolean }

const empty = { name: "", code: "", active: true }

export function BancosClient({ banks }: { banks: Bank[] }) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Bank | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(bank: Bank) {
    setEditing(bank)
    setForm({ name: bank.name, code: bank.code, active: bank.active })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await updateBank(editing.id, form)
      } else {
        await createBank({ name: form.name, code: form.code })
      }
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setLoading(true)
    try { await deleteBank(deleteId) } finally {
      setDeleteId(null)
      setLoading(false)
    }
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Bancos</h2>
          <p className="text-sm text-slate-500">Tabela de instituições bancárias</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Novo Banco
        </Button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {banks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                    Nenhum banco cadastrado.
                  </td>
                </tr>
              )}
              {banks.map((bank) => (
                <tr key={bank.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-700">
                      {bank.code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{bank.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bank.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {bank.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(bank)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(bank.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Banco" : "Novo Banco"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Código BACEN *</Label>
              <Input value={form.code} onChange={(e) => set("code", e.target.value)} required placeholder="Ex: 001" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do banco *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Ex: Banco do Brasil" />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="active">Ativo</Label>
              </div>
            )}
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
            <AlertDialogTitle>Excluir banco?</AlertDialogTitle>
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
    </>
  )
}
