"use client"

import { useState } from "react"
import {
    Plus, Building2, Users, Trash2, Edit2, ToggleLeft, ToggleRight,
    Search, Loader2, CheckCircle2, XCircle, LogOut, X, Landmark,
} from "lucide-react"
import {
    createCompany, updateCompany, toggleCompanyActive, deleteCompany,
    adminLogout, type CompanyInput,
} from "@/lib/actions/admin"
import { useRouter } from "next/navigation"

type Company = {
    id: string
    name: string
    cnpj: string | null
    email: string | null
    whatsapp: string | null
    address: string | null
    city: string | null
    state: string | null
    active: boolean
    createdAt: Date
    _count: { users: number; employees: number }
}

const emptyForm: CompanyInput = { name: "", cnpj: "", email: "", whatsapp: "", address: "", city: "", state: "" }
const emptyUser = { name: "", email: "", password: "" }

export function AdminClient({ initialCompanies }: { initialCompanies: Company[] }) {
    const router = useRouter()
    const [companies, setCompanies] = useState<Company[]>(initialCompanies)
    const [search, setSearch] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<CompanyInput>(emptyForm)
    const [userForm, setUserForm] = useState(emptyUser)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cnpj ?? "").includes(search) ||
        (c.city ?? "").toLowerCase().includes(search.toLowerCase())
    )

    function openCreate() {
        setEditingId(null)
        setForm(emptyForm)
        setUserForm(emptyUser)
        setError(null)
        setIsDialogOpen(true)
    }

    function openEdit(c: Company) {
        setEditingId(c.id)
        setForm({ name: c.name, cnpj: c.cnpj ?? "", email: c.email ?? "", whatsapp: c.whatsapp ?? "", address: c.address ?? "", city: c.city ?? "", state: c.state ?? "" })
        setUserForm(emptyUser)
        setError(null)
        setIsDialogOpen(true)
    }

    async function handleSave() {
        if (!form.name.trim()) { setError("Nome da empresa é obrigatório."); return }
        if (!editingId && (!userForm.name || !userForm.email || !userForm.password)) {
            setError("Preencha os dados do usuário administrador.")
            return
        }
        setSaving(true)
        setError(null)
        try {
            if (editingId) {
                const updated = await updateCompany(editingId, form) as any
                setCompanies(cs => cs.map(c => c.id === editingId ? { ...c, ...updated } : c))
            } else {
                const created = await createCompany(form, userForm) as any
                setCompanies(cs => [{ ...created, _count: { users: 1, employees: 0 } }, ...cs])
            }
            setIsDialogOpen(false)
        } catch (e: any) {
            setError(e.message ?? "Erro ao salvar.")
        } finally {
            setSaving(false)
        }
    }

    async function handleToggle(id: string, active: boolean) {
        await toggleCompanyActive(id, !active)
        setCompanies(cs => cs.map(c => c.id === id ? { ...c, active: !active } : c))
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Excluir a empresa "${name}"? Esta ação não pode ser desfeita.`)) return
        await deleteCompany(id)
        setCompanies(cs => cs.filter(c => c.id !== id))
    }

    async function handleLogout() {
        await adminLogout()
        router.push("/admin/login")
    }

    function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
        return (
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <header className="sticky top-0 z-10 bg-[#152138] border-b border-white/10 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                            <Landmark className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white uppercase tracking-wider">PEPACORP</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Administração</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> Sair
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Page header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Empresas Cadastradas</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{companies.length} empresa{companies.length !== 1 ? "s" : ""} no sistema</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Nova Empresa
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, CNPJ ou cidade..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                </div>

                {/* Companies grid */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Building2 className="h-12 w-12 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Nenhuma empresa encontrada</p>
                        <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline font-medium">
                            Cadastrar primeira empresa
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map(c => (
                            <div key={c.id} className={`rounded-xl border bg-white shadow-sm p-5 space-y-4 transition-opacity ${c.active ? "" : "opacity-60"}`}>
                                {/* Company header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                                            <Building2 className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 truncate">{c.name}</p>
                                            {c.cnpj && <p className="text-xs text-slate-400 font-mono">{c.cnpj}</p>}
                                        </div>
                                    </div>
                                    {c.active
                                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                        : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                    }
                                </div>

                                {/* Info */}
                                <div className="space-y-1 text-xs text-slate-500">
                                    {c.email && <p>✉ {c.email}</p>}
                                    {c.whatsapp && <p>📱 {c.whatsapp}</p>}
                                    {c.city && <p>📍 {c.city}{c.state ? `, ${c.state}` : ""}</p>}
                                </div>

                                {/* Stats */}
                                <div className="flex gap-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        <span><strong className="text-slate-700">{c._count.users}</strong> usuários</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        <span><strong className="text-slate-700">{c._count.employees}</strong> funcionários</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                                    <button
                                        onClick={() => openEdit(c)}
                                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" /> Editar
                                    </button>
                                    <button
                                        onClick={() => handleToggle(c.id, c.active)}
                                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        {c.active
                                            ? <><ToggleRight className="h-3.5 w-3.5 text-emerald-500" /> Desativar</>
                                            : <><ToggleLeft className="h-3.5 w-3.5 text-slate-400" /> Ativar</>
                                        }
                                    </button>
                                    <button
                                        onClick={() => handleDelete(c.id, c.name)}
                                        className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Dialog ── */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="font-bold text-slate-800 text-lg">
                                {editingId ? "Editar Empresa" : "Nova Empresa"}
                            </h2>
                            <button onClick={() => setIsDialogOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Company fields */}
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Dados da Empresa</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <Field label="Nome da empresa *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Razão Social" />
                                </div>
                                <Field label="CNPJ" value={form.cnpj ?? ""} onChange={v => setForm(f => ({ ...f, cnpj: v }))} placeholder="00.000.000/0000-00" />
                                <Field label="E-mail" value={form.email ?? ""} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="contato@empresa.com" />
                                <Field label="WhatsApp" value={form.whatsapp ?? ""} onChange={v => setForm(f => ({ ...f, whatsapp: v }))} placeholder="(00) 00000-0000" />
                                <div className="col-span-2">
                                    <Field label="Endereço" value={form.address ?? ""} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Rua, número, bairro" />
                                </div>
                                <Field label="Cidade" value={form.city ?? ""} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Cidade" />
                                <Field label="Estado" value={form.state ?? ""} onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="SP" />
                            </div>

                            {/* Admin user fields - only for create */}
                            {!editingId && (
                                <>
                                    <div className="border-t pt-4">
                                        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Usuário Administrador</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <Field label="Nome completo *" value={userForm.name} onChange={v => setUserForm(f => ({ ...f, name: v }))} placeholder="Nome do admin" />
                                            </div>
                                            <Field label="E-mail *" value={userForm.email} onChange={v => setUserForm(f => ({ ...f, email: v }))} type="email" placeholder="admin@empresa.com" />
                                            <Field label="Senha *" value={userForm.password} onChange={v => setUserForm(f => ({ ...f, password: v }))} type="password" placeholder="Senha de acesso" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                                    <p className="text-sm font-medium text-red-700">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
                            <button
                                onClick={() => setIsDialogOpen(false)}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editingId ? "Salvar alterações" : "Cadastrar empresa"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
