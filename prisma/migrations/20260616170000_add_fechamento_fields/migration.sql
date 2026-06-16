-- Add fechamento fields to PayrollAnalysis
ALTER TABLE "PayrollAnalysis"
  ADD COLUMN "totalEmployees" INTEGER,
  ADD COLUMN "observations"   TEXT,
  ADD COLUMN "closedAt"       TIMESTAMP(3),
  ADD COLUMN "closedByUserId" TEXT;

-- Migrate existing "OPEN" status to "ABERTO"
UPDATE "PayrollAnalysis" SET "status" = 'ABERTO' WHERE "status" = 'OPEN';

-- Add foreign key from closedByUserId to User
ALTER TABLE "PayrollAnalysis"
  ADD CONSTRAINT "PayrollAnalysis_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
