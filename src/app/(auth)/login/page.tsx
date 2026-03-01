"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Landmark, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = new FormData(e.currentTarget)
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    })

    if (result?.error) {
      setError("Credenciais inválidas. Verifique seu e-mail e senha.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#f6f6f8] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Visual side - Left */}
      <div className="hidden md:flex md:w-1/2 bg-[#1e3b8a] relative overflow-hidden items-center justify-center p-12">
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[40px] border-white"></div>
          <div className="absolute bottom-12 left-12 w-64 h-64 rounded-full border-[20px] border-white"></div>
        </div>

        <div className="relative z-10 text-white max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="size-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
              <Landmark className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">PEPACORP</h1>
              <p className="text-xs font-medium text-white/70 uppercase tracking-widest">Controle Financeiro</p>
            </div>
          </div>

          <h2 className="text-4xl font-black leading-tight mb-6">
            A inteligência que faltava na sua <span className="text-blue-300">gestão financeira.</span>
          </h2>
          <p className="text-lg text-blue-100 leading-relaxed mb-8">
            Visualize, analise e tome decisões estratégicas com uma plataforma corporativa de alto desempenho.
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-blue-300"></div>
              <p className="text-sm font-medium text-blue-100">Visão Geral Corporativa Consolidada</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-blue-300"></div>
              <p className="text-sm font-medium text-blue-100">Análise Inteligente de Folha</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-blue-300"></div>
              <p className="text-sm font-medium text-blue-100">Alertas em Tempo Real</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form side - Right */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="md:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="size-10 bg-[#1e3b8a] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#1e3b8a] uppercase">PEPACORP</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Controle Financeiro</p>
            </div>
          </div>

          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-3xl font-black tracking-tight text-slate-900">Acesse sua conta</h3>
            <p className="text-slate-500 font-medium">Insira suas credenciais corporativas abaixo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                E-mail Corporativo
              </label>
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="exemplo@pepacorp.com"
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none group-hover:border-slate-300 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Senha de Acesso
                </label>
                <a href="#" className="text-xs font-bold text-[#1e3b8a] hover:underline">Esqueceu a senha?</a>
              </div>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none group-hover:border-slate-300 shadow-sm"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl flex items-center gap-3 animate-shake">
                <div className="size-2 rounded-full bg-red-500"></div>
                <p className="text-xs font-bold text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3b8a] hover:bg-[#162a63] text-white py-4 px-6 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Entrar na Plataforma
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <footer className="pt-8 text-center text-slate-400">
            <p className="text-xs font-medium uppercase tracking-widest">
              © 2026 PEPACORP • Sistema de Alto Desempenho
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
