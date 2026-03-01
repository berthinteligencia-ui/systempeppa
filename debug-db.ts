
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    console.error("❌ DATABASE_URL not found in .env")
    process.exit(1)
}

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log("🔍 Checking database content...")

    try {
        const companies = await prisma.company.findMany()
        console.log(`🏢 Companies found: ${companies.length}`)
        companies.forEach(c => console.log(`   - [${c.id}] ${c.name} (CNPJ: ${c.cnpj})`))

        const users = await prisma.user.findMany({
            include: { company: true }
        })
        console.log(`👤 Users found: ${users.length}`)
        users.forEach(u => {
            console.log(`   - ${u.name} (${u.email}) - Role: ${u.role}`)
            console.log(`     Company: ${u.company?.name || "NONE"}`)
            console.log(`     Password Hash: ${u.password}`)
        })

        const analyses = await prisma.payrollAnalysis.findMany()
        console.log(`📊 Payroll Analyses found: ${analyses.length}`)

        const employees = await prisma.employee.findMany()
        console.log(`👥 Employees found: ${employees.length}`)

    } catch (error) {
        console.error("❌ Database error:", error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
