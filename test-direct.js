const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL
        }
    }
})

async function main() {
    console.log('Testing DIRECT_URL connection...')
    try {
        const userCount = await prisma.user.count()
        console.log('Success! User count:', userCount)
    } catch (e) {
        console.error('Connection failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
