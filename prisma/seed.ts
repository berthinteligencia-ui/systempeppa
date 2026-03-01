import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as never)

async function main() {
  console.log("🌱 Seeding database...")

  // ── Company ──────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { cnpj: "00.000.000/0001-00" },
    update: {},
    create: {
      name: "FolhaPro Demonstração",
      cnpj: "00.000.000/0001-00",
      active: true,
    },
  })
  console.log(`✔ Company: ${company.name}`)

  // ── Departments ───────────────────────────────────────────────────────────
  const deptNames = [
    "Tecnologia e Inovação",
    "Recursos Humanos",
    "Marketing Digital",
    "Operações",
  ]

  const departments = await Promise.all(
    deptNames.map((name) =>
      prisma.department.upsert({
        where: { id: `dept-${name.toLowerCase().replace(/\s+/g, "-")}` },
        update: {},
        create: {
          id: `dept-${name.toLowerCase().replace(/\s+/g, "-")}`,
          name,
          companyId: company.id,
        },
      })
    )
  )
  console.log(`✔ Departments: ${departments.map((d) => d.name).join(", ")}`)

  // ── Admin User ────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12)
  const admin = await prisma.user.upsert({
    where: { email: "admin@folhapro.com" },
    update: {
      password: adminPassword,
      companyId: company.id,
    },
    create: {
      name: "Carlos Silva",
      email: "admin@folhapro.com",
      password: adminPassword,
      role: "ADMIN",
      companyId: company.id,
    },
  })
  console.log(`✔ Admin: ${admin.email} / senha: admin123`)

  // ── Sample Employees ──────────────────────────────────────────────────────
  const [tiDept, rhDept, mkDept, opDept] = departments

  const employees = [
    { name: "Ricardo Mendes", position: "Diretor de TI", salary: 18000, departmentId: tiDept.id },
    { name: "Ana Ferreira", position: "Gerente de RH", salary: 12000, departmentId: rhDept.id },
    { name: "Felipe Costa", position: "Diretor de Marketing", salary: 14000, departmentId: mkDept.id },
    { name: "Carla Souza", position: "Gerente de Operações", salary: 13500, departmentId: opDept.id },
  ]

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { cpf: null as never },
      update: {},
      create: {
        name: emp.name,
        position: emp.position,
        salary: emp.salary,
        hireDate: new Date("2022-01-15"),
        status: "ACTIVE",
        companyId: company.id,
        departmentId: emp.departmentId,
      },
    }).catch(() => {
      // Skip if CPF unique conflict — upsert on nullable unique isn't ideal; just createMany
    })
  }

  // Use createMany for employees without CPF
  await prisma.employee.deleteMany({ where: { companyId: company.id } })
  await prisma.employee.createMany({
    data: employees.map((emp) => ({
      name: emp.name,
      position: emp.position,
      salary: emp.salary,
      hireDate: new Date("2022-01-15"),
      status: "ACTIVE" as const,
      companyId: company.id,
      departmentId: emp.departmentId,
    })),
  })
  // ── Sample Payroll Analyses ───────────────────────────────────────────────
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Generate for current and previous month
  const periods = [
    { month: currentMonth, year: currentYear },
    { month: currentMonth === 1 ? 12 : currentMonth - 1, year: currentMonth === 1 ? currentYear - 1 : currentYear }
  ]

  for (const period of periods) {
    for (const dept of departments) {
      await prisma.payrollAnalysis.upsert({
        where: {
          month_year_unit_company: {
            month: period.month,
            year: period.year,
            departmentId: dept.id,
            companyId: company.id
          }
        },
        update: {},
        create: {
          month: period.month,
          year: period.year,
          departmentId: dept.id,
          companyId: company.id,
          total: (Math.random() * 50000 + 10000).toFixed(2),
          status: "OPEN",
          data: { found: 10, missing: 0, extras: 0, sheetSummary: {} }
        }
      })
    }
  }

  console.log(`✔ Employees: ${employees.map((e) => e.name).join(", ")}`)
  console.log(`✔ Payroll Analyses: Generated for ${periods.length} periods`)

  console.log("\n✅ Seed concluído com sucesso!")
  console.log("   Login: admin@folhapro.com")
  console.log("   Senha: admin123")
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
