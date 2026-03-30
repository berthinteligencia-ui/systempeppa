"use client"

import { useState, useEffect } from "react"
import { Save, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateCompanySettings } from "@/lib/actions/settings"

export function WhatsAppSettings() {
    const [webhookUrl, setWebhookUrl] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch("/api/whatsapp/settings")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) setWebhookUrl(data.whatsappWebhookUrl || "")
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(false)
        try {
            await updateCompanySettings({ settings: { whatsappWebhookUrl: webhookUrl } })
            setSuccess(true)
        } catch (err: any) {
            setError(err.message || "Erro ao salvar configuração")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Card className="border-slate-200 shadow-md overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
                            <Globe className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Configuração Webhook WhatsApp</CardTitle>
                            <CardDescription className="text-sm font-medium text-slate-500">
                                Defina o endereço do servidor que processará as mensagens recebidas
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 pb-10">
                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="space-y-3">
                            <Label htmlFor="webhookUrl" className="text-sm font-bold text-slate-700">URL do Webhook</Label>
                            <div className="relative group">
                                <Input
                                    id="webhookUrl"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder="https://seu-dominio.com/api/whatsapp/webhook"
                                    className="pr-12 py-6 text-base shadow-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all font-mono"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Globe className={cn("h-5 w-5 transition-colors", webhookUrl ? "text-blue-500" : "text-slate-300")} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                                Certifique-se de que a URL comece com https:// para garantir a segurança dos dados.
                            </p>
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t">
                            <div>
                                {success && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-in fade-in">
                                        <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
                                    </span>
                                )}
                                {error && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 animate-in fade-in">
                                        <AlertCircle className="h-4 w-4" /> {error}
                                    </span>
                                )}
                            </div>
                            <Button type="submit" disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm min-w-[120px]">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
