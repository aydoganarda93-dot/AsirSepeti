-- CreateTable
CREATE TABLE "CompanyGridDailyArchive" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyGridDailyArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGridDailyArchive_companyId_periodStart_key" ON "CompanyGridDailyArchive"("companyId", "periodStart");

-- CreateIndex
CREATE INDEX "CompanyGridDailyArchive_periodStart_idx" ON "CompanyGridDailyArchive"("periodStart");

-- AddForeignKey
ALTER TABLE "CompanyGridDailyArchive" ADD CONSTRAINT "CompanyGridDailyArchive_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "gridLastArchivedPeriodStart" TIMESTAMPTZ(3);
