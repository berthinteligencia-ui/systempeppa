"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminLogin } from "@/lib/actions/admin"
import { Landmark, Lock, ArrowRight, Loader2 } from "lucide-react"

export default function AdminLoginPage() {
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError("")
        try {
            const ok = await adminLogin(password)
            if (!ok) {
                setError("Senha incorreta.")
                setLoading(false)
                return
            }
            router.push("/admin")
        } catch {
            setError("Erro ao autenticar.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f1e3d] p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/40 mb-4">
                        <Landmark className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-wider">PEPACORP</h1>
                    <p className="text-xs text-blue-300 font-semibold uppercase tracking-widest mt-1">Painel de Administração</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur-sm">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
                        <p className="text-sm text-slate-400 mt-1">Digite a senha de administrador do sistema.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Senha Admin
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                                <p className="text-sm font-medium text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-3.5 font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-60"
                        >
                            {loading
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <>Entrar <ArrowRight className="h-4 w-4" /></>
                            }
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6 uppercase tracking-widest">
                    © 2026 PEPACORP • Sistema Interno
                </p>
            </div>
        </div>
    )
}
