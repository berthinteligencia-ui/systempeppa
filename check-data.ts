import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const analysis = await prisma.payrollAnalysis.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  
  if (analysis) {
    console.log('ID:', analysis.id)
    console.log('--- DATA START ---')
    console.log(JSON.stringify(analysis.data, null, 2))
    console.log('--- DATA END ---')
  } else {
    console.log('No analysis found')
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
