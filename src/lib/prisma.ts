import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createPrismaClient() {
  const url = process.env.DATABASE_URL!
  console.log("[PRISMA] url:", url?.substring(0, 70))
  // max: 1 evita esgotamento de conexões em ambiente serverless (Vercel)
  const adapter = new PrismaPg({ connectionString: url, max: 1 })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
