import { redirect } from "next/navigation"
import { checkAdminAuth, listAllCompanies } from "@/lib/actions/admin"
import { AdminClient } from "./client"

export default async function AdminPage() {
    const isAuthed = await checkAdminAuth()
    if (!isAuthed) redirect("/admin/login")

    try {
        const companies = await listAllCompanies()
        return <AdminClient initialCompanies={companies} />
    } catch (error: any) {
        console.error("[ADMIN_PAGE_ERROR] Error loading companies:", error)
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8 text-center">
                <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-xl max-w-md">
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">Erro de Carregamento</h1>
                    <p className="text-slate-600 mb-6">
                        Não foi possível carregar a lista de empresas. Isso pode ser um problema de conexão com o banco de dados.
                    </p>
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-mono text-left mb-6 overflow-auto max-h-40">
                        {error?.message || "Erro desconhecido"}
                    </div>
                    <a 
                        href="/admin" 
                        className="block w-full bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 transition-colors"
                    >
                        Tentar Novamente
                    </a>
                </div>
            </div>
        )
    }
}
