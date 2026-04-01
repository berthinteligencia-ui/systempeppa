import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

// Mapeamento de rota → feature key
const ROUTE_FEATURE: Record<string, string> = {
    "/funcionarios":     "funcionarios",
    "/unidades":         "unidades",
    "/nfs":              "nfs",
    "/folha-pagamento":  "folha_pagamento",
    "/comprovante":      "comprovante",
    "/whatsapp-business":"whatsapp",
    "/relatorios":       "relatorios",
    "/bancos":           "bancos",
}

export default auth(async (req) => {
    const isLoggedIn = !!req.auth
    const { nextUrl } = req
    const pathname = nextUrl.pathname

    // Controle, admin e change-password são rotas independentes
    if (pathname.startsWith("/controle")) return undefined
    if (pathname.startsWith("/admin")) return undefined

    const isPublicPath = pathname === "/login" || pathname === "/preview-dashboard"

    if (isPublicPath) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl))
        return undefined
    }

    if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl))

    // Força troca de senha no primeiro acesso
    const mustChangePassword = (req.auth as any)?.user?.mustChangePassword
    if (mustChangePassword && pathname !== "/change-password") {
        return Response.redirect(new URL("/change-password", nextUrl))
    }

    // Verificação de permissão para rotas controladas
    const role = (req.auth as any)?.user?.role as string | undefined
    const companyId = (req.auth as any)?.user?.companyId as string | undefined

    if (role && role !== "ADMIN" && companyId) {
        const feature = ROUTE_FEATURE[pathname]
        if (feature) {
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

                const res = await fetch(
                    `${supabaseUrl}/rest/v1/role_permissions?company_id=eq.${encodeURIComponent(companyId)}&role=eq.${encodeURIComponent(role)}&select=permissions`,
                    {
                        headers: {
                            apikey: supabaseKey,
                            Authorization: `Bearer ${supabaseKey}`,
                            Accept: "application/json",
                        },
                        cache: "no-store",
                    }
                )

                if (res.ok) {
                    const data = await res.json()
                    const permissions: Record<string, boolean> = data[0]?.permissions ?? {}
                    if (permissions[feature] === false) {
                        return Response.redirect(new URL("/dashboard", nextUrl))
                    }
                }
            } catch {
                // Em caso de erro na verificação, permite acesso (fail-open)
            }
        }
    }

    return undefined
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
