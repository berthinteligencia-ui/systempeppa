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
      const code = (result as any).code ?? result.error
      if (code === "DB_ERROR") {
        setError("Erro de conexão com o banco de dados. Tente novamente em instantes.")
      } else if (code === "USER_NOT_FOUND") {
        setError("E-mail não encontrado. Verifique e tente novamente.")
      } else if (code === "USER_INACTIVE") {
        setError("Conta desativada. Entre em contato com o administrador.")
      } else if (code === "WRONG_PASSWORD") {
        setError("Senha incorreta. Verifique e tente novamente.")
      } else {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.")
      }
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f6f6f8] font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      {/* Visual side - Left (approx. 62% on large screens) */}
      <div className="hidden lg:flex lg:w-[62%] bg-[#1e3b8a] relative overflow-hidden items-center justify-center p-12 xl:p-24">
        {/* Modern abstract background elements */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full border-[60px] border-white animate-pulse duration-7000"></div>
          <div className="absolute bottom-12 left-12 w-80 h-80 rounded-full border-[30px] border-white animate-pulse duration-10000 delay-1000"></div>
          <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/20 blur-3xl animate-pulse"></div>
        </div>

        <div className="relative z-10 text-white max-w-xl animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-4 mb-12">
            <div className="size-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
              <Landmark className="h-9 w-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase leading-none">PEPACORP</h1>
              <p className="text-xs font-bold text-blue-300 uppercase tracking-[0.2em] mt-1">Enterprise Finance</p>
            </div>
          </div>

          <h2 className="text-5xl xl:text-6xl font-black leading-[1.1] mb-8 tracking-tight">
            A inteligência que faltava na sua <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-200">gestão financeira.</span>
          </h2>
          <p className="text-xl text-blue-100/80 leading-relaxed mb-10 max-w-lg">
            Visualize, analise e tome decisões estratégicas com uma plataforma corporativa de alto desempenho e segurança bancária.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/10">
            <div className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-blue-400/20 flex items-center justify-center mt-0.5">
                <div className="size-2 rounded-full bg-blue-300"></div>
              </div>
              <p className="text-sm font-bold text-blue-100">Visão Consolidada</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-blue-400/20 flex items-center justify-center mt-0.5">
                <div className="size-2 rounded-full bg-blue-300"></div>
              </div>
              <p className="text-sm font-bold text-blue-100">Inteligência de Folha</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-blue-400/20 flex items-center justify-center mt-0.5">
                <div className="size-2 rounded-full bg-blue-300"></div>
              </div>
              <p className="text-sm font-bold text-blue-100">Segurança de Dados</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-5 rounded-full bg-blue-400/20 flex items-center justify-center mt-0.5">
                <div className="size-2 rounded-full bg-blue-300"></div>
              </div>
              <p className="text-sm font-bold text-blue-100">Suporte Prioritário</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form side - Right (approx. 38% on large screens) */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16 xl:p-24 bg-white relative">
        <div className="w-full max-w-[400px] space-y-10 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
          <div className="lg:hidden flex items-center gap-3 mb-12 justify-center">
            <div className="size-12 bg-[#1e3b8a] rounded-xl flex items-center justify-center shadow-2xl shadow-blue-900/20">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#1e3b8a] uppercase">PEPACORP</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Controle Financeiro</p>
            </div>
          </div>

          <div className="space-y-3 text-center lg:text-left">
            <h3 className="text-4xl font-black tracking-tight text-slate-900">Acesse agora</h3>
            <p className="text-slate-500 font-medium">Insira suas credenciais corporativas com segurança.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                E-mail Corporativo
              </label>
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="exemplo@pepacorp.com"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none group-hover:border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Senha de Sistema
                </label>
                <a href="#" className="text-xs font-bold text-[#1e3b8a] hover:text-blue-700 transition-colors">Esqueci a senha</a>
              </div>
              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white outline-none group-hover:border-slate-300"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="size-2.5 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                <p className="text-xs font-bold text-red-700 leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3b8a] hover:bg-[#162a63] text-white py-5 px-6 rounded-2xl font-black uppercase tracking-[0.15em] text-xs transition-all shadow-2xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 group overflow-hidden"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  Entrar na Plataforma
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
                </>
              )}
            </button>
          </form>

          <footer className="pt-12 flex flex-col items-center lg:items-start border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4 opacity-40 grayscale hover:grayscale-0 transition-all cursor-default">
              <div className="size-8 rounded-full border-2 border-slate-200 flex items-center justify-center font-bold text-[8px]">SSL</div>
              <div className="size-8 rounded-full border-2 border-slate-200 flex items-center justify-center font-bold text-[8px]">AES</div>
              <div className="size-8 rounded-full border-2 border-slate-200 flex items-center justify-center font-bold text-[8px]">2FA</div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              © 2026 PEPACORP • Sistema de Alta Performance
            </p>
          </footer>
        </div>

        {/* Backdrop Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/30 blur-[100px] pointer-events-none"></div>
      </div>
    </div>
  )
}
