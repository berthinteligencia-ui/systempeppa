import { NextRequest, NextResponse } from "next/server"
import { runBackup } from "@/lib/actions/backup"

export async function GET(req: NextRequest) {
    // Verificar segredo para automação (Cron)
    const authHeader = req.headers.get("x-backup-secret")
    const secret = process.env.BACKUP_SECRET

    // Se houver um segredo configurado no .env, validamos. 
    // Caso contrário, bloqueamos acesso via GET externo (apenas para fins de segurança básica)
    if (secret && authHeader !== secret) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    try {
        const result = await runBackup()
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    // Mesma lógica para POST (pode ser usado por webhooks)
    const authHeader = req.headers.get("x-backup-secret")
    const secret = process.env.BACKUP_SECRET

    if (secret && authHeader !== secret) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    try {
        const result = await runBackup()
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
