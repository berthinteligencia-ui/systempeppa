import { query } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        await query(
            `DROP INDEX IF EXISTS "PayrollAnalysis_month_year_departmentId_companyId_key"`
        )
        return NextResponse.json({ ok: true, message: "Índice único removido — agora é possível salvar múltiplas folhas por mês/unidade." })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    }
}
