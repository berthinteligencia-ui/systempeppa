-- Add nivel column to Department table
-- PRINCIPAL = unidade raiz que não pode ter pai
-- SUBUNIDADE = pode pertencer a qualquer unidade pai
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "nivel" TEXT NOT NULL DEFAULT 'SUBUNIDADE';
