const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const settings = await prisma.settings.findMany({
        include: { company: true }
    })
    console.log('--- COMPANY SETTINGS ---')
    settings.forEach(s => {
        console.log(`Company: ${s.company?.name} (ID: ${s.companyId})`)
        console.log(`Last Reset: Month ${s.lastResetMonth}, Year ${s.lastResetYear}`)
        console.log('---------------------------')
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())
