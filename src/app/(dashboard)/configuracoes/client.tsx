"use client"

import { useState } from "react"
import { Building2, Phone, Mail, MapPin, Save, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { updateCompanySettings } from "@/lib/actions/settings"
import { runBackup, listBackups, getBackupUrl } from "@/lib/actions/backup"
import { Database, Download, History, Loader2, RefreshCw } from "lucide-react"
import { useEffect } from "react"

interface SettingsClientProps {
    initialData: any
}

export function SettingsClient({ initialData }: SettingsClientProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [backups, setBackups] = useState<any[]>([])
    const [loadingBackups, setLoadingBackups] = useState(false)
    const [backingUp, setBackingUp] = useState(false)
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

    useEffect(() => {
        loadBackups()
    }, [])

    return (
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
                                                    {new Date(backup.created_at).toLocaleDateString('pt-BR')}
                                                </p>
                                                <p className="text-[9px] text-slate-400">
                                                    {(backup.metadata?.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDownloadBackup(backup.name)}
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </Button>
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
    )
}
