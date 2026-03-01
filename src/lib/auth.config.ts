import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: () => null,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = ((user as { role?: string }).role ?? "") as string
        token.companyId = (user as any).companyId || ""
        token.companyName = (user as any).companyName || ""
        token.companyCnpj = (user as any).companyCnpj || ""
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.companyId = token.companyId as string
      session.user.companyName = token.companyName as string
      session.user.companyCnpj = token.companyCnpj as string
      return session
    },
  },
}
