import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Action types the AI can return
// update_valor  → change valor of a row identified by cpf+sheet
// update_field  → change nome/bankName/bankAgency/bankAccount/telefone/cargo of a row
// remove_row    → remove a row identified by cpf+sheet
type AIAction =
    | { type: "update_valor"; cpf: string; sheet: string; newValor: number }
    | { type: "update_field"; cpf: string; sheet: string; field: string; newValue: string }
    | { type: "remove_row"; cpf: string; sheet: string }

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
        const { found = [], missing = [], extras = [], sheetSummary = [], mes, ano, unidade, command, history = [] } = body

        // Build compact data representation — send full rows so AI can match by cpf+sheet
        function rowLine(r: any, idField = "cpf"): string {
            const parts = [
                `${idField}:${r[idField]}`,
                `sheet:"${r.sheet}"`,
                `nome:"${r.nome}"`,
                `valor:${r.valor}`,
            ]
            if (r.bankName)    parts.push(`banco:"${r.bankName}"`)
            if (r.bankAgency)  parts.push(`agencia:"${r.bankAgency}"`)
            if (r.bankAccount) parts.push(`conta:"${r.bankAccount}"`)
            if (r.pix)         parts.push(`pix:"${r.pix}"`)
            if (r.telefone)    parts.push(`tel:${r.telefone}`)
            if (r.cargo)       parts.push(`cargo:"${r.cargo}"`)
            return parts.join(" ")
        }

        const dataText = [
            `Período: ${mes}/${ano} | Unidade: ${unidade || "—"}`,
            ``,
            `=== ENCONTRADOS (${found.length}) ===`,
            ...found.map((r: any) => rowLine(r)),
            ``,
            `=== NÃO CADASTRADOS (${missing.length}) ===`,
            ...missing.map((r: any) => rowLine(r)),
            ``,
            `=== EXTRAS (${extras.length}) ===`,
            ...extras.map((r: any) => rowLine(r, "cpfCnpj")),
            ``,
            `=== RESUMO POR ABA ===`,
            ...sheetSummary.map((s: any) => `sheet:"${s.sheet}" count:${s.count} total:${s.total}`),
        ].join("\n")

        const { OpenAI } = await import("openai")
        const openai = new OpenAI({ apiKey })

        // Build message history for context
        const historyMessages = (history as { role: string; text: string }[]).slice(-6).map(h => ({
            role: h.role as "user" | "assistant",
            content: h.text,
        }))

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um assistente de correção de folha de pagamento. Seu trabalho é EXECUTAR comandos do usuário alterando os dados da planilha.

Você recebe os dados da folha no formato:
  cpf:XXXXX sheet:"nome_aba" nome:"Nome" valor:0000

Retorne SEMPRE um JSON puro (sem markdown) com esta estrutura:
{
  "message": "Descrição clara do que foi feito (quantas linhas alteradas, quais nomes/CPFs)",
  "actions": [ ...lista de ações... ]
}

Tipos de ação disponíveis:
- Alterar valor:     { "type": "update_valor", "cpf": "...", "sheet": "...", "newValor": 0000 }
- Remover linha:     { "type": "remove_row",   "cpf": "...", "sheet": "..." }
- Alterar campo:     { "type": "update_field",  "cpf": "...", "sheet": "...", "field": "nome|valor|bankName|bankAgency|bankAccount|pix|telefone|cargo", "newValue": "..." }
  (para alterar valor via update_field use "field":"valor" e "newValue": número como string, ex: "3500.00")

REGRAS:
- Use exatamente o cpf e sheet dos dados fornecidos (copie sem alteração)
- Se o usuário pedir para remover duplicados, remova TODAS as ocorrências duplicadas (mantenha só a primeira)
- Se o usuário pedir para alterar um valor, aplique a TODAS as linhas que correspondem ao critério
- Se for uma PERGUNTA sobre os dados (ex: quais bancos, quem não tem conta, qual o maior salário), responda com a análise no "message" e actions:[]
- Se for um COMANDO de alteração, execute e descreva no "message" o que foi alterado
- Responda sempre em português`
                },
                {
                    role: "user",
                    content: `Dados atuais da folha:\n\n${dataText}`,
                },
                ...historyMessages,
                {
                    role: "user",
                    content: command,
                },
            ],
            response_format: { type: "json_object" },
        })

        const resultText = response.choices[0].message.content
        if (!resultText) throw new Error("OpenAI retornou resposta vazia")

        const parsed = JSON.parse(resultText) as { message: string; actions: AIAction[] }
        return NextResponse.json(parsed)
    } catch (e: any) {
        console.error("[AI_ANALYZE] Error:", e)
        return NextResponse.json({ error: e?.message ?? "Erro ao processar comando" }, { status: 500 })
    }
}
