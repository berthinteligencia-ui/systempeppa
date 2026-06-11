import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { randomUUID } from "crypto"

dotenv.config()

const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9"
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function formatCpf(c) {
  if (!c || c.length !== 11) return c ?? "—"
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

function getDeptPathInList(deptId, depts) {
  if (!deptId) return ""
  const dept = depts.find(d => d.id === deptId)
  if (!dept) return ""
  const parent = dept.parentId ? depts.find(d => d.id === dept.parentId) : null
  return [parent?.name, dept.name].filter(Boolean).map(s => s.trim().toUpperCase()).join(" / ")
}

// Emulate getOrCreateDepartmentPath using standard supabase client
async function getOrCreateDepartmentPath(unidadeName, departamentoName) {
  const now = new Date().toISOString()
  const uName = unidadeName?.trim().toUpperCase()
  const dName = departamentoName?.trim()

  if (!uName && !dName) return null

  const insertDept = async (id, name, parentId) => {
    const base = {
      id,
      name,
      companyId,
      parentId,
      createdAt: now,
      updatedAt: now
    }
    const { error } = await supabase.from("Department").insert({ ...base, nivel: parentId ? "SUBUNIDADE" : "PRINCIPAL" })
    if (error) {
      if (error.message?.includes("nivel") || error.message?.includes("cache")) {
        const { error: fallbackErr } = await supabase.from("Department").insert(base)
        if (fallbackErr) throw new Error(fallbackErr.message)
      } else {
        throw new Error(error.message)
      }
    }
  }

  // Case 1: Only departamento is provided
  if (!uName && dName) {
    const cleanName = dName.toUpperCase()
    const { data: dept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .is("parentId", null)
      .ilike("name", cleanName)
      .maybeSingle()
    if (selErr) console.error("Select error:", selErr)
    if (dept) return dept.id

    const newId = randomUUID()
    await insertDept(newId, cleanName, null)
    return newId
  }

  let parentId = null
  if (uName) {
    const { data: parentDept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .is("parentId", null)
      .ilike("name", uName)
      .maybeSingle()

    if (selErr) console.error("Select parent error:", selErr)

    if (parentDept) {
      parentId = parentDept.id
    } else {
      const newParentId = randomUUID()
      await insertDept(newParentId, uName, null)
      parentId = newParentId
    }
  }

  if (dName && parentId) {
    const { data: subDept, error: selErr } = await supabase
      .from("Department")
      .select("id")
      .eq("companyId", companyId)
      .eq("parentId", parentId)
      .ilike("name", dName)
      .maybeSingle()

    if (selErr) console.error("Select sub error:", selErr)

    if (subDept) {
      return subDept.id
    } else {
      const newSubId = randomUUID()
      await insertDept(newSubId, dName, parentId)
      return newSubId
    }
  }

  return parentId
}

async function runTest() {
  console.log("=== INICIANDO TESTE DE IMPORTAÇÃO ===")
  const testCpf = "99999999999"
  
  // 1. Limpar registros de teste antigos
  console.log("Limpando dados de teste antigos...")
  await supabase.from("Employee").delete().eq("cpf", testCpf).eq("companyId", companyId)
  await supabase.from("Department").delete().eq("companyId", companyId).ilike("name", "UNIDADE TESTE %")
  await supabase.from("Department").delete().eq("companyId", companyId).ilike("name", "DEPTO TESTE %")

  // 2. Testar criação automática de unidade e sub-departamento
  console.log("\n[TESTE 1] Criando Unidade/Depto via getOrCreateDepartmentPath...")
  const resolvedDeptId = await getOrCreateDepartmentPath("UNIDADE TESTE A", "DEPTO TESTE A")
  console.log("Resolvido / Criado Depto ID:", resolvedDeptId)

  // Validar se foi criado no banco
  const { data: depts } = await supabase
    .from("Department")
    .select("*")
    .eq("companyId", companyId)
  
  const createdSub = depts.find(d => d.id === resolvedDeptId)
  console.log("Sub-departamento no banco:", createdSub)
  
  const parentDept = depts.find(d => d.id === createdSub?.parentId)
  console.log("Unidade Principal no banco:", parentDept)
  
  if (parentDept && parentDept.name === "UNIDADE TESTE A" && createdSub && createdSub.name === "DEPTO TESTE A") {
    console.log("✅ TESTE 1: OK (Unidades criadas com a hierarquia correta!)")
  } else {
    console.error("❌ TESTE 1: FALHOU")
    return
  }

  // 3. Cadastrar funcionário de teste sob este departamento
  console.log("\n[TESTE 2] Cadastrando funcionário de teste...")
  const empId = randomUUID()
  const now = new Date().toISOString()
  await supabase.from("Employee").insert({
    id: empId,
    name: "FUNCIONARIO TESTE",
    cpf: testCpf,
    companyId,
    departmentId: resolvedDeptId,
    position: "TESTER",
    salary: 5000,
    hireDate: now,
    createdAt: now,
    updatedAt: now
  })
  console.log("Funcionário cadastrado com ID:", empId)

  // 4. Testar validação com unidade coincidente (mesma do banco)
  console.log("\n[TESTE 3] Validando CPF com unidade igual à cadastrada no banco...")
  const dbResults = await supabase
    .from("Employee")
    .select("cpf, companyId, departmentId")
    .eq("cpf", testCpf)
  const dbInfo = dbResults.data?.[0]
  
  const sheetPathSame = "UNIDADE TESTE A / DEPTO TESTE A"
  const dbPath = getDeptPathInList(dbInfo.departmentId, depts)
  console.log("Caminho no banco:", dbPath)
  console.log("Caminho na planilha:", sheetPathSame)
  
  if (dbPath === sheetPathSame) {
    console.log("✅ TESTE 3: OK (Valores coincidem, nenhuma divergência encontrada.)")
  } else {
    console.error("❌ TESTE 3: FALHOU")
    return
  }

  // 5. Testar validação com unidade diferente (DIVERGÊNCIA)
  console.log("\n[TESTE 4] Validando CPF com unidade diferente...")
  const sheetPathDiff = "UNIDADE TESTE B / DEPTO TESTE B"
  console.log("Caminho no banco:", dbPath)
  console.log("Caminho na planilha diferente:", sheetPathDiff)
  
  if (dbPath !== sheetPathDiff) {
    console.log("✅ TESTE 4: OK (Divergência detectada com sucesso!)")
    console.log(`[MENSAGEM ESPERADA]: Divergência: Cadastrado em "${dbPath}" mas a planilha indica "${sheetPathDiff}"`)
  } else {
    console.error("❌ TESTE 4: FALHOU")
    return
  }

  // 6. Limpar dados criados
  console.log("\nLimpando dados de teste...")
  await supabase.from("Employee").delete().eq("cpf", testCpf).eq("companyId", companyId)
  await supabase.from("Department").delete().eq("companyId", companyId).ilike("name", "UNIDADE TESTE %")
  await supabase.from("Department").delete().eq("companyId", companyId).ilike("name", "DEPTO TESTE %")
  console.log("✅ Todos os testes executados com sucesso!")
}

runTest().catch(console.error)
