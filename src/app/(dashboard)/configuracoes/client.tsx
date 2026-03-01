"use client"

import { useState } from "react"
import { Building2, Phone, Mail, MapPin, Save, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { updateCompanySettings } from "@/lib/actions/settings"

interface SettingsClientProps {
    initialData: any
}

export function SettingsClient({ initialData }: SettingsClientProps) {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
            </div>
        </div>
    )
}
