-- CreateTable
CREATE TABLE "PayrollAnalysis" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "departmentId" TEXT,
    "companyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAnalysis_month_year_departmentId_companyId_key" ON "PayrollAnalysis"("month", "year", "departmentId", "companyId");

-- AddForeignKey
ALTER TABLE "PayrollAnalysis" ADD CONSTRAINT "PayrollAnalysis_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAnalysis" ADD CONSTRAINT "PayrollAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
