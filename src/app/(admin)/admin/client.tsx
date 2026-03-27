"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    Search, Plus, Landmark, LogOut, Building2, Users, Edit2, Trash2,
    ToggleLeft, ToggleRight, CheckCircle2, XCircle, X, Copy, Check, Loader2,
    CreditCard, FileText, Settings, DollarSign, FileUp
} from "lucide-react"
import {
    deleteCompany, toggleCompanyActive, updateCompany, createCompany,
    getCompanyAdmin, updateCompanyAdmin, adminLogout, extractCompanyData, type CompanyInput,
} from "@/lib/actions/admin"
import {
    getPlans, createPlan, updatePlan, deletePlan,
    updateCompanySubscription, getCompanySubscription,
    getAllInvoices, updateInvoiceStatus, generateInvoicesForMonth
} from "@/lib/actions/billing"
import { Company } from "@prisma/client"

type CompanyWithCount = Company & { _count: { users: number; employees: number } }

const emptyForm: CompanyInput = { name: "", cnpj: "", email: "", whatsapp: "", address: "", city: "", state: "" }
const emptyUser = { name: "", email: "", password: "" }

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

export function AdminClient({ initialCompanies }: { initialCompanies: CompanyWithCount[] }) {
    const router = useRouter()
    const [companies, setCompanies] = useState<CompanyWithCount[]>(initialCompanies)
    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState<"companies" | "plans" | "finance">("companies")

    // Plans state
    const [plans, setPlans] = useState<any[]>([])
    const [invoices, setInvoices] = useState<any[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)
    const [loadingInvoices, setLoadingInvoices] = useState(false)

    // Form states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<CompanyInput>(emptyForm)
    const [userForm, setUserForm] = useState(emptyUser)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdCreds, setCreatedCreds] = useState<{ name: string; email: string; password: string } | null>(null)
    const [copied, setCopied] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const [adminUserId, setAdminUserId] = useState<string | null>(null)
    const [loadingAdmin, setLoadingAdmin] = useState(false)
    const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
    const [planForm, setPlanForm] = useState({ name: "", description: "", basePrice: "", pricePerEmployee: "", active: true })

    // Subscription state in company form
    const [subForm, setSubForm] = useState<{
        planId: string;
        customBasePrice: string;
        customPricePerEmployee: string;
    }>({ planId: "", customBasePrice: "", customPricePerEmployee: "" })

    useEffect(() => {
        if (activeTab === "plans") loadPlans()
        if (activeTab === "finance") loadInvoices()
    }, [activeTab])

    async function loadPlans() {
        setLoadingPlans(true)
        try {
            const data = await getPlans()
            setPlans(data)
        } catch (e: any) {
            console.error("Erro ao carregar planos:", e)
        } finally {
            setLoadingPlans(false)
        }
    }

    async function loadInvoices() {
        setLoadingInvoices(true)
        try {
            const data = await getAllInvoices()
            setInvoices(data)
        } finally {
            setLoadingInvoices(false)
        }
    }

    const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cnpj ?? "").includes(search) ||
        (c.city ?? "").toLowerCase().includes(search.toLowerCase())
    )

    function openCreate() {
        setEditingId(null)
        setAdminUserId(null)
        setForm(emptyForm)
        setUserForm(emptyUser)
        setSubForm({ planId: "", customBasePrice: "", customPricePerEmployee: "" })
        setError(null)
        setCreatedCreds(null)
        setIsDialogOpen(true)
    }

    function copyToClipboard(text: string, key: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(key)
            setTimeout(() => setCopied(null), 2000)
        })
    }

    function closeDialog() {
        setIsDialogOpen(false)
        setCreatedCreds(null)
    }

    async function openEdit(c: Company) {
        console.log("Opening edit for company:", c.id, c.name)
        setEditingId(c.id)
        setForm({ name: c.name, cnpj: c.cnpj ?? "", email: c.email ?? "", whatsapp: c.whatsapp ?? "", address: c.address ?? "", city: c.city ?? "", state: c.state ?? "" })
        setUserForm(emptyUser)
        setError(null)
        setLoadingAdmin(true)

        try {
            console.log("Fetching company admin...")
            const admin = await getCompanyAdmin(c.id)
            if (admin) {
                console.log("Admin found:", admin.email)
                setAdminUserId(admin.id)
                setUserForm({ name: admin.name, email: admin.email, password: "" })
            } else {
                console.log("No admin found for company")
                setAdminUserId(null)
                setUserForm(emptyUser)
            }

            console.log("Fetching company subscription...")
            const sub = await getCompanySubscription(c.id)
            if (sub) {
                console.log("Subscription found, planId:", sub.planId)
                setSubForm({
                    planId: sub.planId,
                    customBasePrice: sub.customBasePrice ? String(sub.customBasePrice) : "",
                    customPricePerEmployee: sub.customPricePerEmployee ? String(sub.customPricePerEmployee) : ""
                })
            } else {
                console.log("No subscription found")
                setSubForm({ planId: "", customBasePrice: "", customPricePerEmployee: "" })
            }

            console.log("Opening dialog...")
            setIsDialogOpen(true)
        } catch (err: any) {
            console.error("Error in openEdit:", err)
            setError(`Erro ao carregar dados da empresa: ${err.message}`)
        } finally {
            setLoadingAdmin(false)
        }
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
            const upperData = {
                ...form,
                name: form.name.trim().toUpperCase(),
                address: form.address?.trim().toUpperCase() || undefined,
                city: form.city?.trim().toUpperCase() || undefined,
                state: form.state?.trim().toUpperCase() || undefined,
            }

            let company: any
            if (editingId) {
                company = await updateCompany(editingId, upperData)
                if (company) {
                    setCompanies(cs => cs.map(c => c.id === editingId ? { ...c, ...company } : c))
                }

                // Update Admin User if editing
                if (adminUserId) {
                    await updateCompanyAdmin(adminUserId, {
                        name: userForm.name.trim().toUpperCase(),
                        email: userForm.email.trim().toLowerCase(),
                        password: userForm.password || undefined
                    })
                }
            } else {
                // For new company
                const result = await createCompany(upperData, {
                    name: userForm.name.trim().toUpperCase(),
                    email: userForm.email.trim().toLowerCase(),
                    password: userForm.password
                }) as any
                company = result.company
                setCompanies(cs => [{ ...company, _count: { users: 1, employees: 0 } }, ...cs])
                setCreatedCreds({
                    name: userForm.name.trim().toUpperCase(),
                    email: userForm.email.trim().toLowerCase(),
                    password: result.password
                })
            }

            // Update Subscription
            if (company && subForm.planId) {
                await updateCompanySubscription(company.id, {
                    planId: subForm.planId,
                    customBasePrice: subForm.customBasePrice ? parseFloat(subForm.customBasePrice) : undefined,
                    customPricePerEmployee: subForm.customPricePerEmployee ? parseFloat(subForm.customPricePerEmployee) : undefined
                })
            }

            if (editingId) setIsDialogOpen(false)
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

    // Plans Actions
    function openCreatePlan() {
        setEditingPlanId(null)
        setPlanForm({ name: "", description: "", basePrice: "", pricePerEmployee: "", active: true })
        setError(null)
        setIsPlanDialogOpen(true)
    }

    function openEditPlan(p: any) {
        setEditingPlanId(p.id)
        setPlanForm({
            name: p.name,
            description: p.description || "",
            basePrice: String(p.basePrice),
            pricePerEmployee: String(p.pricePerEmployee),
            active: p.active
        })
        setError(null)
        setIsPlanDialogOpen(true)
    }

    async function handleSavePlan() {
        if (!planForm.name.trim()) { setError("Nome do plano é obrigatório."); return }
        setSaving(true)
        setError(null)
        try {
            const data = {
                name: planForm.name,
                description: planForm.description,
                basePrice: parseFloat(planForm.basePrice) || 0,
                pricePerEmployee: parseFloat(planForm.pricePerEmployee) || 0,
                active: planForm.active
            }

            if (editingPlanId) {
                const updated = await updatePlan(editingPlanId, data)
                setPlans(ps => ps.map(p => p.id === editingPlanId ? updated : p))
            } else {
                const created = await createPlan(data)
                setPlans(ps => [...ps, created])
            }
            setIsPlanDialogOpen(false)
        } catch (e: any) {
            setError(e.message ?? "Erro ao salvar plano.")
        } finally {
            setSaving(false)
        }
    }

    async function handleDeletePlan(id: string, name: string) {
        if (!confirm(`Excluir o plano "${name}"?`)) return
        try {
            await deletePlan(id)
            setPlans(ps => ps.filter(p => p.id !== id))
        } catch (e: any) {
            alert(e.message)
        }
    }

    async function handleLogout() {
        await adminLogout()
        router.push("/admin/login")
    }

    async function handleImportPdf(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.type !== "application/pdf") {
            alert("Por favor, selecione um arquivo PDF.")
            return
        }

        setImporting(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const data = await extractCompanyData(formData)
            
            // Standardize extracted data to uppercase
            const upperData = {
                ...data,
                name: data.name?.toUpperCase() || "",
                address: data.address?.toUpperCase() || "",
                city: data.city?.toUpperCase() || "",
                state: data.state?.toUpperCase() || "",
            }
            
            if (editingId) {
                const standardizedForm = { ...form, ...upperData }
                const updated = await updateCompany(editingId, standardizedForm)
                if (updated) {
                    setCompanies(cs => cs.map(c => c.id === editingId ? { ...c, ...updated } : c))
                    setIsDialogOpen(false)
                }
            } else {
                setForm(f => ({ ...f, ...upperData }))
            }
        } catch (err: any) {
            setError(err.message || "Erro ao importar dados do PDF.")
        } finally {
            setImporting(false)
            e.target.value = "" // Reset input
        }
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
                        <div className="hidden sm:block">
                            <p className="text-sm font-black text-white uppercase tracking-wider">PEPACORP</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Administração</p>
                        </div>
                    </div>

                    <nav className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                        {[
                            { id: "companies", label: "Empresas", icon: Building2 },
                            { id: "plans", label: "Planos", icon: CreditCard },
                            { id: "finance", label: "Financeiro", icon: DollarSign },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === t.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                            >
                                <t.icon className="h-4 w-4" />
                                <span className="hidden md:inline">{t.label}</span>
                            </button>
                        ))}
                    </nav>

                    <button
                        onClick={() => adminLogout().then(() => router.push("/admin/login"))}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> Sair
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-500">
                {activeTab === "companies" && (
                <>
                {/* Page header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Empresas</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{companies.length} empresa{companies.length !== 1 ? "s" : ""} no sistema</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
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
                </>
                )}

                {activeTab === "plans" && (
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Planos de Assinatura</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Gerencie os planos e valores padrão</p>
                        </div>
                        <button 
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
                            onClick={openCreatePlan}
                        >
                            <Plus className="h-4 w-4" /> Novo Plano
                        </button>
                    </div>
                )}

                {activeTab === "finance" && (
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Controle de faturas e cobranças</p>
                        </div>
                        <button 
                            onClick={async () => {
                                const m = prompt("Mês (1-12):", (new Date().getMonth() + 1).toString())
                                const y = prompt("Ano:", new Date().getFullYear().toString())
                                if (m && y) {
                                    const res = await generateInvoicesForMonth(parseInt(m), parseInt(y))
                                    alert(`${res.generated} faturas geradas.`)
                                    loadInvoices()
                                }
                            }}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
                        >
                            <DollarSign className="h-4 w-4" /> Gerar Faturas do Mês
                        </button>
                    </div>
                )}

                {/* Companies grid */}
                {(activeTab === "companies") && (
                filtered.length === 0 ? (
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
                ))}

                {activeTab === "plans" && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {loadingPlans && <p className="col-span-full py-20 text-center text-slate-400">Carregando planos...</p>}
                        {!loadingPlans && plans.map(p => (
                            <div key={p.id} className="rounded-2xl border bg-white p-6 space-y-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-slate-800 uppercase tracking-wide">{p.name}</h3>
                                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500 min-h-[40px]">{p.description || "Sem descrição"}</p>
                                <div className="space-y-1 pt-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base</p>
                                    <p className="text-xl font-black text-slate-800">R$ {Number(p.basePrice).toFixed(2)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Por funcionário</p>
                                    <p className="text-xl font-black text-slate-800">R$ {Number(p.pricePerEmployee).toFixed(2)}</p>
                                </div>
                                <div className="pt-4 flex gap-2">
                                    <button 
                                        onClick={() => openEditPlan(p)}
                                        className="flex-1 rounded-xl bg-slate-50 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        EDITAR
                                    </button>
                                    <button 
                                        onClick={() => handleDeletePlan(p.id, p.name)}
                                        className="rounded-xl px-2 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "finance" && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Faturado</p>
                                <p className="text-2xl font-black text-slate-800">
                                    R$ {invoices.reduce((acc, inv) => acc + Number(inv.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Recebido</p>
                                <p className="text-2xl font-black text-emerald-600">
                                    R$ {invoices.filter(inv => inv.status === "PAID").reduce((acc, inv) => acc + Number(inv.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Total Pendente</p>
                                <p className="text-2xl font-black text-amber-600">
                                    R$ {invoices.filter(inv => inv.status !== "PAID").reduce((acc, inv) => acc + Number(inv.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-6 py-4">EMPRESA</th>
                                    <th className="px-6 py-4">MÊS/ANO</th>
                                    <th className="px-6 py-4">FUNCIONÁRIOS</th>
                                    <th className="px-6 py-4">VALOR TOTAL</th>
                                    <th className="px-6 py-4">STATUS</th>
                                    <th className="px-6 py-4 text-right">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loadingInvoices && <tr><td colSpan={6} className="py-20 text-center text-slate-400">Carregando faturas...</td></tr>}
                                {!loadingInvoices && invoices.length === 0 && <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Nenhuma fatura encontrada.</td></tr>}
                                {!loadingInvoices && invoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{inv.company.name}</td>
                                        <td className="px-6 py-4 font-medium text-slate-600">{inv.month}/{inv.year}</td>
                                        <td className="px-6 py-4 text-slate-500">{inv.employeeCount}</td>
                                        <td className="px-6 py-4 font-black text-slate-900">R$ {Number(inv.amount).toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {inv.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={async () => {
                                                    const next = inv.status === 'PAID' ? 'PENDING' : 'PAID'
                                                    await updateInvoiceStatus(inv.id, next)
                                                    loadInvoices()
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                {inv.status === 'PAID' ? 'MARCAR COMO PENDENTE' : 'MARCAR COMO PAGO'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                            <button onClick={closeDialog} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Credentials display after creation */}
                            {createdCreds && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        <p className="font-bold text-slate-800">Empresa criada com sucesso!</p>
                                    </div>
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Credenciais temporárias</p>
                                        <p className="text-xs text-amber-600">Compartilhe com o usuário. No primeiro acesso, será obrigatório trocar as credenciais.</p>
                                        {[
                                            { label: "Nome", value: createdCreds.name, key: "name" },
                                            { label: "E-mail", value: createdCreds.email, key: "email" },
                                            { label: "Senha", value: createdCreds.password, key: "password" },
                                        ].map(({ label, value, key }) => (
                                            <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                                    <p className="text-sm font-mono text-slate-800 truncate">{value}</p>
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(value, key)}
                                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                                                    title="Copiar"
                                                >
                                                    {copied === key
                                                        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                        : <Copy className="h-3.5 w-3.5" />
                                                    }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!createdCreds && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Dados da Empresa</p>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={handleImportPdf}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={importing}
                                            />
                                            <button
                                                type="button"
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                disabled={importing}
                                            >
                                                {importing ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <FileUp className="h-3.5 w-3.5" />
                                                )}
                                                {importing ? "Importando..." : "Importar PDF"}
                                            </button>
                                        </div>
                                    </div>
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


                            {/* Admin user fields */}
                            <div className="border-t pt-4">
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Usuário Administrador</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <Field label="Nome completo *" value={userForm.name} onChange={v => setUserForm(f => ({ ...f, name: v }))} placeholder="Nome do admin" />
                                    </div>
                                    <Field label="E-mail *" value={userForm.email} onChange={v => setUserForm(f => ({ ...f, email: v }))} type="email" placeholder="admin@empresa.com" />
                                    <Field 
                                        label={editingId ? "Nova Senha (opcional)" : "Senha *"} 
                                        value={userForm.password} 
                                        onChange={v => setUserForm(f => ({ ...f, password: v }))} 
                                        type="password" 
                                        placeholder={editingId ? "Deixe vazio para manter" : "Senha de acesso"} 
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                                    <p className="text-sm font-medium text-red-700">{error}</p>
                                </div>
                            )}
                            </>)}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
                            {createdCreds ? (
                                <button
                                    onClick={closeDialog}
                                    className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                >
                                    Fechar
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={closeDialog}
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
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Plan Dialog ── */}
            {isPlanDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="font-bold text-slate-800 text-lg">
                                {editingPlanId ? "Editar Plano" : "Novo Plano"}
                            </h2>
                            <button onClick={() => setIsPlanDialogOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <Field label="Nome do Plano *" value={planForm.name} onChange={v => setPlanForm(f => ({ ...f, name: v }))} placeholder="Ex: Premium, Enterprise" />
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descrição</label>
                                <textarea 
                                    value={planForm.description}
                                    onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                    placeholder="O que este plano inclui?"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Preço Base (R$)" value={planForm.basePrice} onChange={v => setPlanForm(f => ({ ...f, basePrice: v }))} type="number" placeholder="0.00" />
                                <Field label="Preço por Func. (R$)" value={planForm.pricePerEmployee} onChange={v => setPlanForm(f => ({ ...f, pricePerEmployee: v }))} type="number" placeholder="0.00" />
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2">
                                <button 
                                    onClick={() => setPlanForm(f => ({ ...f, active: !f.active }))}
                                    className="flex items-center gap-2 group"
                                >
                                    {planForm.active ? <ToggleRight className="h-6 w-6 text-emerald-500" /> : <ToggleLeft className="h-6 w-6 text-slate-300" />}
                                    <span className="text-sm font-semibold text-slate-600">Plano Ativo</span>
                                </button>
                            </div>

                            {error && (
                                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                                    <p className="text-sm font-medium text-red-700">{error}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50">
                            <button
                                onClick={() => setIsPlanDialogOpen(false)}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePlan}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editingId ? "Salvar alterações" : "Criar plano"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
