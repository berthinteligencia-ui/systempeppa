"use client"

import { useState, useEffect } from "react"
import { Globe, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function WhatsAppSettings() {
    const [savedUrl, setSavedUrl] = useState("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/whatsapp/settings")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    setSavedUrl(data.whatsappWebhookUrl || "")
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-b-0 pb-8 pt-10">
                    <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3 text-white ring-1 ring-white/30">
                            <Globe className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold tracking-tight">WhatsApp Webhook</CardTitle>
                            <CardDescription className="text-blue-100 text-sm mt-1 font-medium opacity-90">
                                Monitoramento do canal de integração em tempo real
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-10 pb-12 px-8">
                    <div className="space-y-8">
                        <div className="bg-blue-50/50 p-8 rounded-3xl border border-blue-100 flex flex-col gap-6 relative overflow-hidden group">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2.5 text-blue-800 font-bold text-xs uppercase tracking-widest">
                                    <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
                                    Servidor de Processamento Ativo
                                </div>
                                <div className={cn(
                                    "px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm",
                                    savedUrl ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white"
                                )}>
                                    {savedUrl ? "Personalizado" : "Padrão de Rede"}
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-md relative z-10 hover:border-blue-300 transition-colors duration-300">
                                <p className="text-xl font-mono text-slate-800 font-semibold break-all leading-relaxed">
                                    {savedUrl || "https://webhook.berthia.com.br/webhook/folhazap"}
                                </p>
                            </div>
                            
                            <div className="flex items-start gap-3 text-blue-700/80 bg-white/40 p-4 rounded-xl border border-blue-100/40 relative z-10">
                                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-blue-500" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold uppercase tracking-tight text-blue-900">Acesso Restrito</p>
                                    <p className="text-[13px] leading-relaxed">
                                        As configurações de integração são gerenciais. Para solicitar alterações ou atualizações no destino das mensagens, entre em contato com o suporte técnico ou utilize o painel de master administração.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
