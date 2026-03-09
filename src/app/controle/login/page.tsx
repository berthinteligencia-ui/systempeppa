"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { controleLogin } from "@/lib/actions/controle"
import { Loader2, Lock, Eye, EyeOff } from "lucide-react"

export default function ControleLoginPage() {
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [show, setShow] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError("")
        try {
            const ok = await controleLogin(password)
            if (!ok) { setError("Senha incorreta."); setLoading(false); return }
            router.push("/controle")
        } catch {
            setError("Erro ao autenticar.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0e1117] p-5 safe-area-inset">
            {/* Background grid */}
            <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

            <div className="relative w-full max-w-sm">
                {/* Logo */}
                <div className="mb-10 text-center">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-indigo-500/40 mb-5">
                        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">PEPACORP</h1>
                    <p className="text-sm text-slate-400 mt-1 tracking-widest uppercase text-[11px]">Central de Controle</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
                    <p className="text-[13px] text-slate-400 mb-6">
                        Acesso restrito. Digite a senha para continuar.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Senha de acesso</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type={show ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••••••"
                                    className="w-full pl-10 pr-10 py-3 bg-white/8 border border-white/10 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                    style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                />
                                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5">
                                <p className="text-[13px] text-red-400 font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar painel"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[11px] text-slate-700 mt-6 uppercase tracking-widest">
                    © {new Date().getFullYear()} PEPACORP • Uso interno
                </p>
            </div>
        </div>
    )
}
