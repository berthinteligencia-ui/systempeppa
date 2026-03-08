"use client"

import { useState, useEffect } from "react"
import { Building2, Phone, Mail, MapPin, Save, CheckCircle2, AlertCircle, Shield, Clock, RefreshCw as RefreshIcon, Users, UserCog, ChevronDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { updateCompanySettings } from "@/lib/actions/settings"
import { runBackup, listBackups, getBackupUrl, deleteBackup } from "@/lib/actions/backup"
import { updateUser } from "@/lib/actions/users"
import { updateRolePermissions } from "@/lib/actions/permissions"
import { ALL_FEATURES, CONTROLLABLE_ROLES, type AllPermissions } from "@/lib/permissions-config"
import { Database, Download, History, Loader2, RefreshCw, Trash2, Lock } from "lucide-react"
import { useSession } from "next-auth/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type UserItem = { id: string; name: string; email: string; role: string; active: boolean }

interface SettingsClientProps {
    initialData: any
    initialUsers?: UserItem[]
    currentUserId?: string
    initialPermissions?: AllPermissions
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Administrador",
    RH: "RH",
    GESTOR: "Gestor",
    FUNCIONARIO: "Funcionário",
}

const ROLE_COLORS: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700",
    RH: "bg-blue-100 text-blue-700",
    GESTOR: "bg-indigo-100 text-indigo-700",
    FUNCIONARIO: "bg-slate-100 text-slate-600",
}

const ROLE_DESC: Record<string, string> = {
    ADMIN: "Acesso total ao sistema — pode gerenciar usuários, configurações e todos os módulos",
    RH: "Acesso a funcionários, folha de pagamento, notas fiscais e relatórios",
    GESTOR: "Acesso a relatórios, dashboard e visualização de dados da empresa",
    FUNCIONARIO: "Acesso restrito — apenas visualização de comprovantes e informações próprias",
}

const ACTION_LABELS: Record<string, string> = {
    PAGE_VIEW: "Visualizou página",
    SAVE_SETTINGS: "Salvou configurações",
    RUN_BACKUP: "Executou backup",
    SEND_MESSAGE: "Enviou mensagem",
    LOGIN: "Login",
}

export function SettingsClient({ initialData, initialUsers = [], currentUserId = "", initialPermissions = {} }: SettingsClientProps) {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"

    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [backups, setBackups] = useState<any[]>([])
    const [loadingBackups, setLoadingBackups] = useState(false)
    const [backingUp, setBackingUp] = useState(false)

    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const [logSearch, setLogSearch] = useState("")

    const [users, setUsers] = useState<UserItem[]>(initialUsers)
    const [userEdits, setUserEdits] = useState<Record<string, { role: string; active: boolean }>>({})
    const [savingUser, setSavingUser] = useState<string | null>(null)

    const [permissions, setPermissions] = useState<AllPermissions>(initialPermissions)
    const [permEdits, setPermEdits] = useState<AllPermissions>({})
    const [savingRole, setSavingRole] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        cnpj: initialData?.cnpj || "",
        whatsapp: initialData?.whatsapp || "",
        email: initialData?.email || "",
        address: initialData?.address || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        settings: {
            whatsappNotifications: initialData?.settings?.whatsappNotifications || false,
            autoBackup: initialData?.settings?.autoBackup || false,
        }
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        setSuccess(false)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            await updateCompanySettings(formData)
            setSuccess(true)
        } catch (err: any) {
            setError(err.message || "Erro ao salvar configurações")
        } finally {
            setLoading(false)
        }
    }

    const loadBackups = async () => {
        setLoadingBackups(true)
        try {
            const data = await listBackups()
            setBackups(data)
        } catch (err) {
            console.error("Erro ao carregar backups:", err)
        } finally {
            setLoadingBackups(false)
        }
    }

    const handleRunBackup = async () => {
        setBackingUp(true)
        setError(null)
        try {
            await runBackup()
            await loadBackups()
            setSuccess(true)
        } catch (err: any) {
            setError(err.message || "Erro ao realizar backup")
        } finally {
            setBackingUp(false)
        }
    }

    const handleDownloadBackup = async (name: string) => {
        try {
            const url = await getBackupUrl(name)
            if (url) window.open(url, "_blank")
        } catch (err) {
            alert("Erro ao gerar link de download")
        }
    }

    const handleDeleteBackup = async (id: string) => {
        if (!confirm("Deseja realmente excluir este backup permanentemente?")) return
        setLoadingBackups(true)
        try {
            await deleteBackup(id)
            await loadBackups()
        } catch (err: any) {
            alert(err.message || "Erro ao excluir backup")
        } finally {
            setLoadingBackups(false)
        }
    }

    function getPermEdit(role: string, feature: string): boolean {
        const edited = permEdits[role]?.[feature]
        if (edited !== undefined) return edited
        const saved = permissions[role]?.[feature]
        return saved !== undefined ? saved : true
    }

    function setPermEdit(role: string, feature: string, value: boolean) {
        setPermEdits(prev => ({
            ...prev,
            [role]: { ...(prev[role] ?? permissions[role] ?? {}), [feature]: value }
        }))
    }

    function hasPermChanges(role: string): boolean {
        if (!permEdits[role]) return false
        const saved = permissions[role] ?? {}
        for (const [f, v] of Object.entries(permEdits[role])) {
            const orig = saved[f] !== undefined ? saved[f] : true
            if (v !== orig) return true
        }
        return false
    }

    async function handleSavePermissions(role: string) {
        setSavingRole(role)
        const merged: Record<string, boolean> = {}
        for (const f of ALL_FEATURES) {
            merged[f.key] = getPermEdit(role, f.key)
        }
        try {
            await updateRolePermissions(role, merged)
            setPermissions(prev => ({ ...prev, [role]: merged }))
            setPermEdits(prev => { const n = { ...prev }; delete n[role]; return n })
        } catch (err: any) {
            alert(err.message || "Erro ao salvar permissões")
        } finally {
            setSavingRole(null)
        }
    }

    function getUserEdit(user: UserItem) {
        return userEdits[user.id] ?? { role: user.role, active: user.active }
    }

    function setUserEdit(userId: string, patch: Partial<{ role: string; active: boolean }>) {
        setUserEdits(prev => ({
            ...prev,
            [userId]: { ...getUserEdit(users.find(u => u.id === userId)!), ...prev[userId], ...patch }
        }))
    }

    async function handleSaveUser(user: UserItem) {
        const edit = getUserEdit(user)
        setSavingUser(user.id)
        try {
            await updateUser(user.id, { name: user.name, email: user.email, role: edit.role, active: edit.active })
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: edit.role, active: edit.active } : u))
            setUserEdits(prev => { const n = { ...prev }; delete n[user.id]; return n })
        } catch (err: any) {
            alert(err.message || "Erro ao salvar usuário")
        } finally {
            setSavingUser(null)
        }
    }

    const loadLogs = async () => {
        setLoadingLogs(true)
        try {
            const res = await fetch("/api/logs?limit=200")
            if (res.ok) setLogs(await res.json())
        } catch { /* silencioso */ } finally {
            setLoadingLogs(false)
        }
    }

    useEffect(() => {
        loadBackups()
    }, [])

    useEffect(() => {
        if (isAdmin) loadLogs()
    }, [isAdmin])

    return (
        <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
                <form onSubmit={handleSubmit}>
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle>Dados da Empresa</CardTitle>
                                    <CardDescription>Informações principais e cadastrais</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Razão Social / Nome Fantasia</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Ex: Minha Empresa LTDA"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cnpj">CNPJ</Label>
                                    <Input
                                        id="cnpj"
                                        name="cnpj"
                                        value={formData.cnpj}
                                        onChange={handleChange}
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-slate-100" />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-slate-400" />
                                        <Label htmlFor="whatsapp">WhatsApp de Contato</Label>
                                    </div>
                                    <Input
                                        id="whatsapp"
                                        name="whatsapp"
                                        value={formData.whatsapp}
                                        onChange={handleChange}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-slate-400" />
                                        <Label htmlFor="email">E-mail Corporativo</Label>
                                    </div>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="contato@empresa.com.br"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-slate-100" />

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    <Label>Endereço</Label>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-xs text-slate-400">Logradouro, número, complemento</Label>
                                    <Input
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Rua Exemplo, 123"
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="city">Cidade</Label>
                                        <Input
                                            id="city"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            placeholder="São Paulo"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state">Estado (UF)</Label>
                                        <Input
                                            id="state"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            placeholder="SP"
                                            maxLength={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t mt-6">
                                <p className="text-xs text-slate-400 font-medium">
                                    * Campos opcionais. Mantenha os dados atualizados para relatórios.
                                </p>
                                <div className="flex items-center gap-3">
                                    {success && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-in fade-in slide-in-from-right-2">
                                            <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
                                        </span>
                                    )}
                                    {error && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 animate-in fade-in slide-in-from-right-2">
                                            <AlertCircle className="h-4 w-4" /> {error}
                                        </span>
                                    )}
                                    <Button type="submit" disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm min-w-[120px]">
                                        {loading ? "Salvando..." : (
                                            <>
                                                <Save className="h-4 w-4" /> Salvar Alterações
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </form>

                <Card className="border-slate-100 bg-slate-50 shadow-none border-dashed text-slate-600">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-800">Dica de Segurança</p>
                                <p className="text-xs leading-relaxed">
                                    As configurações do sistema afetam como os dados são exibidos nos relatórios e como os fechamentos de folha são processados. Certifique-se de validar o CNPJ e e-mail antes de salvar.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm h-fit">
                    <CardHeader>
                        <CardTitle className="text-sm">Configuração do Sistema</CardTitle>
                        <CardDescription className="text-xs">Preferências gerais</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-700">Notificações WhatsApp</p>
                                <p className="text-[10px] text-slate-500">Enviar alertas automáticos</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="settings.whatsappNotifications"
                                    checked={formData.settings.whatsappNotifications}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            settings: { ...prev.settings, whatsappNotifications: e.target.checked }
                                        }))
                                        setSuccess(false)
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-700">Backup Automático</p>
                                <p className="text-[10px] text-slate-500">Sincronizar dados em nuvem</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="settings.autoBackup"
                                    checked={formData.settings.autoBackup}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            settings: { ...prev.settings, autoBackup: e.target.checked }
                                        }))
                                        setSuccess(false)
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full mt-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-none shadow-none text-xs font-bold"
                        >
                            {loading ? "Aplicando..." : "Aplicar Preferências"}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm h-fit">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm">Sistema de Backup</CardTitle>
                                <CardDescription className="text-xs">Armazenamento em nuvem</CardDescription>
                            </div>
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Database className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleRunBackup}
                            disabled={backingUp}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-2"
                        >
                            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            {backingUp ? "Processando Backup..." : "Realizar Backup Agora"}
                        </Button>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Últimos Backups</p>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-slate-400 hover:text-blue-500"
                                    onClick={loadBackups}
                                    disabled={loadingBackups}
                                >
                                    <RefreshCw className={`h-3 w-3 ${loadingBackups ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>

                            <div className="space-y-1.5">
                                {backups.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 text-center py-2 italic">Nenhum backup encontrado</p>
                                ) : backups.slice(0, 3).map((backup, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-white group transition-hover hover:border-blue-100">
                                        <div className="flex items-center gap-2">
                                            <History className="h-3 w-3 text-slate-300" />
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-bold text-slate-600">
                                                    {new Date(backup.createdAt).toLocaleDateString('pt-BR')} {new Date(backup.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-[9px] text-slate-400">
                                                    {(backup.fileSize / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-400 hover:text-blue-500"
                                                onClick={() => handleDownloadBackup(backup.fileName)}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                onClick={() => handleDeleteBackup(backup.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="text-[9px] text-slate-400 leading-tight">
                            Os backups contêm todos os dados da sua empresa e são armazenados de forma criptografada e segura.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>

        {isAdmin && users.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                            <UserCog className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>Controle de Perfis de Usuários</CardTitle>
                            <CardDescription>Gerencie os perfis de acesso e status dos usuários da empresa</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                                    <th className="text-left px-5 py-3">Usuário</th>
                                    <th className="text-left px-5 py-3">Perfil de Acesso</th>
                                    <th className="text-left px-5 py-3">Status</th>
                                    <th className="text-right px-5 py-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map(user => {
                                    const edit = getUserEdit(user)
                                    const changed = edit.role !== user.role || edit.active !== user.active
                                    const isSelf = user.id === currentUserId
                                    return (
                                        <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${isSelf ? "bg-blue-50/30" : ""}`}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                                        {user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                                            {user.name}
                                                            {isSelf && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">Você</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-400">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="space-y-1">
                                                    <Select
                                                        value={edit.role}
                                                        onValueChange={v => setUserEdit(user.id, { role: v })}
                                                        disabled={isSelf}
                                                    >
                                                        <SelectTrigger className="h-8 w-44 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ADMIN">Administrador</SelectItem>
                                                            <SelectItem value="RH">RH</SelectItem>
                                                            <SelectItem value="GESTOR">Gestor</SelectItem>
                                                            <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] text-slate-400 max-w-xs">{ROLE_DESC[edit.role]}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <label className={`relative inline-flex items-center ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={edit.active}
                                                        disabled={isSelf}
                                                        onChange={e => setUserEdit(user.id, { active: e.target.checked })}
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    <span className="ml-2 text-xs font-medium text-slate-600">{edit.active ? "Ativo" : "Inativo"}</span>
                                                </label>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                {!isSelf && (
                                                    <Button
                                                        size="sm"
                                                        className={`h-8 text-xs gap-1.5 ${changed ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                                                        disabled={!changed || savingUser === user.id}
                                                        onClick={() => handleSaveUser(user)}
                                                    >
                                                        {savingUser === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                        {savingUser === user.id ? "Salvando..." : "Salvar"}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3 border-t bg-slate-50/50">
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                <div key={role} className="flex items-center gap-1.5">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[role]}`}>{label}</span>
                                    <span className="text-[10px] text-slate-400">{ROLE_DESC[role].split("—")[0].trim()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        {isAdmin && (
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
                            <Lock className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>Controle de Acesso por Perfil</CardTitle>
                            <CardDescription>Defina quais módulos cada perfil pode acessar</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                                    <th className="text-left px-5 py-3 w-48">Módulo</th>
                                    <th className="px-5 py-3 text-center w-36">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">Admin</span>
                                            <span className="text-[9px] normal-case text-slate-300">Acesso total</span>
                                        </div>
                                    </th>
                                    {CONTROLLABLE_ROLES.map(role => (
                                        <th key={role} className="px-5 py-3 text-center w-36">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                                                <Button
                                                    size="sm"
                                                    className={`h-6 text-[10px] px-2 gap-1 ${hasPermChanges(role) ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                                                    disabled={!hasPermChanges(role) || savingRole === role}
                                                    onClick={() => handleSavePermissions(role)}
                                                >
                                                    {savingRole === role ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Salvar
                                                </Button>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {ALL_FEATURES.map(feature => (
                                    <tr key={feature.key} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-slate-700">{feature.label}</td>
                                        <td className="px-5 py-3 text-center">
                                            <div className="flex justify-center">
                                                <Lock className="h-4 w-4 text-purple-300" />
                                            </div>
                                        </td>
                                        {CONTROLLABLE_ROLES.map(role => {
                                            const enabled = getPermEdit(role, feature.key)
                                            return (
                                                <td key={role} className="px-5 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={enabled}
                                                                onChange={e => setPermEdit(role, feature.key, e.target.checked)}
                                                            />
                                                            <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                                        </label>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3 border-t bg-slate-50/50 text-[10px] text-slate-400">
                        As permissões entram em vigor imediatamente na próxima navegação do usuário. Usuários já logados são afetados na próxima requisição.
                    </div>
                </CardContent>
            </Card>
        )}

        {isAdmin && (
            <Card className="border-slate-200 shadow-sm mt-6">
                <CardHeader className="bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-violet-100 p-2 text-violet-600">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Logs de Acesso</CardTitle>
                                <CardDescription>Registro de acessos e comandos dos usuários</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Filtrar por usuário ou ação..."
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                className="h-8 text-xs w-56"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                onClick={loadLogs}
                                disabled={loadingLogs}
                            >
                                <RefreshIcon className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                                Atualizar
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 p-0">
                    {loadingLogs ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10 italic">Nenhum log registrado ainda.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                                        <th className="text-left px-4 py-2.5 font-semibold">Data / Hora</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Usuário</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Ação</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Página / Alvo</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs
                                        .filter(l => {
                                            if (!logSearch) return true
                                            const s = logSearch.toLowerCase()
                                            return (
                                                l.user_name?.toLowerCase().includes(s) ||
                                                l.user_email?.toLowerCase().includes(s) ||
                                                l.action?.toLowerCase().includes(s) ||
                                                l.target?.toLowerCase().includes(s)
                                            )
                                        })
                                        .map((log, i) => (
                                            <tr key={log.id ?? i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3 text-slate-300" />
                                                        {new Date(log.created_at).toLocaleString('pt-BR', {
                                                            day: '2-digit', month: '2-digit', year: '2-digit',
                                                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="font-semibold text-slate-700">{log.user_name}</div>
                                                    <div className="text-[10px] text-slate-400">{log.user_email}</div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        log.action === 'PAGE_VIEW' ? 'bg-blue-50 text-blue-600' :
                                                        log.action === 'SAVE_SETTINGS' ? 'bg-emerald-50 text-emerald-600' :
                                                        log.action === 'RUN_BACKUP' ? 'bg-amber-50 text-amber-600' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {ACTION_LABELS[log.action] ?? log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600">{log.target ?? "—"}</td>
                                                <td className="px-4 py-2.5 text-slate-400 font-mono">{log.ip_address ?? "—"}</td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                            <p className="text-[10px] text-slate-400 text-right px-4 py-2">
                                {logs.length} registros — últimos 200
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
        </div>
    )
}
