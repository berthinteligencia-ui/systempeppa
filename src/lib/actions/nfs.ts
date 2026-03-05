"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export type NfStatus = "PENDENTE" | "ANALISADA" | "APROVADA" | "REJEITADA"

export type NotaFiscalInput = {
  numero: string
  emitente: string
  valor: number
  dataEmissao: string
  descricao?: string
}

export async function createNotaFiscal(data: NotaFiscalInput) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const nf = await prisma.notaFiscal.create({
    data: {
      numero: data.numero,
      emitente: data.emitente,
      valor: data.valor,
      dataEmissao: new Date(data.dataEmissao),
      descricao: data.descricao ?? null,
      status: "PENDENTE",
      companyId: session.user.companyId,
    },
  })

  revalidatePath("/nfs")
  return nf
}

export async function listNotasFiscais() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  return prisma.notaFiscal.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { createdAt: "desc" },
  })
}

export async function updateNotaFiscalStatus(id: string, status: NfStatus) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  await prisma.notaFiscal.update({
    where: { id, companyId: session.user.companyId },
    data: { status },
  })

  revalidatePath("/nfs")
}

export async function deleteNotaFiscal(id: string) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  await prisma.notaFiscal.delete({
    where: { id, companyId: session.user.companyId },
  })

  revalidatePath("/nfs")
}

export async function extractNfData(formData: FormData) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo não enviado")

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Chave de API da OpenAI (OPENAI_API_KEY) não configurada no .env")

  const { OpenAI } = await import("openai")

  const openai = new OpenAI({ apiKey })

  const buffer = await file.arrayBuffer()
  const { extractText } = await import("unpdf")
  const { text: textContent } = await extractText(new Uint8Array(buffer))

  const prompt = `Analise o texto abaixo extraído de uma Nota Fiscal e extraia os seguintes dados em formato JSON puro, sem markdown:
  - numero: o número da nota (string)
  - tomador: nome ou razão social do tomador do serviço (string)
  - cnpjTomador: CNPJ do tomador do serviço (string)
  - valorRetido: especificamente o valor da "Contribuição Previdenciária - Retida" (number)
  - dataEmissao: data de emissão no formato YYYY-MM-DD (string)
  - descricao: um breve resumo dos serviços ou produtos (string)

  Texto da NF:
  ${textContent}`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente especializado em extração de dados fiscais brasileiros. Responda apenas com o JSON puro." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    const resultText = response.choices[0].message.content
    if (!resultText) throw new Error("OpenAI retornou uma resposta vazia")

    const parsed = JSON.parse(resultText)

    // Combine Tomador and CNPJ for the emitente field
    const tomadorInfo = parsed.tomador && parsed.cnpjTomador
      ? `${parsed.tomador} - ${parsed.cnpjTomador}`
      : (parsed.tomador || parsed.cnpjTomador || "")

    return {
      numero: String(parsed.numero || ""),
      emitente: String(tomadorInfo),
      valor: parseFloat(String(parsed.valorRetido || 0).replace(",", ".")) || 0,
      dataEmissao: String(parsed.dataEmissao || ""),
      descricao: String(parsed.descricao || "")
    }
  } catch (err: any) {
    console.error("[EXTRACT_NF] OpenAI error:", err)
    throw new Error("Falha ao analisar a nota com OpenAI: " + err.message)
  }
}
