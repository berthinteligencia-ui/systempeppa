"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertCircle, RefreshCcw, Home } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Uncaught error:", error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
                <div className="size-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
                <p className="text-slate-500 mb-6">
                    Ocorreu um erro inesperado no servidor. O sistema já foi notificado.
                </p>

                {error.digest && (
                    <div className="bg-slate-50 rounded-lg p-3 mb-8 text-left">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID do Erro (Digest)</p>
                        <code className="text-xs font-mono text-slate-700 break-all">{error.digest}</code>
                        {process.env.NODE_ENV === "development" && (
                            <p className="mt-2 text-xs text-red-500">{error.message}</p>
                        )}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => reset()}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold transition-all"
                    >
                        <RefreshCcw className="h-4 w-4" /> Tentar Novamente
                    </button>

                    <Link
                        href="/"
                        className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-xl font-bold transition-all"
                    >
                        <Home className="h-4 w-4" /> Voltar ao Início
                    </Link>
                </div>
            </div>
        </div>
    )
}
