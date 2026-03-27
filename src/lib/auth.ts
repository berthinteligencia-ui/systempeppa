import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/lib/auth.config"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const supabase = getSupabaseAdmin()

        // Step 1: fetch user without join first (more reliable)
        const { data: user, error } = await supabase
          .from("User")
          .select("id, name, email, password, role, active, companyId, mustChangePassword")
          .eq("email", credentials.email as string)
          .single()

        if (error) {
          console.error("[AUTH] DB error fetching user:", error.message, error.code)
          throw new Error("DB_ERROR")
        }

        if (!user) {
          console.error("[AUTH] user not found for email:", credentials.email)
          throw new Error("USER_NOT_FOUND")
        }

        if (!user.active) {
          console.error("[AUTH] user inactive:", credentials.email)
          throw new Error("USER_INACTIVE")
        }

        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) {
          console.error("[AUTH] wrong password for:", credentials.email)
          throw new Error("WRONG_PASSWORD")
        }

        // Step 2: fetch company name separately
        let companyName = ""
        let companyCnpj = ""
        if (user.companyId) {
          const { data: company } = await supabase
            .from("Company")
            .select("name, cnpj")
            .eq("id", user.companyId)
            .single()
          companyName = company?.name ?? ""
          companyCnpj = company?.cnpj ?? ""
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          companyName,
          companyCnpj,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
}))
