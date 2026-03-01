"use client"

import { useState } from "react"
import { UserPlus, Pencil, Trash2 } from "lucide-react"
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
import { createUser, updateUser, deleteUser } from "@/lib/actions/users"

type User = { id: string; name: string; email: string; role: string; active: boolean }

const roleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  RH: "RH",
  GESTOR: "Gestor",
  FUNCIONARIO: "Funcionário",
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  RH: "bg-blue-100 text-blue-700",
  GESTOR: "bg-indigo-100 text-indigo-700",
  FUNCIONARIO: "bg-slate-100 text-slate-600",
}

const empty = { name: "", email: "", password: "", role: "RH", active: true }

export function UsuariosClient({
  users, currentUserId,
}: { users: User[]; currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    setForm({ name: user.name, email: user.email, password: "", role: user.role, active: user.active })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await updateUser(editing.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        })
      } else {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role })
      }
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setLoading(true)
    try { await deleteUser(deleteId) } finally {
      setDeleteId(null)
      setLoading(false)
    }
  }

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Usuários de Acesso</h2>
          <p className="text-sm text-slate-500">Gerenciamento de usuários e permissões</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <UserPlus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{user.name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{user.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {roleLabel[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(user)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {user.id !== currentUserId && (
                        <button onClick={() => setDeleteId(user.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? "Nova senha (deixe em branco para manter)" : "Senha *"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required={!editing}
                placeholder={editing ? "••••••••" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de acesso *</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="RH">RH</SelectItem>
                  <SelectItem value="GESTOR">Gestor</SelectItem>
                  <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="userActive">Usuário ativo</Label>
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
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>O acesso ao sistema será removido. Esta ação não pode ser desfeita.</AlertDialogDescription>
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
