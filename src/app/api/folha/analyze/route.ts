import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
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

function looksLikeCpf(value: unknown): boolean {
    const s = String(value ?? "").replace(/\D/g, "")
    return s.length >= 8 && s.length <= 14 // Leniency for CPF/CNPJ or shorter numeric IDs
}

function looksLikeNumeric(value: unknown): boolean {
    const n = parseFloat(String(value ?? "").replace(",", "."))
    return !isNaN(n) && n >= 0
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

function matchHeader(header: string, candidates: string[]): boolean {
    const h = header.toLowerCase().trim().replace(/\s+/g, " ")
    return candidates.some((c) => h === c || h.includes(c))
}

// ── Auto-detect column indices by scanning cell contents ─────────────────────

function detectColumns(
    headers: string[],
    rows: Record<string, unknown>[]
): { cpfIdx: number; nomeIdx: number; valorIdx: number } {
    // 1st pass: match by header name
    let cpfIdx = headers.findIndex((h) => matchHeader(h, CPF_NAMES))
    let nomeIdx = headers.findIndex((h) => matchHeader(h, NOME_NAMES))
    let valorIdx = headers.findIndex((h) => matchHeader(h, VALOR_NAMES))

    // 2nd pass: scan cell content to find CPF column when name didn't match
    if (cpfIdx === -1) {
        const sample = rows.slice(0, 20)
        for (let col = 0; col < headers.length; col++) {
            const hits = sample.filter((r) => looksLikeCpf(r[headers[col]])).length
            if (hits >= Math.min(3, sample.length * 0.3)) { cpfIdx = col; break }
        }
    }

    // 3rd pass: find name column = string column, skip cpfIdx & already matched
    if (nomeIdx === -1 && cpfIdx !== -1) {
        for (let col = 0; col < headers.length; col++) {
            if (col === cpfIdx || col === valorIdx) continue
            const sample = rows.slice(0, 10)
            const strHits = sample.filter((r) => {
                const v = String(r[headers[col]] ?? "").trim()
                return v.length > 2 && isNaN(Number(v.replace(/[.,]/g, "")))
            }).length
            if (strHits >= sample.length * 0.5) { nomeIdx = col; break }
        }
    }

    // 4th pass: find value column = numeric, not cpf/nome
    if (valorIdx === -1) {
        for (let col = headers.length - 1; col >= 0; col--) {
            if (col === cpfIdx || col === nomeIdx) continue
            const sample = rows.slice(0, 10)
            const numHits = sample.filter((r) => looksLikeNumeric(r[headers[col]])).length
            if (numHits >= sample.length * 0.5) { valorIdx = col; break }
        }
    }

    return { cpfIdx, nomeIdx, valorIdx }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

    type PayrollRow = { cpf: string; nome: string; valor: number; sheet: string }
    const allRows: PayrollRow[] = []
    const debugInfo: Record<string, unknown>[] = []
    const sheetMap = new Map<string, { count: number; total: number }>()

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
        if (rawRows.length === 0) continue

        const headers = Object.keys(rawRows[0])
        const { cpfIdx, nomeIdx, valorIdx } = detectColumns(headers, rawRows)

        debugInfo.push({
            sheet: sheetName,
            totalRows: rawRows.length,
            headers,
            detected: {
                cpf: cpfIdx !== -1 ? headers[cpfIdx] : null,
                nome: nomeIdx !== -1 ? headers[nomeIdx] : null,
                valor: valorIdx !== -1 ? headers[valorIdx] : null,
            },
        })

        if (cpfIdx === -1) continue

        for (const row of rawRows) {
            const cpf = normalizeCpf(row[headers[cpfIdx]])
            if (cpf.length < 8) continue // Ensure at least some digits
            const nomeRaw = nomeIdx !== -1 ? String(row[headers[nomeIdx]] ?? "").trim() : "—"
            const nome = toTitleCase(nomeRaw)
            const valor = valorIdx !== -1 ? parseValue(row[headers[valorIdx]]) : 0
            allRows.push({ cpf, nome, valor, sheet: sheetName })

            const entry = sheetMap.get(sheetName) ?? { count: 0, total: 0 }
            entry.count += 1
            entry.total += valor
            sheetMap.set(sheetName, entry)
        }
    }

    // ── Aggregate by CPF ───────────────────────────────────────────────────────
    const aggregatedMap = new Map<string, { cpf: string; nome: string; valor: number; sheet: string; isAggregated: boolean }>()
    const duplicateCpfs = new Set<string>()

    for (const row of allRows) {
        if (aggregatedMap.has(row.cpf)) {
            const existing = aggregatedMap.get(row.cpf)!
            existing.valor += row.valor
            existing.isAggregated = true
            if (existing.sheet !== row.sheet) {
                existing.sheet = "várias"
            }
            duplicateCpfs.add(row.cpf)
        } else {
            aggregatedMap.set(row.cpf, { ...row, isAggregated: false })
        }
    }

    const finalRows = Array.from(aggregatedMap.values()) as PayrollRow[]
    const duplicates = Array.from(duplicateCpfs)

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
    const cpfs = finalRows.map((r) => r.cpf)
    const dbEmployees = await prisma.employee.findMany({
        where: { companyId, cpf: { in: cpfs } },
        select: { id: true, cpf: true, name: true },
    })
    const dbMap = new Map(dbEmployees.map((e) => [e.cpf ?? "", e]))

    const found = finalRows
        .filter((r: PayrollRow) => dbMap.has(r.cpf))
        .map((r: PayrollRow) => { const e = dbMap.get(r.cpf)!; return { id: e.id, nome: toTitleCase(e.name), cpf: r.cpf, valor: r.valor, sheet: r.sheet } })

    const missing = finalRows
        .filter((r: PayrollRow) => !dbMap.has(r.cpf))
        .map((r: PayrollRow) => ({ cpf: r.cpf, nome: r.nome, valor: r.valor, sheet: r.sheet }))

    const total = finalRows.reduce((sum: number, r: PayrollRow) => sum + r.valor, 0)

    // Per-sheet summary (all rows preserved)
    const sheetSummary: { sheet: string; count: number; total: number }[] = []
    for (const [sheet] of sheetMap.entries()) {
        const inSheet = allRows.filter((r) => r.sheet === sheet)
        sheetSummary.push({ sheet, count: inSheet.length, total: inSheet.reduce((s, r) => s + r.valor, 0) })
    }

    return NextResponse.json({ found, missing, total, sheetSummary, duplicates, debug: debugInfo })
}
