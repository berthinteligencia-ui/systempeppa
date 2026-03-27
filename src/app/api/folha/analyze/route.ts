import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

// ── CPF helpers ───────────────────────────────────────────────────────────────

const CPF_RE = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^\d{11}$/

function normalizeCpf(raw: unknown): string {
    let s = String(raw ?? "").replace(/\D/g, "")
    if (s.length > 0 && s.length < 11) {
        s = s.padStart(11, "0")
    }
    return s
}

function isValidCpf(cpf: string): boolean {
    if (cpf.length !== 11 || /^(.)\1+$/.test(cpf)) return false
    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i)
    let rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(9))) return false
    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i)
    rev = 11 - (sum % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(10))) return false
    return true
}

function looksLikeCpf(value: unknown): boolean {
    const s = String(value ?? "").replace(/\D/g, "")
    return s.length >= 8 && s.length <= 14 // Leniency for CPF/CNPJ or shorter numeric IDs
}

function looksLikeNumeric(value: unknown): boolean {
    const n = parseFloat(String(value ?? "").replace(",", "."))
    return !isNaN(n) && n >= 0
}

function looksLikeProfession(value: unknown): boolean {
    const s = String(value ?? "").trim()
    if (s.length < 3) return false
    // Reject strings that are mostly digits (IDs or codes)
    const digits = s.replace(/\D/g, "")
    if (digits.length > s.length * 0.4) return false
    // Reject strings that contain only numbers and symbols
    if (/^[\d\s\-\.\/]+$/.test(s)) return false
    return true
}

function parseValue(raw: unknown): number {
    return parseFloat(String(raw ?? "0").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0
}

function toTitleCase(str: string): string {
    if (!str) return "—"
    return str
        .toLowerCase()
        .split(" ")
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

// ── Column name candidates ────────────────────────────────────────────────────

const CPF_NAMES = ["cpf", "doc", "documento", "cpf/cnpj", "cnpj/cpf", "nr documento", "nr.documento", "nrdocumento", "registro", "matricula", "matrícula", "id", "c.p.f"]
const NOME_NAMES = ["nome", "name", "funcionario", "funcionário", "colaborador", "empregado", "trabalhador", "nomefuncionario", "nome funcionário", "nome funcionario", "servidor", "beneficiario", "beneficiário"]
const VALOR_NAMES = ["valor", "total", "liquido", "líquido", "bruto", "vencimento", "salario", "salário", "remuneracao", "remuneração", "pagamento", "totalvencimentos", "total vencimentos", "vlr", "vlrliquido", "vlrbruto", "proventos", "creditado", "valor pago", "vlr.pago"]
const TELEFONE_NAMES = ["telefone", "fone", "celular", "cel", "phone", "contato", "tel", "whatsapp", "zap", "fone/cel", "cel/fone", "numero", "número", "tel.", "cel.", "contato 1", "contato 2", "tel_contato", "telefone residencial", "telefone celular"]
const CARGO_NAMES = ["cargo", "função", "funcao", "ocupação", "ocupacao", "atividade", "posição", "posicao", "função/cargo", "cargo/função", "descr cargo", "descrição cargo", "cbo", "car.", "func.", "cargo atual", "função atual", "profissão", "profissao"]
const BANCO_NAMES = ["banco", "bank", "instituição", "instituicao", "nome banco", "ag./banco", "banco/ag."]
const AGENCIA_NAMES = ["agencia", "agência", "ag", "nr agencia", "nr agência", "ag.", "agencia pagadora"]
const CONTA_NAMES = ["conta", "account", "nr conta", "conta corrente", "cc", "c/c", "conta poupança", "conta pagamento"]

function matchHeader(header: string, candidates: string[]): boolean {
    const h = header.toLowerCase().trim().replace(/\s+/g, " ")
    return candidates.some((c) => h === c || h.includes(c))
}

// ── Auto-detect column indices by scanning cell contents ─────────────────────

function detectColumns(
    headers: string[],
    rows: Record<string, unknown>[]
): { cpfIdx: number; nomeIdx: number; valorIdx: number; telefoneIdx: number; cargoIdx: number; bancoIdx: number; agenciaIdx: number; contaIdx: number } {
    // 1st pass: match by header name
    let cpfIdx = headers.findIndex((h) => matchHeader(h, CPF_NAMES))
    let nomeIdx = headers.findIndex((h) => matchHeader(h, NOME_NAMES))
    let valorIdx = headers.findIndex((h) => matchHeader(h, VALOR_NAMES))
    let telefoneIdx = headers.findIndex((h) => matchHeader(h, TELEFONE_NAMES))
    let cargoIdx = headers.findIndex((h) => matchHeader(h, CARGO_NAMES))
    let bancoIdx = headers.findIndex((h) => matchHeader(h, BANCO_NAMES))
    let agenciaIdx = headers.findIndex((h) => matchHeader(h, AGENCIA_NAMES))
    let contaIdx = headers.findIndex((h) => matchHeader(h, CONTA_NAMES))

    // 2nd pass: scan cell content to find CPF column when name didn't match
    if (cpfIdx === -1) {
        const sample = rows.slice(0, 100) // Increased sample to 100 rows
        for (let col = 0; col < headers.length; col++) {
            const hits = sample.filter((r) => looksLikeCpf(r[headers[col]])).length
            if (hits >= 1) { cpfIdx = col; break }
        }
    }

    // 3rd pass: find name column = string column, skip cpfIdx & already matched
    if (nomeIdx === -1) {
        const sample = rows.slice(0, 100)
        for (let col = 0; col < headers.length; col++) {
            if (col === cpfIdx || col === valorIdx) continue
            const strHits = sample.filter((r) => {
                const v = String(r[headers[col]] ?? "").trim()
                return v.length > 2 && isNaN(Number(v.replace(/[.,]/g, "")))
            }).length
            if (strHits >= sample.length * 0.3) { nomeIdx = col; break } // Lowered threshold
        }
    }

    // 4th pass: find value column = numeric, not cpf/nome
    if (valorIdx === -1) {
        const sample = rows.slice(0, 100)
        for (let col = headers.length - 1; col >= 0; col--) {
            if (col === cpfIdx || col === nomeIdx) continue
            const numHits = sample.filter((r) => looksLikeNumeric(r[headers[col]])).length
            if (numHits >= sample.length * 0.3) { valorIdx = col; break } // Lowered threshold
        }
    }

    // 5th pass: find phone column = numeric, length 8-15
    if (telefoneIdx === -1) {
        const sample = rows.slice(0, 100)
        for (let col = 0; col < headers.length; col++) {
            if (col === cpfIdx || col === nomeIdx || col === valorIdx) continue
            const telHits = sample.filter((r) => {
                const v = String(r[headers[col]] ?? "").replace(/\D/g, "")
                return v.length >= 8 && v.length <= 15
            }).length
            if (telHits >= sample.length * 0.2) { telefoneIdx = col; break }
        }
    }

    // Cargo is detected ONLY by header name (passes 1). No content scan.
    // cargoIdx is already set (or -1) from the 1st pass above.

    return { cpfIdx, nomeIdx, valorIdx, telefoneIdx, cargoIdx, bancoIdx, agenciaIdx, contaIdx }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }
        const companyId = session.user.companyId

        const form = await req.formData()
        const file = form.get("file") as File | null
        if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })

        type PayrollRow = {
            cpf: string;
            nome: string;
            valor: number;
            sheet: string;
            telefone?: string;
            cargo?: string;
            bankName?: string;
            bankAgency?: string;
            bankAccount?: string;
            isInvalidCpf?: boolean;
        }
        const allRows: PayrollRow[] = []
        const extraRows: any[] = []
        const debugInfo: Record<string, unknown>[] = []
        const sheetMap = new Map<string, { count: number; total: number }>()

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]

            const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
            if (rawRows.length === 0) continue

            const headers = Object.keys(rawRows[0] || {})
            const { cpfIdx, nomeIdx, valorIdx, telefoneIdx, cargoIdx, bancoIdx, agenciaIdx, contaIdx } = detectColumns(headers, rawRows)

            console.log(`[Analyze] Sheet: ${sheetName}`, {
                headers,
                detected: {
                    cpf: cpfIdx !== -1 ? headers[cpfIdx] : "MISSING",
                    nome: nomeIdx !== -1 ? headers[nomeIdx] : "MISSING",
                    valor: valorIdx !== -1 ? headers[valorIdx] : "MISSING",
                    telefone: telefoneIdx !== -1 ? headers[telefoneIdx] : "MISSING",
                    cargo: cargoIdx !== -1 ? headers[cargoIdx] : "MISSING",
                    banco: bancoIdx !== -1 ? headers[bancoIdx] : "MISSING",
                    agencia: agenciaIdx !== -1 ? headers[agenciaIdx] : "MISSING",
                    conta: contaIdx !== -1 ? headers[contaIdx] : "MISSING"
                }
            })

            debugInfo.push({
                sheet: sheetName,
                totalRows: rawRows.length,
                headers,
                detected: {
                    cpf: cpfIdx !== -1 ? headers[cpfIdx] : null,
                    nome: nomeIdx !== -1 ? headers[nomeIdx] : null,
                    valor: valorIdx !== -1 ? headers[valorIdx] : null,
                    telefone: telefoneIdx !== -1 ? headers[telefoneIdx] : null,
                    cargo: cargoIdx !== -1 ? headers[cargoIdx] : null,
                    banco: bancoIdx !== -1 ? headers[bancoIdx] : null,
                    agencia: agenciaIdx !== -1 ? headers[agenciaIdx] : null,
                    conta: contaIdx !== -1 ? headers[contaIdx] : null,
                },
            })

            if (cpfIdx === -1 && nomeIdx === -1 && valorIdx === -1) continue

            for (const row of rawRows) {
                const cpfRaw = cpfIdx !== -1 ? row[headers[cpfIdx]] : ""
                const cpf = normalizeCpf(cpfRaw)
                
                const nomeRaw = nomeIdx !== -1 ? String(row[headers[nomeIdx]] ?? "").trim() : ""
                const nome = toTitleCase(nomeRaw)
                const valor = valorIdx !== -1 ? parseValue(row[headers[valorIdx]]) : 0
                
                const telefone = telefoneIdx !== -1
                    ? String(row[headers[telefoneIdx]] ?? "").replace(/\D/g, "").slice(0, 20) || undefined
                    : undefined
                const cargoRaw = cargoIdx !== -1 ? String(row[headers[cargoIdx]] ?? "").trim() : ""
                const cargo = (cargoRaw && looksLikeProfession(cargoRaw)) ? toTitleCase(cargoRaw) : undefined

                const bankName = bancoIdx !== -1 ? String(row[headers[bancoIdx]] ?? "").trim() : undefined
                const bankAgency = agenciaIdx !== -1 ? String(row[headers[agenciaIdx]] ?? "").trim() : undefined
                const bankAccount = contaIdx !== -1 ? String(row[headers[contaIdx]] ?? "").trim() : undefined

                const isInvalidCpf = !isValidCpf(cpf)

                // Skip truly empty rows
                if (!cpf && !nomeRaw && valor === 0) continue

                // Categorize
                if (cpf && cpf !== "00000000000") {
                    allRows.push({ cpf, nome, valor, sheet: sheetName, telefone, cargo, bankName, bankAgency, bankAccount, isInvalidCpf })
                } else if (nomeRaw && valor > 0) {
                    extraRows.push({ nome, cpfCnpj: cpfRaw || "—", valor, sheet: sheetName, telefone, cargo, bankName, bankAgency, bankAccount })
                } else {
                    continue
                }

                const entry = sheetMap.get(sheetName) ?? { count: 0, total: 0 }
                entry.count += 1
                entry.total += valor
                sheetMap.set(sheetName, entry)
            }
        }

        // ── Detect duplicates: same aba and cross-aba ────────────────────────────
        // same-aba: key = "sheet::cpf", cross-aba: cpf appears in more than one sheet
        const sheetCpfCount = new Map<string, number>()
        const cpfSheets = new Map<string, Set<string>>()
        for (const row of allRows) {
            const key = `${row.sheet}::${row.cpf}`
            sheetCpfCount.set(key, (sheetCpfCount.get(key) ?? 0) + 1)
            if (!cpfSheets.has(row.cpf)) cpfSheets.set(row.cpf, new Set())
            cpfSheets.get(row.cpf)!.add(row.sheet)
        }
        // "aba::cpf" keys where count > 1 (same-aba duplicate)
        const sameAbaDuplicates = new Set<string>()
        sheetCpfCount.forEach((count, key) => { if (count > 1) sameAbaDuplicates.add(key) })
        // CPFs that appear in more than one sheet
        const crossAbaDuplicates = new Set<string>()
        cpfSheets.forEach((sheets, cpf) => { if (sheets.size > 1) crossAbaDuplicates.add(cpf) })

        const finalRows = allRows as PayrollRow[]
        const duplicates = Array.from(sameAbaDuplicates)
        const crossAbaDuplicatesList = Array.from(crossAbaDuplicates)

        if (finalRows.length === 0) {
            return NextResponse.json(
                {
                    error: "Nenhuma linha com CPF válido foi encontrada na planilha.",
                    debug: debugInfo,
                },
                { status: 422 }
            )
        }

        // ── Cross-reference DB ────────────────────────────────────────────────────
        const cpfs = [...new Set(finalRows.map((r) => r.cpf))]
        const supabase = getSupabaseAdmin()
        const { data: dbEmployees, error: dbError } = await supabase
            .from("Employee")
            .select("id, cpf, name, phone, position, bankName, bankAgency, bankAccount")
            .eq("companyId", companyId)
            .in("cpf", cpfs)

        if (dbError) {
            console.error("[ANALYZE_ROUTE] DB Error:", dbError)
            return NextResponse.json({ error: "Erro ao conectar ao banco de dados" }, { status: 500 })
        }

        const dbMap = new Map((dbEmployees || []).map((e) => [e.cpf ?? "", e]))

        const found = finalRows
            .filter((r: PayrollRow) => dbMap.has(r.cpf))
            .map((r: PayrollRow) => {
                const e = dbMap.get(r.cpf)!;
                const dbName = toTitleCase(e.name)
                // Name mismatch check: normalize both and compare
                const normSheet = r.nome.toLowerCase().replace(/\s+/g, " ").trim()
                const normDb = dbName.toLowerCase().replace(/\s+/g, " ").trim()
                const nameMismatch = normSheet !== normDb && !normDb.includes(normSheet) && !normSheet.includes(normDb)

                return {
                    id: e.id,
                    nome: r.nome,
                    dbName: dbName,
                    cpf: r.cpf,
                    valor: r.valor,
                    sheet: r.sheet,
                    telefone: e.phone || r.telefone,
                    cargo: e.position || r.cargo,
                    bankName: e.bankName || r.bankName,
                    bankAgency: e.bankAgency || r.bankAgency,
                    bankAccount: e.bankAccount || r.bankAccount,
                    isInvalidCpf: r.isInvalidCpf,
                    nameMismatch
                }
            })

        const missing = finalRows
            .filter((r: PayrollRow) => !dbMap.has(r.cpf))
            .map((r: PayrollRow) => ({
                cpf: r.cpf,
                nome: r.nome,
                valor: r.valor,
                sheet: r.sheet,
                telefone: r.telefone,
                cargo: r.cargo,
                bankName: r.bankName,
                bankAgency: r.bankAgency,
                bankAccount: r.bankAccount,
                isInvalidCpf: r.isInvalidCpf
            }))

        // Employees found in DB but missing phone there, yet spreadsheet has a phone (dedup by CPF)
        const phoneUpdateMap = new Map<string, { id: string; nome: string; cpf: string; phoneInSheet: string }>()
        for (const r of finalRows) {
            if (!r.telefone || phoneUpdateMap.has(r.cpf)) continue
            const e = dbMap.get(r.cpf)
            if (e && !e.phone) phoneUpdateMap.set(r.cpf, { id: e.id, nome: toTitleCase(e.name), cpf: r.cpf, phoneInSheet: r.telefone! })
        }
        const phoneUpdates = Array.from(phoneUpdateMap.values())

        const total = allRows.reduce((sum, r) => sum + r.valor, 0) + extraRows.reduce((sum, r) => sum + r.valor, 0)

        // Per-sheet summary (all rows preserved)
        const sheetSummary: { sheet: string; count: number; total: number }[] = []
        for (const [sheet, data] of sheetMap.entries()) {
            sheetSummary.push({ sheet, ...data })
        }

        console.log(`[Analyze] Final response:`, {
            foundCount: found.length,
            missingCount: missing.length,
            extrasCount: extraRows.length,
            hasDebug: !!debugInfo,
        })
        return NextResponse.json({ found, missing, extras: extraRows, total, sheetSummary, duplicates, crossAbaDuplicates: crossAbaDuplicatesList, phoneUpdates, debug: debugInfo })
    } catch (e: any) {
        console.error("[ANALYZE_ROUTE] Unhandled error:", e)
        return NextResponse.json(
            { error: e?.message ?? "Erro interno ao processar a planilha." },
            { status: 500 }
        )
    }
}
