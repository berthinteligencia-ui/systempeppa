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

export async function extractComprovanteData(formData: FormData, bank?: string, type?: "relatorio" | "comprovante"): Promise<ComprovanteData[]> {
  const session = await auth()
  if (!session?.user?.companyId) throw new Error("Não autorizado")
  const companyId = session.user.companyId

  const file = formData.get("file") as File
  if (!file) throw new Error("Arquivo não enviado")

  // URL fixa por tipo: relatório usa /relatorio, comprovante usa /disparofolha
  const webhookUrl = type === "relatorio"
    ? "https://webhook.berthia.com.br/webhook/relatorio"
    : "https://webhook.berthia.com.br/webhook/disparofolha"
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

export async function saveComprovanteManual(data: {
    employeeId: string
    employeeName: string
    cpf: string
    valor: string
    situacao: string
    mesAno: string          // "MM/AAAA"
    fileName: string
    fileType: string
    fileBuffer: ArrayBuffer
}) {
    try {
        const session = await auth()
        if (!session?.user?.companyId) throw new Error("Não autorizado")
        const companyId = session.user.companyId

        // Upload do arquivo
        const supabase = getSupabaseAdmin()
        let fileUrl: string | null = null

        const path = `${companyId}/manual/${Date.now()}_${data.fileName}`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("comprovantes")
            .upload(path, data.fileBuffer, { contentType: data.fileType, upsert: true })

        if (uploadError) {
            console.error("[SAVE_MANUAL] Erro upload:", uploadError.message)
            throw new Error("Falha no upload do arquivo: " + uploadError.message)
        }
        if (uploadData) {
            const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path)
            fileUrl = urlData.publicUrl
        }

        // Salva no banco via Supabase
        const [mes, ano] = data.mesAno.split("/")
        const generatedAt = ano && mes ? `${ano}-${mes.padStart(2, "0")}-01` : null

        const cleanValor = data.valor.replace(/\./g, "").replace(",", ".")
        const amount = parseFloat(cleanValor) || null

        const { error: insertError } = await supabase.from("Comprovante").insert({
            companyId,
            fileName: data.fileName,
            employeeName: data.employeeName,
            cpf: data.cpf.replace(/\D/g, ""),
            situacao: data.situacao,
            amount,
            generatedAt,
            employeeId: data.employeeId,
            fileUrl,
            extractedAt: new Date().toISOString(),
        })

        if (insertError) {
            console.error("[SAVE_MANUAL] Erro insert:", insertError.message)
            throw new Error("Falha ao salvar registro: " + insertError.message)
        }

        revalidatePath("/funcionarios")
        revalidatePath("/comprovante")
        return { success: true }
    } catch (err: any) {
        console.error("[SAVE_MANUAL] Erro:", err?.message ?? err)
        throw err
    }
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
        const supabase = getSupabaseAdmin()

        // Busca funcionários ativos com pagamento efetuado via Supabase
        let empQuery = supabase
            .from("Employee")
            .select("id, name, cpf, salary, phone, departmentId, Department(id, name)")
            .eq("companyId", companyId)
            .eq("status", "ACTIVE")
            .ilike("pagamento", "efetuado")

        if (data.departmentId !== "all") {
            empQuery = empQuery.eq("departmentId", data.departmentId)
        }

        const { data: employees, error: empError } = await empQuery

        if (empError) throw new Error(empError.message)

        if (!employees || employees.length === 0) {
            return { success: false, count: 0, message: "Nenhum funcionário com pagamento efetuado nesta unidade." }
        }

        const monthLabel = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ][data.month - 1]

        // Busca token da empresa
        const { data: company } = await supabase
            .from("Company")
            .select("webhookToken")
            .eq("id", companyId)
            .single()

        const webhookUrl = "https://webhook.berthia.com.br/webhook/enviomassa"
        const webhookToken = company?.webhookToken || null

        // Agrupa por unidade
        type EmpRow = typeof employees[number]
        const groups: Record<string, { name: string; members: EmpRow[] }> = {}
        for (const e of employees) {
            const dept = (e as any).Department
            const dId = dept?.id || "unassigned"
            const dName = dept?.name || "Sem Unidade"
            if (!groups[dId]) groups[dId] = { name: dName, members: [] }
            groups[dId].members.push(e)
        }

        // Envia um payload por unidade
        const webhookPromises = Object.values(groups).map(async (group) => {
            const payload = {
                token: webhookToken,
                unidade: group.name,
                company: companyName,
                month: monthLabel,
                year: data.year,
                funcionarios: group.members.map(e => ({
                    nome: e.name,
                    employee: e.name,
                    salary: Number(e.salary),
                    contact: e.phone || "Não informado",
                    cpf: e.cpf,
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
                console.error(`[SEND_MASS_MESSAGE] Erro ao enviar unidade ${group.name}:`, fetchErr)
            }
            return 0
        })

        const results = await Promise.all(webhookPromises)
        const totalSent = results.reduce((acc, n) => acc + n, 0)

        if (totalSent === 0) {
            return { success: false, message: "Falha ao enviar para o webhook externo." }
        }

        return { success: true, count: totalSent }

    } catch (err: any) {
        console.error("[SEND_MASS_MESSAGE] Erro:", err.message)
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
