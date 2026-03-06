import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: "OPENAI_API_KEY não configurada no .env" }, { status: 500 })
        }

        const body = await req.json()
        const { found = [], missing = [], extras = [], total = 0, sheetSummary = [], mes, ano, unidade } = body

        const totalFound   = found.length
        const totalMissing = missing.length
        const totalExtras  = extras.length

        // Build a concise text summary to send to the model
        const dataText = `
Período: ${mes}/${ano}
Unidade: ${unidade || "Não especificada"}
Total da folha: R$ ${Number(total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

Resumo por aba:
${sheetSummary.map((s: any) => `  - ${s.sheet}: ${s.count} colaboradores | R$ ${Number(s.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n")}

Colaboradores encontrados no sistema (${totalFound}):
${found.slice(0, 30).map((f: any) => `  - ${f.nome} | CPF: ***${f.cpf?.slice(-4)} | R$ ${Number(f.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | Aba: ${f.sheet}`).join("\n")}
${totalFound > 30 ? `  ... e mais ${totalFound - 30} colaboradores` : ""}

Colaboradores NÃO cadastrados no sistema (${totalMissing}):
${missing.map((m: any) => `  - ${m.nome} | CPF: ***${m.cpf?.slice(-4)} | R$ ${Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") || "  Nenhum"}

Lançamentos extras (${totalExtras}):
${extras.map((e: any) => `  - ${e.nome} | ${e.cpfCnpj} | R$ ${Number(e.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") || "  Nenhum"}
        `.trim()

        const { OpenAI } = await import("openai")
        const openai = new OpenAI({ apiKey })

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um analista especializado em folhas de pagamento brasileiras.
Analise os dados fornecidos e retorne um JSON puro (sem markdown) com a seguinte estrutura:
{
  "resumo": "parágrafo curto resumindo a folha",
  "insights": ["insight 1", "insight 2", ...],
  "alertas": ["alerta 1", "alerta 2", ...],
  "recomendacoes": ["recomendação 1", ...]
}
- insights: observações relevantes sobre os dados (valores, distribuição, anomalias)
- alertas: pontos críticos que precisam de atenção (ex: colaboradores não cadastrados, valores discrepantes)
- recomendacoes: ações sugeridas
Seja objetivo e direto. Máximo 4 itens em cada lista.`
                },
                {
                    role: "user",
                    content: `Analise esta folha de pagamento:\n\n${dataText}`
                }
            ],
            response_format: { type: "json_object" },
        })

        const resultText = response.choices[0].message.content
        if (!resultText) throw new Error("OpenAI retornou resposta vazia")

        const parsed = JSON.parse(resultText)
        return NextResponse.json(parsed)
    } catch (e: any) {
        console.error("[AI_ANALYZE] Error:", e)
        return NextResponse.json({ error: e?.message ?? "Erro ao analisar com IA" }, { status: 500 })
    }
}
