"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

const PAGE_LABELS: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/funcionarios": "Funcionários",
    "/folha-pagamento": "Folha de Pagamento",
    "/relatorios": "Relatórios",
    "/bancos": "Bancos",
    "/nfs": "Notas Fiscais",
    "/unidades": "Unidades",
    "/usuarios": "Usuários",
    "/configuracoes": "Configurações",
    "/comprovante": "Comprovante",
    "/whatsapp-business": "WhatsApp Business",
}

export function ActivityLogger() {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const lastLogged = useRef<string>("")

    useEffect(() => {
        if (status !== "authenticated" || !session?.user) return
        if (lastLogged.current === pathname) return

        lastLogged.current = pathname
        const label = PAGE_LABELS[pathname] ?? pathname

        fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "PAGE_VIEW", target: label }),
        }).catch(() => {/* silencioso */})
    }, [pathname, session, status])

    return null
}
