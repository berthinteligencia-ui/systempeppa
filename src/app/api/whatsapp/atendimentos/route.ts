export const dynamic = "force-dynamic"
export const revalidate = 0

import { auth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await auth()
    if (!session?.user?.companyId) return new NextResponse("Unauthorized", { status: 401 })
    const companyName = (session.user as any).companyName as string | undefined

    try {
        // Filtra diretamente pela coluna empresa (match exato com nome da empresa logada)
        let query = supabaseAdmin
            .from("atendimentos_lisa")
            .select("id, data_criacao, nome_identificacao, whatsapp_origem, descricao_solicitacao, status_cadastro, cpf_informado, status_resolucao, prazo_limite, cidade, empresa")
            .order("prazo_limite", { ascending: true })

        if (companyName) {
            query = query.eq("empresa", companyName)
        }

        const { data: atendimentos, error: atError } = await query
        if (atError) throw new Error(atError.message)

        const result = (atendimentos ?? []).map(at => {
            const prazo = at.prazo_limite ? new Date(at.prazo_limite) : null
            const now = new Date()
            const diffMs = prazo ? prazo.getTime() - now.getTime() : null
            const diffHours = diffMs !== null ? diffMs / (1000 * 60 * 60) : null
            const vencido = diffMs !== null && diffMs < 0

            return {
                id: at.id,
                dataCriacao: at.data_criacao,
                nome: at.nome_identificacao ?? "—",
                whatsapp: at.whatsapp_origem,
                descricao: at.descricao_solicitacao,
                statusCadastro: at.status_cadastro,
                statusResolucao: at.status_resolucao,
                prazoLimite: at.prazo_limite,
                cidade: at.cidade,
                empresa: at.empresa,
                vencido,
                diffHours,
            }
        })

        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (err: any) {
        console.error("[ATENDIMENTOS_GET]", err.message)
        return new NextResponse(JSON.stringify({ error: err.message }), { status: 500 })
    }
}
