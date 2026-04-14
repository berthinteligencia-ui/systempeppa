"use server"

import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { getEmployeeByCpf } from "./employees"
import { revalidatePath } from "next/cache"


export type ComprovanteData = {
  nome: string
  cpf: string
  situacao: string
  valor?: string
  cnpj_origem?: string
  generatedAt?: string // Usado como Data de Emissão
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
    
    const list: ComprovanteData[] = funcionarios.map((item: any): ComprovanteData => {
      // Prioriza chaves de funcionário/destino do webhook
      const rawCpf = String(
        item["funcionario _cpf"] || 
        item.funcionario_cpf || 
        item.destinatario_cpf || 
        item.cpf_favorecido || 
        item.cpf_destino || 
        item.cpf || 
        ""
      );
      
      // Limpeza estrita: apenas números
      const cleanCpf = rawCpf.replace(/\D/g, "");

      const rawValor = item.valor_pago || item.valor_transacao || item.valor || item.amount || "";
      
      return {
        nome: String(item.funcionario || item.nome || item.employeeName || "Não detectado").trim(),
        cpf: cleanCpf,
        situacao: String(item.situacao || item.status || "PROCESSADO").trim().toUpperCase(),
        valor: rawValor ? String(rawValor) : undefined,
        cnpj_origem: (item.origen || item.cnpj_origem || result.origen || result.cnpj_origem || "").replace(/\D/g, "") || undefined,
        generatedAt: item.data || item.generatedAt || result.data || result.generatedAt || undefined,
      };
    })

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ç/g, "C").toUpperCase().trim()

    // Validação contra o banco de dados (lookup de CPF ou Nome)
    for (const record of list) {
      let employee = null
      
      if (record.cpf) {
        employee = await getEmployeeByCpf(record.cpf)
      }

      // Fallback por Nome se não achar por CPF
      if (!employee && record.nome && record.nome !== "Não detectado") {
        const supabase = getSupabaseAdmin()
        const { data: allEmployees } = await supabase
          .from("Employee")
          .select("id, name, cpf")
          .eq("companyId", companyId)
        const targetName = normalize(record.nome)
        const found = (allEmployees ?? []).find((e: any) => normalize(e.name) === targetName)
        if (found) employee = found
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
    console.error("[EXTRACT_COMPROVANTE] Erro no Webhook, tentando extração local:", err.message)
    
    // Tenta extração local como fallback (usando unpdf)
    try {
      const buffer = await file.arrayBuffer()
      const { extractText } = await import("unpdf")
      const { text: textPages } = await extractText(new Uint8Array(buffer))
      const text = Array.isArray(textPages) ? textPages.join(" ") : String(textPages)
      
      const localResults = await localParseComprovante(text, companyId)
      
      if (localResults && localResults.length > 0) {
        return localResults
      }
    } catch (localErr: any) {
      console.error("[EXTRACT_COMPROVANTE] Erro na extração local:", localErr.message)
    }

    // Se tudo falhar, retorna o registro de erro amigável
    return [
      {
        nome: "ANÁLISE MANUAL NECESSÁRIA",
        cpf: "",
        situacao: "ERRO_EXTRACAO",
        isValid: false,
      }
    ]
  }
}

/**
 * Helper para extração local de dados (Fallback quando o webhook falha)
 */
async function localParseComprovante(text: string, companyId: string): Promise<ComprovanteData[]> {
    const supabase = getSupabaseAdmin()
    
    // 1. Encontra CPFs
    const cpfMatches = text.match(/\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\.\s]?\d{2}/g) ?? []
    const allCpfs = cpfMatches.map(c => c.replace(/\D/g, "")).filter(c => c.length === 11)
    const cpfsFound = [...new Set(allCpfs)]
    
    // 2. Tenta identificar o de DESTINO
    const DESTINO_KEYWORDS = ["FAVORECIDO", "DESTINATARIO", "PARA:", "RECEBEDOR", "CONTA DE DESTINO", "PIX", "CREDITADO", "DESTINO"];
    const upperText = text.toUpperCase();
    let destinationCpf: string | null = null;

    for (const keyword of DESTINO_KEYWORDS) {
        const index = upperText.indexOf(keyword);
        if (index !== -1) {
            const segment = upperText.substring(index, index + 250);
            const match = segment.match(/\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\.\s]?\d{2}/);
            if (match) {
                destinationCpf = match[0].replace(/\D/g, "");
                break;
            }
        }
    }

    const finalCpf = destinationCpf || (cpfsFound.length > 0 ? cpfsFound[0] : null);
    
    if (!finalCpf) return []

    // 3. Lookup no banco
    const { data: employee } = await supabase
        .from("Employee")
        .select("id, name, cpf")
        .eq("companyId", companyId)
        .eq("cpf", finalCpf)
        .maybeSingle()

    // 4. Tenta extrair VALOR (ex: R$ 1.234,56)
    const valorMatch = text.match(/(?:VALOR|TOTAL|PAGAMENTO|LIQUIDO|CREDITADO|PAGO|MONTANTE)[\s:]*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
    let valor = valorMatch ? valorMatch[1] : undefined

    if (!valor) {
        const allMoney = text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)
        if (allMoney && allMoney.length > 0) {
            const values = allMoney.map(v => parseFloat(v.replace(/\./g, "").replace(",", ".")))
            const maxVal = Math.max(...values)
            valor = maxVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
        }
    }

    // 5. Tenta extrair DATA DE EMISSÃO (ex: 05/04/2026)
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    const generatedAt = dateMatch ? dateMatch[1] : undefined;

    return [{
        nome: employee?.name || "Não detectado (Local)",
        cpf: finalCpf,
        situacao: "PROCESSADO_LOCAL",
        valor,
        generatedAt,
        dbEmployeeId: employee?.id,
        dbEmployeeName: employee?.name,
        isValid: !!employee
    }]
}


export async function saveComprovantes(formData: FormData) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const file = formData.get("file") as File | null
    const records: (ComprovanteData & { fileName: string })[] = JSON.parse(formData.get("records") as string)
    const fechamentoId = (formData.get("fechamentoId") as string) || null

    // Busca CNPJ da empresa via Supabase
    const { data: company } = await supabase
        .from("Company")
        .select("cnpj")
        .eq("id", companyId)
        .single()
    const companyCnpj = company?.cnpj?.replace(/\D/g, "")
    console.log(`[SAVE_COMPROVANTE] Company CNPJ: ${companyCnpj}`)

    // Upload do arquivo para storage (se houver)
    let fileUrl: string | null = null
    if (file && file.size > 0) {
        const path = `${companyId}/${Date.now()}_${file.name}`
        const fileBuffer = await file.arrayBuffer()
        const { data: uploadData, error } = await supabase.storage
            .from("comprovantes")
            .upload(path, fileBuffer, { contentType: file.type || "application/octet-stream", upsert: true })

        if (error) {
            console.error("[SAVE_COMPROVANTE] Erro upload storage:", error.message)
        } else if (uploadData) {
            const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path)
            fileUrl = urlData.publicUrl
        }
    }

    let savedCount = 0
    let duplicatesCount = 0
    for (const r of records) {
        // Converte "2.496,16" → 2496.16
        let amount: number | null = null
        if (r.valor) {
            const cleanValor = String(r.valor).replace(/\./g, "").replace(",", ".")
            amount = parseFloat(cleanValor) || null
        }

        // Evitar duplicatas por CPF + valor + data (dia de emissão)
        const { data: existing } = await supabase
            .from("Comprovante")
            .select("id")
            .eq("companyId", companyId)
            .eq("cpf", r.cpf)
            .eq("amount", amount)
            .eq("generatedAt", r.generatedAt || null)
            .maybeSingle()
            
        if (existing) {
            console.log(`[SAVE_COMPROVANTE] Duplicata detectada: CPF ${r.cpf}, Valor ${amount}, Data ${r.generatedAt}. Pulando.`)
            duplicatesCount++
            continue
        }

        const { error: insertError } = await supabase.from("Comprovante").insert({
            id: globalThis.crypto.randomUUID(),
            companyId,
            fileName: r.fileName,
            employeeName: r.nome,
            cpf: r.cpf,
            situacao: r.situacao,
            amount,
            generatedAt: r.generatedAt || null,
            employeeId: r.dbEmployeeId || null,
            fechamentoId,
            fileUrl,
            originCnpj: r.cnpj_origem || null,
            extractedAt: new Date().toISOString(),
        })

        if (insertError) {
            console.error("[SAVE_COMPROVANTE] Erro insert:", insertError.message)
            continue
        }

        savedCount++

        // Atualiza status do funcionário se CNPJ bater
        const rCnpj = r.cnpj_origem?.replace(/\D/g, "")
        if (r.dbEmployeeId && rCnpj && companyCnpj && rCnpj === companyCnpj) {
            console.log(`[SAVE_COMPROVANTE] Match CNPJ! Atualizando pagamento. ID: ${r.dbEmployeeId}`)
            await supabase.from("Employee")
                .update({ pagamento: "efetuado", updatedAt: new Date().toISOString() })
                .eq("id", r.dbEmployeeId)
        }
    }

    revalidatePath("/comprovante")
    revalidatePath("/funcionarios")
    return { success: true, count: savedCount, duplicates: duplicatesCount }
}

export async function analisarESalvarComprovante(formData: FormData) {
    const session = await auth()
    if (!session?.user?.companyId) throw new Error("Não autorizado")
    const companyId = session.user.companyId
    const supabase = getSupabaseAdmin()

    const file = formData.get("file") as File | null
    if (!file || file.size === 0) throw new Error("Arquivo não recebido")

    // 1. Extrai texto do PDF localmente
    // Lê duas vezes: unpdf desanexa o ArrayBuffer após uso
    const bufferForText = await file.arrayBuffer()
    const bufferForUpload = await file.arrayBuffer()
    const { extractText } = await import("unpdf")
    const { text: textPages } = await extractText(new Uint8Array(bufferForText))
    const text = Array.isArray(textPages) ? textPages.join(" ") : String(textPages)

    // 2. Extrai dados localmente usando o helper
    const localResults = await localParseComprovante(text, companyId)
    const result = localResults[0]; // Pega o primeiro (único para comprovante individual)

    if (!result) {
        throw new Error("Nenhum dado de destino encontrado no comprovante.")
    }

    const { cpf: finalCpfToLookup, dbEmployeeId, dbEmployeeName } = result;

    console.log("[ANALISAR] Resultado local:", dbEmployeeName ?? "Nenhum", "CPF:", finalCpfToLookup);

    // 4. Upload do PDF para storage
    const path = `${companyId}/comprovantes/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(path, bufferForUpload, { contentType: file.type || "application/pdf", upsert: true })

    if (uploadError) throw new Error("Falha no upload: " + uploadError.message)

    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path)
    const fileUrl = urlData.publicUrl

    // 5. De-duplicação individual (CPF + Valor + Data)
    const rawValor = result.valor ? parseFloat(result.valor.replace(/\./g, "").replace(",", ".")) : null;
    const { data: existing } = await supabase
        .from("Comprovante")
        .select("id")
        .eq("companyId", companyId)
        .eq("cpf", finalCpfToLookup)
        .eq("amount", rawValor)
        .eq("generatedAt", result.generatedAt || null)
        .maybeSingle()

    if (existing) {
        console.log(`[ANALISAR] Já existe um registro idêntico para ${finalCpfToLookup}. Ignorando upload.`);
        return { success: true, alreadyExists: true, employeeName: dbEmployeeName ?? null }
    }

    // 6. Insere registro
    const { error: insertError } = await supabase.from("Comprovante").insert({
        id: globalThis.crypto.randomUUID(),
        companyId,
        fileName: file.name,
        employeeName: dbEmployeeName ?? "Não identificado",
        cpf: finalCpfToLookup ?? "",
        situacao: "PAGO",
        amount: rawValor,
        generatedAt: result.generatedAt || null,
        employeeId: dbEmployeeId ?? null,
        fileUrl,
        extractedAt: new Date().toISOString(),
    })

    if (insertError) throw new Error("Falha ao salvar: " + insertError.message)

    console.log("[ANALISAR] Salvo! employeeId:", dbEmployeeId ?? "null")
    revalidatePath("/comprovante")
    revalidatePath("/funcionarios")
    return { success: true, employeeName: dbEmployeeName ?? null, cpfsFound: [finalCpfToLookup].filter(Boolean) as string[] }
}

export async function saveComprovanteManual(formData: FormData) {
    try {
        const session = await auth()
        if (!session?.user?.companyId) throw new Error("Não autorizado")
        const companyId = session.user.companyId
        const supabase = getSupabaseAdmin()

        // 1. Lê campos do FormData
        const file = formData.get("file") as File | null
        const employeeId = formData.get("employeeId") as string
        const employeeName = formData.get("employeeName") as string
        const cpf = formData.get("cpf") as string

        if (!file || file.size === 0) throw new Error("Arquivo não recebido ou vazio")

        const cpfToSave = cpf.replace(/\D/g, "")
        console.log("[SAVE_MANUAL] file:", file.name, "size:", file.size, "cpf:", cpfToSave, "employeeId:", employeeId)

        // 2. Upload do arquivo para storage
        const fileBuffer = await file.arrayBuffer()
        const path = `${companyId}/manual/${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("comprovantes")
            .upload(path, fileBuffer, { contentType: file.type || "application/octet-stream", upsert: true })

        if (uploadError) {
            console.error("[SAVE_MANUAL] Erro upload:", uploadError.message)
            throw new Error("Falha no upload: " + uploadError.message)
        }

        let fileUrl: string | null = null
        if (uploadData) {
            const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path)
            fileUrl = urlData.publicUrl
        }

        console.log("[SAVE_MANUAL] fileUrl:", fileUrl)

        // 3. Insere registro
        const { error: insertError } = await supabase.from("Comprovante").insert({
            id: globalThis.crypto.randomUUID(),
            companyId,
            fileName: file.name,
            employeeName,
            cpf: cpfToSave,
            situacao: "PAGO",
            amount: null,
            generatedAt: null,
            employeeId,
            fileUrl,
            extractedAt: new Date().toISOString(),
        })

        if (insertError) {
            console.error("[SAVE_MANUAL] Erro insert:", insertError.message)
            throw new Error("Falha ao salvar: " + insertError.message)
        }

        console.log("[SAVE_MANUAL] Sucesso!")
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
  const supabase = getSupabaseAdmin()

  const cleanCpf = cpf.replace(/\D/g, "")

  console.log("[GET_COMPROVANTES] companyId:", companyId, "cpf:", cleanCpf, "employeeId:", employeeId)

  // Busca por CPF
  const { data: byCpf, error: e1 } = await supabase
    .from("Comprovante")
    .select("id, fileName, employeeName, cpf, situacao, amount, extractedAt, generatedAt, fileUrl, originCnpj")
    .eq("companyId", companyId)
    .eq("cpf", cleanCpf)
    .order("extractedAt", { ascending: false })

  if (e1) console.error("[GET_COMPROVANTES] erro byCpf:", e1.message)

  // Busca por employeeId
  const byCpfIds = new Set((byCpf ?? []).map((r: any) => r.id))
  let byEmployee: any[] = []
  if (employeeId) {
    const { data: byEmp, error: e2 } = await supabase
      .from("Comprovante")
      .select("id, fileName, employeeName, cpf, situacao, amount, extractedAt, generatedAt, fileUrl, originCnpj")
      .eq("companyId", companyId)
      .eq("employeeId", employeeId)
      .order("extractedAt", { ascending: false })

    if (e2) console.error("[GET_COMPROVANTES] erro byEmployee:", e2.message)
    byEmployee = (byEmp ?? []).filter((r: any) => !byCpfIds.has(r.id))
  }

  const merged = [...(byCpf ?? []), ...byEmployee]
    .sort((a: any, b: any) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime())

  console.log("[GET_COMPROVANTES] total encontrado:", merged.length)

  return merged.map((r: any) => ({
    id: r.id,
    fileName: r.fileName,
    employeeName: r.employeeName,
    cpf: r.cpf,
    situacao: r.situacao,
    amount: r.amount != null ? Number(r.amount) : null,
    extractedAt: r.extractedAt,
    generatedAt: r.generatedAt,
    fileUrl: r.fileUrl,
    originCnpj: r.originCnpj,
  }))
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

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("Comprovante").delete().eq("id", id)
    if (error) throw new Error("Erro ao excluir: " + error.message)

    revalidatePath("/comprovante")
    revalidatePath("/funcionarios")
    return { success: true }
}
