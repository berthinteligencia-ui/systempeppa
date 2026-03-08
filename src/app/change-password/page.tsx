"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { changePassword } from "@/lib/actions/changePassword"
import { Landmark, Loader2, KeyRound, Eye, EyeOff } from "lucide-react"

export default function ChangePasswordPage() {
    const { data: session } = useSession()
    const [name, setName] = useState(session?.user?.name ?? "")
    const [email, setEmail] = useState(session?.user?.email ?? "")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [showPwd, setShowPwd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (password !== confirm) { setError("As senhas não coincidem."); return }
        if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return }
        setLoading(true)
        setError(null)
        try {
            await changePassword({ name, email, password })
            await signOut({ callbackUrl: "/login" })
        } catch (err: any) {
            setError(err.message ?? "Erro ao salvar.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 mb-3">
                        <Landmark className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">PEPACORP</h1>
                    <p className="text-sm text-slate-500 mt-1">Controle Financeiro</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Title */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                            <KeyRound className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Primeiro acesso</p>
                            <p className="text-xs text-slate-500">Defina suas credenciais permanentes</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                            <p className="text-xs text-amber-700 font-medium">
                                Por segurança, você precisa redefinir seu nome, e-mail e senha antes de continuar.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Nome completo
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Seu nome"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                E-mail (login)
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Nova senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showPwd ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Confirmar nova senha
                            </label>
                            <input
                                type={showPwd ? "text" : "password"}
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Repita a nova senha"
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                                <p className="text-sm font-medium text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? "Salvando..." : "Salvar e entrar"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
