-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Tariff_isDefault_idx" ON "Tariff"("isDefault");

-- CreateIndex
CREATE INDEX "Tariff_businessId_isDefault_idx" ON "Tariff"("businessId", "isDefault");
