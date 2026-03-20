"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEmployeeByCpf } from "./employees"
import { revalidatePath } from "next/cache"

export type ComprovanteData = {
  nome: string
  cpf: string
  situacao: string
  valor?: string
  // Validation fields
  dbEmployeeId?: string
  dbEmployeeName?: string
  isValid?: boolean
}

export async function extractComprovanteData(formData: FormData): Promise<ComprovanteData[]> {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo não enviado")

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada")

  const buffer = await file.arrayBuffer()

  try {
    // Extrair texto do PDF
    const { extractText } = await import("unpdf")
    const extracted = await extractText(new Uint8Array(buffer))
    const textContent = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text ?? "")
    console.log("[EXTRACT_COMPROVANTE] Texto extraído do PDF, tamanho:", textContent.length)

    if (!textContent || textContent.trim().length < 20) {
      throw new Error("Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.")
    }

    // Limitar tamanho para não exceder limite do OpenAI
    const truncated = textContent.substring(0, 12000)

    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey })

    const prompt = `Analise o texto abaixo extraído de um documento de pagamento brasileiro e extraia os dados de TODOS os funcionários encontrados.
O documento pode ser um comprovante individual ou um arquivo em lote com vários funcionários.

Retorne SOMENTE um JSON válido, sem markdown, sem explicações:
{
  "funcionarios": [
    { "nome": "NOME COMPLETO", "cpf": "apenas dígitos sem pontuação", "situacao": "LIBERADO ou PAGO ou PENDENTE etc", "valor": "valor numérico como string ex: 2496.16" }
  ]
}

Texto do documento:
${truncated}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é especializado em extrair dados de documentos de RH e folha de pagamento brasileiros. Responda apenas com JSON puro válido." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    })

    const resultText = response.choices[0].message.content
    if (!resultText) throw new Error("OpenAI retornou resposta vazia")

    console.log("[EXTRACT_COMPROVANTE] OpenAI resposta recebida, tamanho:", resultText.length)

    const parsed = JSON.parse(resultText)
    const lista: any[] = Array.isArray(parsed.funcionarios)
      ? parsed.funcionarios
      : Array.isArray(parsed)
        ? parsed
        : [parsed]

    console.log("[EXTRACT_COMPROVANTE] Registros parseados:", lista.length)

    const list: ComprovanteData[] = lista
      .filter((item: any) => item && (item.nome || item.cpf))
      .map((item: any): ComprovanteData => ({
        nome: String(item.nome || "Não detectado").trim(),
        cpf: String(item.cpf || "").replace(/\D/g, ""),
        situacao: String(item.situacao || "PROCESSADO").trim().toUpperCase(),
        valor: item.valor ? String(item.valor) : undefined,
      }))

    console.log("[EXTRACT_COMPROVANTE] Total após filtro:", list.length)

    // Validação contra o banco de dados (lookup de CPF)
    for (const record of list) {
      if (record.cpf) {
        const employee = await getEmployeeByCpf(record.cpf)
        if (employee) {
          record.dbEmployeeId = employee.id
          record.dbEmployeeName = employee.name
          record.isValid = true
        } else {
          record.isValid = false
        }
      }
    }

    return list
  } catch (err: any) {
    console.error("[EXTRACT_COMPROVANTE] Erro:", err.message)
    throw new Error("Falha ao analisar o comprovante: " + err.message)
  }
}


export async function saveComprovantes(data: {
    unidadeId?: string
    fechamentoId?: string
    records: (ComprovanteData & { fileName: string })[]
}) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId

    const created = await prisma.comprovante.createMany({
        data: data.records.map(r => {
            // Converte "2.496,16" para 2496.16
            let amount = null
            if (r.valor) {
                const cleanValor = r.valor.replace(/\./g, "").replace(",", ".")
                amount = parseFloat(cleanValor)
            }

            return {
                companyId,
                fileName: r.fileName,
                employeeName: r.nome,
                cpf: r.cpf,
                situacao: r.situacao,
                amount: amount,
                employeeId: r.dbEmployeeId || null,
                fechamentoId: data.fechamentoId || null,
            }
        })
    })

    revalidatePath("/comprovante")
    return created
}

export async function sendMassMessage(data: { departmentId: string, month: number, year: number }) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    
    const companyId = session.user.companyId
    const companyName = session.user.companyName || "Empresa"
    
    // Fetch employees for this unit with "efetuado" payment status
    const employees = await prisma.employee.findMany({
        where: {
            companyId,
            departmentId: data.departmentId === "all" ? undefined : data.departmentId,
            pagamento: {
                equals: "efetuado",
                mode: "insensitive"
            }
        },
        select: {
            name: true,
            cpf: true,
            pagamento: true,
            salary: true,
            phone: true
        }
    })

    if (employees.length === 0) {
        return { success: false, count: 0, message: "Nenhum funcionário com pagamento efetuado nesta unidade." }
    }

    const monthLabel = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ][data.month - 1]

    const payload = employees.map(e => ({
        company: companyName,
        month: monthLabel,
        year: data.year,
        employee: e.name,
        salary: Number(e.salary),
        contact: e.phone || "Não informado",
        cpf: e.cpf
    }))

    const response = await fetch("https://webhook.berthia.com.br/webhook/infopagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error("Falha ao enviar para o webhook externo.")
    }

    return { success: true, count: employees.length }
}
