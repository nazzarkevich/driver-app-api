/*
  Warnings:

  - You are about to drop the `TariffRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PickupRequestStatus" AS ENUM ('Pending', 'Collected', 'Converted', 'Cancelled');

-- DropForeignKey
ALTER TABLE "TariffRule" DROP CONSTRAINT "TariffRule_originCountryId_fkey";

-- DropForeignKey
ALTER TABLE "TariffRule" DROP CONSTRAINT "TariffRule_parcelTypeId_fkey";

-- DropForeignKey
ALTER TABLE "TariffRule" DROP CONSTRAINT "TariffRule_tariffId_fkey";

-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN     "isWeightBased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minimumPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "originCountryId" INTEGER,
ADD COLUMN     "parcelTypeId" INTEGER,
ADD COLUMN     "pricePerKg" DOUBLE PRECISION,
ADD COLUMN     "weightThreshold" DOUBLE PRECISION;

-- DropTable
DROP TABLE "TariffRule";

-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "parcelCount" INTEGER NOT NULL DEFAULT 1,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "PickupRequestStatus" NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupRequest_businessId_idx" ON "PickupRequest"("businessId");

-- CreateIndex
CREATE INDEX "PickupRequest_businessId_scheduledDate_idx" ON "PickupRequest"("businessId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_parcelTypeId_fkey" FOREIGN KEY ("parcelTypeId") REFERENCES "ParcelType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
