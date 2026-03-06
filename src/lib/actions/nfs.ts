"use server"

import { getSupabaseAdmin, check } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

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

  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const id = randomUUID()

  const row = {
    id,
    numero: data.numero,
    emitente: data.emitente,
    valor: data.valor,
    dataEmissao: new Date(data.dataEmissao).toISOString(),
    descricao: data.descricao ?? null,
    status: "PENDENTE",
    companyId: session.user.companyId,
    createdAt: now,
    updatedAt: now,
  }

  check(await supabase.from("NotaFiscal").insert(row))

  revalidatePath("/nfs")
  return { ...row, valor: Number(row.valor) }
}

export async function listNotasFiscais() {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from("NotaFiscal")
    .select("*")
    .eq("companyId", session.user.companyId)
    .order("createdAt", { ascending: false })

  return (data ?? []).map(r => ({
    id: r.id,
    numero: r.numero,
    emitente: r.emitente,
    valor: Number(r.valor),
    dataEmissao: r.dataEmissao,
    descricao: r.descricao,
    status: r.status,
    companyId: r.companyId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function updateNotaFiscalStatus(id: string, status: NfStatus) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const supabase = getSupabaseAdmin()
  check(await supabase
    .from("NotaFiscal")
    .update({ status, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .eq("companyId", session.user.companyId)
  )

  revalidatePath("/nfs")
  revalidatePath("/dashboard")
}

export async function deleteNotaFiscal(id: string) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")

  const supabase = getSupabaseAdmin()
  check(await supabase
    .from("NotaFiscal")
    .delete()
    .eq("id", id)
    .eq("companyId", session.user.companyId)
  )

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

    return {
      numero: String(parsed.numero || ""),
      tomador: String(parsed.tomador || ""),
      cnpj: String(parsed.cnpjTomador || ""),
      valor: parseFloat(String(parsed.valorRetido || 0).replace(",", ".")) || 0,
      dataEmissao: String(parsed.dataEmissao || ""),
      descricao: String(parsed.descricao || "")
    }
  } catch (err: any) {
    console.error("[EXTRACT_NF] OpenAI error:", err)
    throw new Error("Falha ao analisar a nota com OpenAI: " + err.message)
  }
}
