import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/preview-dashboard"]

export default async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

  let token = null
  if (secret) {
    try {
      token = await getToken({ req, secret })
    } catch {
      token = null
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
