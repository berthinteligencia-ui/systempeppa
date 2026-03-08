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

        const { data: user, error } = await supabase
          .from("User")
          .select("id, name, email, password, role, active, companyId, mustChangePassword, Company(id, name, cnpj)")
          .eq("email", credentials.email as string)
          .single()

        if (error || !user) {
          console.error("[AUTH] user not found:", error?.message)
          return null
        }

        if (!user.active) return null

        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null

        const company = Array.isArray(user.Company) ? user.Company[0] : user.Company

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          companyName: company?.name ?? "",
          companyCnpj: company?.cnpj ?? "",
          mustChangePassword: user.mustChangePassword ?? false,
        }
      },
    }),
  ],
}))
