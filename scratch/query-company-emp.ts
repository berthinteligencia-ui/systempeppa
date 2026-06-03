import { prisma } from "../src/lib/prisma";

async function query() {
  const companyId = "875d4202-fe27-48c5-a9ff-2be84890b7c9";
  
  // 1. Fetch Company
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      settings: true,
      departments: true,
    }
  });
  
  console.log("=== COMPANY ===");
  console.log(JSON.stringify(company, null, 2));

  // 2. Fetch Employees of this company
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: {
      department: true
    }
  });

  console.log("\n=== EMPLOYEES ===");
  console.log(JSON.stringify(employees, null, 2));
  
  // 3. Fetch all Departments in the system to see if there is any mismatch
  const allDepts = await prisma.department.findMany({
    where: { companyId }
  });
  console.log("\n=== DEPARTMENTS ===");
  console.log(JSON.stringify(allDepts, null, 2));
}

query()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
