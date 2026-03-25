"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getEmployeeByCpf } from "./employees"
import { revalidatePath } from "next/cache"

export type ComprovanteData = {
  nome: string
  cpf: string
  situacao: string
  valor?: string
  cnpj_origem?: string
  generatedAt?: string
  // Validation fields
  dbEmployeeId?: string
  dbEmployeeName?: string
  isValid?: boolean
}

export async function extractComprovanteData(formData: FormData): Promise<ComprovanteData[]> {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")
  const companyId = session.user.companyId

  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo não enviado")

  const webhookUrl = "https://webhook.berthia.com.br/webhook/comprovanteon"

  try {
    // Encaminha o arquivo para o webhook externo da Berthia
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: formData
    })

    if (!response.ok) {
      throw new Error(`O serviço de análise externo retornou erro: ${response.status}`)
    }

    const result = await response.json()
    console.log("[EXTRACT_COMPROVANTE] Resposta Webhook:", JSON.stringify(result))

    // Formata a resposta do webhook para o padrão esperado pelo sistema
    const funcionarios = Array.isArray(result) ? result : (result.funcionarios || [result])
    
    const list: ComprovanteData[] = funcionarios.map((item: any): ComprovanteData => ({
      nome: String(item.funcionario || item.nome || item.employeeName || "Não detectado").trim(),
      cpf: String(item["funcionario _cpf"] || item.funcionario_cpf || item.cpf || "").replace(/\D/g, ""),
      situacao: String(item.situacao || item.status || "PROCESSADO").trim().toUpperCase(),
      valor: item.valor || item.amount ? String(item.valor || item.amount) : undefined,
      cnpj_origem: (item.origen || item.cnpj_origem || result.origen || result.cnpj_origem || "").replace(/\D/g, "") || undefined,
      generatedAt: item.data || item.generatedAt || result.data || result.generatedAt || undefined,
    }))

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ç/g, "C").toUpperCase().trim()

    // Validação contra o banco de dados (lookup de CPF ou Nome)
    for (const record of list) {
      let employee = null
      
      if (record.cpf) {
        employee = await getEmployeeByCpf(record.cpf)
      }

      // Fallback por Nome se não achar por CPF
      if (!employee && record.nome && record.nome !== "Não detectado") {
        const allEmployees = await prisma.employee.findMany({
          where: { companyId }
        })
        const targetName = normalize(record.nome)
        employee = allEmployees.find(e => normalize(e.name) === targetName)
      }

      if (employee) {
        record.dbEmployeeId = employee.id
        record.dbEmployeeName = employee.name
        record.isValid = true
      } else {
        record.isValid = false
      }
    }

    return list
  } catch (err: any) {
    console.error("[EXTRACT_COMPROVANTE] Erro no Webhook:", err.message)
    throw new Error("Falha ao analisar o comprovante via webhook: " + err.message)
  }
}


export async function saveComprovantes(data: {
    unidadeId?: string
    fechamentoId?: string
    records: (ComprovanteData & { fileName: string })[]
    fileData?: { name: string, type: string, buffer: ArrayBuffer }
}) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId

    // Get current company CNPJ
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { cnpj: true }
    })
    const companyCnpj = company?.cnpj?.replace(/\D/g, "")
    console.log(`[SAVE_COMPROVANTE] Company CNPJ: ${companyCnpj}`)

    let fileUrl = ""
    if (data.fileData) {
        const supabase = getSupabaseAdmin()
        const path = `${companyId}/${Date.now()}_${data.fileData.name}`
        const { data: uploadData, error } = await supabase.storage
            .from("comprovantes")
            .upload(path, data.fileData.buffer, {
                contentType: data.fileData.type,
                upsert: true
            })
        
        if (error) {
            console.error("[SAVE_COMPROVANTE] Erro upload storage:", error.message)
        } else if (uploadData) {
            const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path)
            fileUrl = urlData.publicUrl
        }
    }

    const created = await prisma.$transaction(async (tx) => {
        const results = []
        for (const r of data.records) {
            // Converte "2.496,16" para 2496.16
            let amount = null
            if (r.valor) {
                const cleanValor = String(r.valor).replace(/\./g, "").replace(",", ".")
                amount = parseFloat(cleanValor)
            }

            // Evitar duplicatas: verifica se já existe um comprovante com mesmo CPF, Valor e Data de Geração
            if (r.generatedAt) {
                const existing = await tx.comprovante.findFirst({
                    where: {
                        companyId,
                        cpf: r.cpf,
                        amount: amount,
                        generatedAt: r.generatedAt
                    }
                })
                if (existing) {
                    console.log(`[SAVE_COMPROVANTE] Duplicata detectada para CPF ${r.cpf} e data ${r.generatedAt}. Pulando.`)
                    continue
                }
            }

            const comprovante = await tx.comprovante.create({
                data: {
                    companyId,
                    fileName: r.fileName,
                    employeeName: r.nome,
                    cpf: r.cpf,
                    situacao: r.situacao,
                    amount: amount,
                    generatedAt: r.generatedAt || null,
                    employeeId: r.dbEmployeeId || null,
                    fechamentoId: data.fechamentoId || null,
                    fileUrl: fileUrl || null,
                    originCnpj: r.cnpj_origem || null,
                }
            })
            results.push(comprovante)

            // Update employee status if CNPJ matches and employee exists
            const rCnpj = r.cnpj_origem?.replace(/\D/g, "")
            console.log(`[SAVE_COMPROVANTE] Verificando: Empregado=${r.dbEmployeeId}, CNPJ_Ref=${rCnpj}, Empresa_CNPJ=${companyCnpj}`)
            
            if (r.dbEmployeeId && rCnpj && companyCnpj && rCnpj === companyCnpj) {
                console.log(`[SAVE_COMPROVANTE] Match! Atualizando pagamento para efetuado. ID: ${r.dbEmployeeId}`)
                await tx.employee.update({
                    where: { id: r.dbEmployeeId },
                    data: { pagamento: "efetuado" }
                })
            }
        }
        return results
    })

    revalidatePath("/comprovante")
    revalidatePath("/funcionarios")
    return { success: true, count: created.length }
}

export async function getEmployeeComprovantes(cpf: string, employeeId?: string) {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")
  const companyId = session.user.companyId

  const cleanCpf = cpf.replace(/\D/g, "")
  const records = await prisma.comprovante.findMany({
    where: { 
        companyId,
        OR: [
            { cpf: cleanCpf },
            employeeId ? { employeeId } : undefined
        ].filter(Boolean) as any
    },
    orderBy: { extractedAt: "desc" },
    select: {
      id: true, fileName: true, employeeName: true, cpf: true,
      situacao: true, amount: true, extractedAt: true, generatedAt: true, fileUrl: true, originCnpj: true,
    },
  })
  return records.map(r => ({ ...r, amount: r.amount ? Number(r.amount) : null }))
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

    const response = await fetch("https://webhook.berthia.com.br/webhook/aviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error("Falha ao enviar para o webhook externo.")
    }

    return { success: true, count: employees.length }
}

export async function deleteComprovante(id: string) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const role = session.user.role?.toUpperCase()
    if (role !== "ADMIN" && role !== "RH") {
        throw new Error("Apenas administradores ou RH podem excluir registros.")
    }

    await prisma.comprovante.delete({
        where: { id }
    })

    revalidatePath("/comprovante")
    revalidatePath("/funcionarios")
    return { success: true }
}
