
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        include: { company: true }
    })
    console.log('--- USERS AND COMPANIES ---')
    users.forEach(u => {
        console.log(`User: ${u.name} (${u.email})`)
        console.log(`Company: ${u.company?.name} (CNPJ: ${u.company?.cnpj})`)
        console.log('---------------------------')
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
