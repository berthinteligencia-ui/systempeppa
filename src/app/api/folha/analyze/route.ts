import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { auth } from "@/lib/auth"

// ── Bank name normalization ───────────────────────────────────────────────────

const BANK_PATTERNS: [RegExp, string][] = [
    [/bradesco/i,                                              "Bradesco"],
    [/banco.?do.?brasil|^brasil$|^bb$|^001$/i,                "Banco do Brasil"],
    [/nubank|nubanck|nu.?pagamentos|nupag|^0?260$/i,          "Nubank"],
    [/caixa|cef|poupan.a.caixa|^104$/i,                      "Caixa Econômica Federal"],
    [/santander|^033$/i,                                      "Santander"],
    [/ita[uú]|^341$/i,                                        "Itaú"],
    [/\binter\b|^077$/i,                                      "Banco Inter"],
    [/\bnext\b/i,                                             "Next"],
    [/\bneon\b/i,                                             "Neon"],
    [/mercado.?pago/i,                                        "Mercado Pago"],
    [/banco.?c6|c6.?bank|c6.?s\.?a|^c6$|^336$/i,            "Banco C6"],
    [/pagbank|pagseguro|pakbank|^290$/i,                      "PagBank"],
    [/nordeste|^004$/i,                                       "Banco do Nordeste"],
    [/picpay|pic.?pay/i,                                      "PicPay"],
    [/sicredi/i,                                              "Sicredi"],
    [/sicoob/i,                                               "Sicoob"],
    [/banco.?original|\boriginal\b|^212$/i,                   "Banco Original"],
    [/safra|^422$/i,                                          "Banco Safra"],
    [/btg.?pactual|^208$/i,                                   "BTG Pactual"],
    [/\bxp\b|^102$/i,                                         "XP"],
    [/\bstone\b|^197$/i,                                      "Stone"],
    [/banrisul|^041$/i,                                       "Banrisul"],
    [/unicred/i,                                              "Unicred"],
    [/\bbs2\b|^218$/i,                                        "BS2"],
    [/will.?bank/i,                                           "Will Bank"],
    [/agi.?bank|agibank/i,                                    "Agibank"],
    [/creditas/i,                                             "Creditas"],
    [/banco.?pan|\bpan\b|^623$/i,                             "Banco Pan"],
    [/modal|^746$/i,                                          "Banco Modal"],
    [/c2.?bank/i,                                                  "C2 Bank"],
    [/^380$|limebank/i,                                            "PicPay Bank"],
    [/votorantim|^655$/i,                                          "Banco Votorantim"],
    [/daycoval|^707$/i,                                            "Banco Daycoval"],
    [/mentore/i,                                                   "MENTORE"],
    [/pix/i,                                                       "PIX"],
]

function normalizeBankName(raw: string | undefined | null): string | undefined {
    if (!raw || raw.trim() === "") return undefined
    const s = raw.trim()
    // Looks like account number (CC:, C/C:, or pure digits/dashes)
    if (/^(cc:|c\/c:|conta |ag\.)/i.test(s)) return undefined
    if (/^\d[\d.\-/\s]*\d$/.test(s)) return undefined
    for (const [pattern, canonical] of BANK_PATTERNS) {
        if (pattern.test(s)) return canonical
    }
    return s // keep original if unrecognized — do not discard
}

// ── CPF helpers ───────────────────────────────────────────────────────────────


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
const NOME_NAMES = ["nome", "name", "funcionario", "funcionário", "colaborador", "empregado", "trabalhador", "nomefuncionario", "nome funcionário", "nome funcionario", "servidor", "beneficiario", "beneficiário", "nome completo", "razao social", "razão social"]
const VALOR_NAMES = ["valor", "total", "liquido", "líquido", "bruto", "vencimento", "salario", "salário", "remuneracao", "remuneração", "pagamento", "totalvencimentos", "total vencimentos", "vlr", "vlrliquido", "vlrbruto", "proventos", "creditado", "valor pago", "vlr.pago", "sal liquido", "sal. liquido", "salario liquido", "salário líquido", "sal bruto", "sal. bruto", "salario bruto", "salário bruto", "sal base", "salario base", "vencimentos", "liquido a receber", "líquido a receber"]
const TELEFONE_NAMES = ["telefone", "fone", "celular", "cel", "phone", "contato", "tel", "whatsapp", "zap", "fone/cel", "cel/fone", "numero", "número", "tel.", "cel.", "contato 1", "contato 2", "tel_contato", "telefone residencial", "telefone celular"]
const CARGO_NAMES = ["cargo", "função", "funcao", "ocupação", "ocupacao", "atividade", "posição", "posicao", "função/cargo", "cargo/função", "descr cargo", "descrição cargo", "cbo", "car.", "func.", "cargo atual", "função atual", "profissão", "profissao"]
const BANCO_NAMES = ["banco", "bank", "instituição", "instituicao", "nome banco", "ag./banco", "banco/ag."]
const AGENCIA_NAMES = ["agencia", "agência", "ag", "nr agencia", "nr agência", "ag.", "agencia pagadora"]
const CONTA_NAMES = ["conta", "account", "nr conta", "conta corrente", "cc", "c/c", "conta poupança", "conta pagamento"]

const PIX_NAMES = ["pix", "chave pix", "chave", "tipo chave", "chave/pix"]

const ALL_KNOWN_NAMES = [...CPF_NAMES, ...NOME_NAMES, ...VALOR_NAMES, ...TELEFONE_NAMES, ...CARGO_NAMES, ...BANCO_NAMES, ...AGENCIA_NAMES, ...CONTA_NAMES, ...PIX_NAMES]

// ── Header row detection ──────────────────────────────────────────────────────
// Scans the first rows of the sheet to find the actual header row.
// Some sheets have title rows (e.g. "FOLHA DE PAGAMENTO - FEVEREIRO 2026") before the real headers.
function findHeaderRow(rawArrays: unknown[][]): { headerRowIdx: number; headers: string[] } {
    let bestRow = 0
    let bestScore = 0

    for (let i = 0; i < Math.min(15, rawArrays.length); i++) {
        const row = rawArrays[i] as unknown[]
        let score = 0
        for (const cell of row) {
            const s = String(cell ?? "").toLowerCase().trim()
            if (!s) continue
            // Skip cells that are purely numeric (e.g. dates stored as numbers)
            if (/^[\d.,\s\-\/]+$/.test(s)) continue
            for (const candidate of ALL_KNOWN_NAMES) {
                const words = candidate.split(" ")
                if (words.every(w => s.includes(w))) {
                    score++
                    break
                }
            }
        }
        if (score > bestScore) {
            bestScore = score
            bestRow = i
        }
    }

    const headerRow = (rawArrays[bestRow] ?? []) as unknown[]
    const headers = headerRow.map(h => String(h ?? "").trim())
    return { headerRowIdx: bestRow, headers }
}

function matchHeader(header: string, candidates: string[]): boolean {
    const h = header.toLowerCase().trim().replace(/\s+/g, " ")
    return candidates.some((c) => {
        const words = c.split(" ")
        return words.every(word => h.includes(word))
    })
}

// ── Auto-detect column indices by scanning cell contents ─────────────────────

function detectColumns(
    headers: string[],
    rows: Record<string, unknown>[]
): { cpfIdx: number; nomeIdx: number; valorIdx: number; telefoneIdx: number; cargoIdx: number; bancoIdx: number; agenciaIdx: number; contaIdx: number; pixIdx: number } {
    // 1st pass: match by header name
    let cpfIdx = headers.findIndex((h) => matchHeader(h, CPF_NAMES))
    let nomeIdx = headers.findIndex((h) => matchHeader(h, NOME_NAMES))
    let valorIdx = headers.findIndex((h) => matchHeader(h, VALOR_NAMES))
    let telefoneIdx = headers.findIndex((h) => matchHeader(h, TELEFONE_NAMES))
    let cargoIdx = headers.findIndex((h) => matchHeader(h, CARGO_NAMES))
    let bancoIdx = headers.findIndex((h) => matchHeader(h, BANCO_NAMES))
    let agenciaIdx = headers.findIndex((h) => matchHeader(h, AGENCIA_NAMES))
    let contaIdx = headers.findIndex((h) => matchHeader(h, CONTA_NAMES))
    let pixIdx = headers.findIndex((h) => matchHeader(h, PIX_NAMES))

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

    // ── 6th pass: validação cruzada — verifica se o conteúdo de cada coluna detectada
    //    realmente condiz com o tipo esperado. Se não, libera a coluna e reatribui.
    const sample = rows.slice(0, 50)
    const nonEmpty = (col: number) => sample.filter(r => String(r[headers[col]] ?? "").trim() !== "")

    function scoreValor(col: number): number {
        const cells = nonEmpty(col)
        if (cells.length === 0) return 0
        const hits = cells.filter(r => {
            const raw = String(r[headers[col]] ?? "").trim()
            const n = parseValue(raw)
            return n > 0 || /R\$/i.test(raw) || /\d+,\d{2}/.test(raw)
        }).length
        return hits / cells.length
    }

    function scoreTelefone(col: number): number {
        const cells = nonEmpty(col)
        if (cells.length === 0) return 0
        const hits = cells.filter(r => {
            const digits = String(r[headers[col]] ?? "").replace(/\D/g, "")
            return digits.length >= 8 && digits.length <= 15
        }).length
        return hits / cells.length
    }

    function scoreCpf(col: number): number {
        const cells = nonEmpty(col)
        if (cells.length === 0) return 0
        const hits = cells.filter(r => looksLikeCpf(r[headers[col]])).length
        return hits / cells.length
    }

    function scoreNome(col: number): number {
        const cells = nonEmpty(col)
        if (cells.length === 0) return 0
        const hits = cells.filter(r => {
            const v = String(r[headers[col]] ?? "").trim()
            return v.length > 3 && isNaN(Number(v.replace(/[.,]/g, ""))) && /[a-zA-ZÀ-ú]/.test(v)
        }).length
        return hits / cells.length
    }

    // Detecta se uma coluna foi atribuída ao tipo errado comparando scores
    const THRESHOLD = 0.4 // mínimo para ser considerado "correto"

    // Valida CPF
    if (cpfIdx !== -1 && scoreCpf(cpfIdx) < THRESHOLD) {
        // O conteúdo não parece CPF — libera e tenta redetectar
        const old = cpfIdx; cpfIdx = -1
        for (let col = 0; col < headers.length; col++) {
            if ([nomeIdx, valorIdx, telefoneIdx, old].includes(col)) continue
            if (scoreCpf(col) >= THRESHOLD) { cpfIdx = col; break }
        }
    }

    // Valida Nome
    if (nomeIdx !== -1 && scoreNome(nomeIdx) < THRESHOLD) {
        const old = nomeIdx; nomeIdx = -1
        for (let col = 0; col < headers.length; col++) {
            if ([cpfIdx, valorIdx, telefoneIdx, old].includes(col)) continue
            if (scoreNome(col) >= THRESHOLD) { nomeIdx = col; break }
        }
    }

    // Valida Valor
    if (valorIdx !== -1 && scoreValor(valorIdx) < THRESHOLD) {
        const old = valorIdx; valorIdx = -1
        for (let col = headers.length - 1; col >= 0; col--) {
            if ([cpfIdx, nomeIdx, telefoneIdx, old].includes(col)) continue
            if (scoreValor(col) >= THRESHOLD) { valorIdx = col; break }
        }
    }

    // Valida Telefone — se o conteúdo parece valor monetário, reatribui como valor
    if (telefoneIdx !== -1 && scoreTelefone(telefoneIdx) < THRESHOLD) {
        const old = telefoneIdx; telefoneIdx = -1
        // Verifica se é valor monetário mal-atribuído
        if (valorIdx === -1 && scoreValor(old) >= THRESHOLD) {
            valorIdx = old
        } else {
            for (let col = 0; col < headers.length; col++) {
                if ([cpfIdx, nomeIdx, valorIdx, old].includes(col)) continue
                if (scoreTelefone(col) >= THRESHOLD) { telefoneIdx = col; break }
            }
        }
    }

    // Valida Valor — se parece telefone e não há telefoneIdx, troca
    if (valorIdx !== -1 && scoreValor(valorIdx) < THRESHOLD && scoreTelefone(valorIdx) >= THRESHOLD) {
        if (telefoneIdx === -1) telefoneIdx = valorIdx
        valorIdx = -1
    }

    return { cpfIdx, nomeIdx, valorIdx, telefoneIdx, cargoIdx, bancoIdx, agenciaIdx, contaIdx, pixIdx }
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
        const unidadeId = form.get("unidade") as string | null
        if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })

        // Column hints: { "SheetName": { cpf?: "COL", nome?: "COL", valor?: "COL", ... }, "*": {...} }
        const columnHintsRaw = form.get("columnHints") as string | null
        const columnHints: Record<string, Record<string, string>> = columnHintsRaw ? JSON.parse(columnHintsRaw) : {}

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
            pix?: string;
            isInvalidCpf?: boolean;
            isMissingBank?: boolean;
        }
        const allRows: PayrollRow[] = []
        const extraRows: any[] = []
        const debugInfo: Record<string, unknown>[] = []
        const sheetMap = new Map<string, { count: number; total: number }>()
        const sheetsNeedingMapping: { sheet: string; availableHeaders: string[]; undetected: string[] }[] = []

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]

            // Get raw arrays so we can detect the actual header row (skip title rows)
            const rawArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
            if (rawArrays.length === 0) continue

            const { headerRowIdx, headers } = findHeaderRow(rawArrays)

            // Build rowObjects from data rows after the detected header row
            const rawRows: Record<string, unknown>[] = rawArrays
                .slice(headerRowIdx + 1)
                .filter(row => (row as unknown[]).some(cell => String(cell ?? "").trim() !== ""))
                .map(row => {
                    const obj: Record<string, unknown> = {}
                    headers.forEach((h, i) => { if (h) obj[h] = (row as unknown[])[i] ?? "" })
                    return obj
                })

            if (rawRows.length === 0) continue

            let { cpfIdx, nomeIdx, valorIdx, telefoneIdx, cargoIdx, bancoIdx, agenciaIdx, contaIdx, pixIdx } = detectColumns(headers, rawRows)

            // Apply user-provided column hints (override auto-detection per sheet or globally via "*")
            // "__none__" explicitly removes a mapping; any other value sets it to that column header
            const hints = columnHints[sheetName] ?? columnHints["*"] ?? {}
            function applyHint(hint: string | undefined, current: number): number {
                if (hint === undefined) return current
                if (hint === "__none__") return -1
                const i = headers.indexOf(hint)
                return i !== -1 ? i : current
            }
            cpfIdx      = applyHint(hints.cpf,      cpfIdx)
            nomeIdx     = applyHint(hints.nome,     nomeIdx)
            valorIdx    = applyHint(hints.valor,    valorIdx)
            telefoneIdx = applyHint(hints.telefone, telefoneIdx)
            cargoIdx    = applyHint(hints.cargo,    cargoIdx)
            bancoIdx    = applyHint(hints.banco,    bancoIdx)
            agenciaIdx  = applyHint(hints.agencia,  agenciaIdx)
            contaIdx    = applyHint(hints.conta,    contaIdx)
            pixIdx      = applyHint(hints.pix,      pixIdx)

            // Track which critical columns couldn't be found
            const undetected: string[] = []
            if (nomeIdx  === -1) undetected.push("nome")
            if (valorIdx === -1) undetected.push("valor")
            if (cpfIdx   === -1) undetected.push("cpf")

            console.log(`[Analyze] Sheet: ${sheetName} (header row ${headerRowIdx})`, {
                headers,
                detected: {
                    cpf:      cpfIdx      !== -1 ? headers[cpfIdx]      : "MISSING",
                    nome:     nomeIdx     !== -1 ? headers[nomeIdx]     : "MISSING",
                    valor:    valorIdx    !== -1 ? headers[valorIdx]    : "MISSING",
                    telefone: telefoneIdx !== -1 ? headers[telefoneIdx] : "MISSING",
                    cargo:    cargoIdx    !== -1 ? headers[cargoIdx]    : "MISSING",
                    banco:    bancoIdx    !== -1 ? headers[bancoIdx]    : "MISSING",
                    agencia:  agenciaIdx  !== -1 ? headers[agenciaIdx]  : "MISSING",
                    conta:    contaIdx    !== -1 ? headers[contaIdx]    : "MISSING",
                    pix:      pixIdx      !== -1 ? headers[pixIdx]      : "MISSING",
                }
            })

            debugInfo.push({
                sheet: sheetName,
                headerRowIdx,
                totalRows: rawRows.length,
                headers,
                detected: {
                    cpf:      cpfIdx      !== -1 ? headers[cpfIdx]      : null,
                    nome:     nomeIdx     !== -1 ? headers[nomeIdx]     : null,
                    valor:    valorIdx    !== -1 ? headers[valorIdx]    : null,
                    telefone: telefoneIdx !== -1 ? headers[telefoneIdx] : null,
                    cargo:    cargoIdx    !== -1 ? headers[cargoIdx]    : null,
                    banco:    bancoIdx    !== -1 ? headers[bancoIdx]    : null,
                    agencia:  agenciaIdx  !== -1 ? headers[agenciaIdx]  : null,
                    conta:    contaIdx    !== -1 ? headers[contaIdx]    : null,
                    pix:      pixIdx      !== -1 ? headers[pixIdx]      : null,
                },
            })

            // If neither nome nor valor detected, ask the user to map columns
            if (nomeIdx === -1 && valorIdx === -1) {
                const nonEmptyHeaders = headers.filter(h => h.trim() !== "")
                sheetsNeedingMapping.push({ sheet: sheetName, availableHeaders: nonEmptyHeaders, undetected })
                continue
            }

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

                const bankName = bancoIdx !== -1 ? normalizeBankName(String(row[headers[bancoIdx]] ?? "")) : undefined
                const bankAgency = agenciaIdx !== -1 ? String(row[headers[agenciaIdx]] ?? "").trim() : undefined
                const bankAccount = contaIdx !== -1 ? String(row[headers[contaIdx]] ?? "").trim().replace(/\./g, "") : undefined
                const pix = pixIdx !== -1 ? String(row[headers[pixIdx]] ?? "").trim() : undefined

                const isInvalidCpf = !isValidCpf(cpf)
                
                // Bank contingency logic
                const isMentoreOrPix = bankName === "MENTORE" || bankName === "PIX";
                const isMissingBank = !bankName || bankName === "Não informado" || (!isMentoreOrPix && (!bankAgency || !bankAccount));

                // Skip truly empty rows
                if (!cpf && !nomeRaw && valor === 0) continue

                // Categorize
                if (cpf && cpf !== "00000000000") {
                    allRows.push({ cpf, nome, valor, sheet: sheetName, telefone, cargo, bankName, bankAgency, bankAccount, pix, isInvalidCpf, isMissingBank })
                } else if (nomeRaw && valor > 0) {
                    extraRows.push({ nome, cpfCnpj: cpfRaw || "—", valor, sheet: sheetName, telefone, cargo, bankName, bankAgency, bankAccount, pix, isMissingBank })
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

        // Only block when truly nothing was parsed — rows without CPF still land in extraRows
        if (finalRows.length === 0 && extraRows.length === 0) {
            return NextResponse.json(
                {
                    error: "Nenhum dado foi encontrado na planilha. Verifique se as colunas estão corretas.",
                    debug: debugInfo,
                },
                { status: 422 }
            )
        }

        // ── Cross-reference DB ────────────────────────────────────────────────────
        const cpfs = [...new Set(finalRows.map((r) => r.cpf))]
        const supabase = getSupabaseAdmin()
        const { data: dbEmployees, error: dbError } = cpfs.length > 0
            ? await supabase
                .from("Employee")
                .select("id, cpf, name, salary, phone, position, bankName, bankAgency, bankAccount, pixKey, departmentId")
                .eq("companyId", companyId)
                .in("cpf", cpfs)
            : { data: [], error: null }

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
                const dbSalary = Number(e.salary || 0)
                
                // Name mismatch check
                const normSheet = r.nome.toLowerCase().replace(/\s+/g, " ").trim()
                const normDb = dbName.toLowerCase().replace(/\s+/g, " ").trim()
                const nameMismatch = normSheet !== normDb && !normDb.includes(normSheet) && !normSheet.includes(normDb)

                // Value mismatch check
                const valueMismatch = Math.abs(r.valor - dbSalary) > 0.01

                return {
                    id: e.id,
                    nome: r.nome,
                    dbName: dbName,
                    dbSalary: dbSalary,
                    cpf: r.cpf,
                    valor: r.valor,
                    sheet: r.sheet,
                    telefone: e.phone || r.telefone,
                    cargo: e.position || r.cargo,
                    bankName: normalizeBankName(e.bankName || r.bankName),
                    bankAgency: e.bankAgency || r.bankAgency,
                    bankAccount: e.bankAccount || r.bankAccount,
                    pix: e.pixKey || r.pix,
                    isInvalidCpf: r.isInvalidCpf,
                    isMissingBank: (function(b, a, c) {
                        const isMpt = b === "MENTORE" || b === "PIX"
                        return !b || b === "Não informado" || (!isMpt && (!a || !c))
                    })(normalizeBankName(e.bankName || r.bankName), e.bankAgency || r.bankAgency, e.bankAccount || r.bankAccount),
                    nameMismatch,
                    valueMismatch,
                    departmentId: e.departmentId
                }
            })

        // Auto-reconcile and Reactivate: atualiza status, salário e unidade no banco
        if (found.length > 0) {
            await Promise.all(
                found.map(r =>
                    supabase.from("Employee").update({ 
                        status: "ACTIVE",
                        salary: String(r.valor),
                        departmentId: unidadeId || r.departmentId,
                        updatedAt: new Date().toISOString()
                    }).eq("id", r.id)
                )
            )
            for (const r of found) {
                r.valueMismatch = false
                r.dbSalary = r.valor
            }
        }

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
                pix: r.pix,
                isInvalidCpf: r.isInvalidCpf,
                isMissingBank: r.isMissingBank
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

        // If some sheets couldn't have columns detected, return mapping request
        if (sheetsNeedingMapping.length > 0 && finalRows.length === 0 && extraRows.length === 0) {
            return NextResponse.json(
                { needsColumnMapping: true, sheetsNeedingMapping, debug: debugInfo },
                { status: 422 }
            )
        }

        console.log(`[Analyze] Final response:`, {
            foundCount: found.length,
            missingCount: missing.length,
            extrasCount: extraRows.length,
            sheetsNeedingMapping: sheetsNeedingMapping.length,
            hasDebug: !!debugInfo,
        })
        return NextResponse.json({ found, missing, extras: extraRows, total, sheetSummary, duplicates, crossAbaDuplicates: crossAbaDuplicatesList, phoneUpdates, debug: debugInfo, sheetsNeedingMapping })
    } catch (e: any) {
        console.error("[ANALYZE_ROUTE] Unhandled error:", e)
        return NextResponse.json(
            { error: e?.message ?? "Erro interno ao processar a planilha." },
            { status: 500 }
        )
    }
}
