-- Drop unique constraint to allow multiple payroll analyses per month/year/department/company
DROP INDEX IF EXISTS "PayrollAnalysis_month_year_departmentId_companyId_key";
