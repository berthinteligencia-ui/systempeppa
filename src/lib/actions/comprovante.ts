"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getEmployeeByCpf } from "./employees"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

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

export async function extractComprovanteData(formData: FormData, bank?: string): Promise<ComprovanteData[]> {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")
  const companyId = session.user.companyId

  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo não enviado")

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { whatsappWebhookUrl: true }
  })

  // Use custom webhook if present, otherwise fallback to official Berthia OCR service
  const webhookUrl = company?.whatsappWebhookUrl || "https://webhook.berthia.com.br/webhook/disparofolha"
  const url = new URL(webhookUrl)
  if (bank) {
    url.searchParams.append("banco", bank)
    formData.append("banco", bank)
  }

  try {
    // Encaminha o arquivo para o webhook externo da Berthia
    const response = await fetch(url.toString(), {
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
    // Se o webhook fallhar, retornamos um registro genérico para "aceitar o PDF" conforme solicitado
    return [
      {
        nome: "ANÁLISE MANUAL NECESSÁRIA",
        cpf: "",
        situacao: "PENDENTE_ANALISE",
        isValid: false,
      }
    ]
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
    try {
        const session = await auth()
        if (!session?.user?.companyId) return { success: false, message: "Não autorizado" }
        
        const companyId = session.user.companyId
        const companyName = session.user.companyName || "Empresa"
        
        // Fetch employees with their department info
        const employees = await prisma.employee.findMany({
            where: {
                companyId,
                status: "ACTIVE",
                departmentId: data.departmentId === "all" ? undefined : data.departmentId,
                pagamento: {
                    equals: "efetuado",
                    mode: "insensitive"
                }
            },
            select: {
                id: true,
                name: true,
                cpf: true,
                pagamento: true,
                salary: true,
                phone: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })

        if (employees.length === 0) {
            return { success: false, count: 0, message: "Nenhum funcionário com pagamento efetuado nesta unidade." }
        }

        const monthLabel = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ][data.month - 1]

        // Group employees by department ID
        const groups: Record<string, { name: string, members: typeof employees }> = {}
        for (const e of employees) {
            const dId = e.department?.id || "unassigned"
            const dName = e.department?.name || "Sem Unidade"
            if (!groups[dId]) groups[dId] = { name: dName, members: [] }
            groups[dId].members.push(e)
        }

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { whatsappWebhookUrl: true }
        })

        const webhookUrl = company?.whatsappWebhookUrl || "https://webhook.berthia.com.br/webhook/envio-de-mensagem"
        let totalSent = 0

        // Send all unit hits in PARALLEL to avoid Vercel timeouts
        const webhookPromises = Object.keys(groups).map(async (dId) => {
            const group = groups[dId]
            const payload = {
                unidade: group.name,
                company: companyName,
                month: monthLabel,
                year: data.year,
                funcionarios: group.members.map(e => ({
                    nome: e.name,
                    employee: e.name,
                    salary: Number(e.salary),
                    contact: e.phone || "Não informado",
                    cpf: e.cpf
                }))
            }

            try {
                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
                if (response.ok) return group.members.length
            } catch (fetchErr) {
                console.error(`[SEND_MASS_MESSAGE] Network error for unit ${group.name}:`, fetchErr)
            }
            return 0
        })

        const results = await Promise.all(webhookPromises)
        totalSent = results.reduce((acc, count) => acc + count, 0)

        if (totalSent === 0 && employees.length > 0) {
            return { success: false, message: "Falha ao enviar para o webhook externo em todas as tentativas." }
        }

        // Optimization: Background/Batch logging of messages
        const now = new Date()
        const logData = employees
            .filter(e => e.phone && e.phone.replace(/\D/g, ""))
            .map(e => ({
                conteudo: `Aviso de pagamento de ${monthLabel}/${data.year} enviado com sucesso via ${e.department?.name || 'Unidade'}.`,
                tipo: "COMPANY",
                createdAt: now,
                numeroFuncionario: e.phone?.replace(/\D/g, ""),
                funcionario: "true"
            }))

        if (logData.length > 0) {
            // Using createMany for better performance in production
            await prisma.mensagensZap.createMany({
                data: logData,
                skipDuplicates: true
            })
        }

        return { success: true, count: totalSent }

    } catch (err: any) {
        console.error("[SEND_MASS_MESSAGE] Unexpected crash:", err.message)
        return { success: false, message: `Erro no servidor: ${err.message}` } 
    }
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
