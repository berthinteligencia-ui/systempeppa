-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "whatsappNotifications" BOOLEAN NOT NULL DEFAULT false,
    "autoBackup" BOOLEAN NOT NULL DEFAULT false,
    "payrollReminderDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_companyId_key" ON "Settings"("companyId");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
