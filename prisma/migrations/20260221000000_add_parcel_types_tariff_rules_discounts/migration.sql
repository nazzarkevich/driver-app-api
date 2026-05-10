-- CreateEnum
CREATE TYPE "PaymentParty" AS ENUM ('Sender', 'Recipient');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BLOCK';
ALTER TYPE "AuditAction" ADD VALUE 'UNBLOCK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeliveryStatus" ADD VALUE 'Cancelled';
ALTER TYPE "DeliveryStatus" ADD VALUE 'Returned';
ALTER TYPE "DeliveryStatus" ADD VALUE 'Lost';

-- DropForeignKey
ALTER TABLE "ConnectedParcel" DROP CONSTRAINT "ConnectedParcel_parcel_fkey";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "village" TEXT,
ALTER COLUMN "city" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CourierJourney" DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "CustomerProfile" DROP COLUMN "note",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "gender" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Journey" DROP COLUMN "notes",
ADD COLUMN     "hasTrailer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "journeyNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "cargoType",
DROP COLUMN "notes",
ADD COLUMN     "calculatedPrice" DOUBLE PRECISION,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveredByCourierId" INTEGER,
ADD COLUMN     "deliveredByDriverId" INTEGER,
ADD COLUMN     "isPriceOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidBy" "PaymentParty" NOT NULL DEFAULT 'Sender',
ADD COLUMN     "parcelTypeId" INTEGER NOT NULL,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpByCourierId" INTEGER,
ADD COLUMN     "pickedUpByDriverId" INTEGER,
ADD COLUMN     "tariffId" INTEGER;

-- AlterTable
ALTER TABLE "_DriverProfileToJourney" ADD CONSTRAINT "_DriverProfileToJourney_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DriverProfileToJourney_AB_unique";

-- DropEnum
DROP TYPE "ParcelType";

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "customerProfileId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "parcelId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "journeyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierJourneyNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "courierJourneyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierJourneyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "businessId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessId" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffRule" (
    "id" SERIAL NOT NULL,
    "tariffId" INTEGER NOT NULL,
    "parcelTypeId" INTEGER NOT NULL,
    "originCountryId" INTEGER,
    "minimumPrice" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION,
    "weightThreshold" DOUBLE PRECISION,
    "isWeightBased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TariffRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minParcelCount" INTEGER,
    "isForSubscribers" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelDiscount" (
    "id" SERIAL NOT NULL,
    "parcelId" INTEGER NOT NULL,
    "discountRuleId" INTEGER NOT NULL,
    "appliedValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNote_customerProfileId_idx" ON "CustomerNote"("customerProfileId");

-- CreateIndex
CREATE INDEX "CustomerNote_userId_idx" ON "CustomerNote"("userId");

-- CreateIndex
CREATE INDEX "ParcelNote_parcelId_idx" ON "ParcelNote"("parcelId");

-- CreateIndex
CREATE INDEX "ParcelNote_userId_idx" ON "ParcelNote"("userId");

-- CreateIndex
CREATE INDEX "JourneyNote_journeyId_idx" ON "JourneyNote"("journeyId");

-- CreateIndex
CREATE INDEX "JourneyNote_userId_idx" ON "JourneyNote"("userId");

-- CreateIndex
CREATE INDEX "CourierJourneyNote_courierJourneyId_idx" ON "CourierJourneyNote"("courierJourneyId");

-- CreateIndex
CREATE INDEX "CourierJourneyNote_userId_idx" ON "CourierJourneyNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelType_name_key" ON "ParcelType"("name");

-- CreateIndex
CREATE INDEX "ParcelType_businessId_idx" ON "ParcelType"("businessId");

-- CreateIndex
CREATE INDEX "Tariff_businessId_idx" ON "Tariff"("businessId");

-- CreateIndex
CREATE INDEX "Tariff_isActive_idx" ON "Tariff"("isActive");

-- CreateIndex
CREATE INDEX "TariffRule_tariffId_idx" ON "TariffRule"("tariffId");

-- CreateIndex
CREATE INDEX "TariffRule_parcelTypeId_idx" ON "TariffRule"("parcelTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRule_tariffId_parcelTypeId_originCountryId_key" ON "TariffRule"("tariffId", "parcelTypeId", "originCountryId");

-- CreateIndex
CREATE INDEX "DiscountRule_businessId_idx" ON "DiscountRule"("businessId");

-- CreateIndex
CREATE INDEX "ParcelDiscount_parcelId_idx" ON "ParcelDiscount"("parcelId");

-- CreateIndex
CREATE INDEX "ParcelDiscount_discountRuleId_idx" ON "ParcelDiscount"("discountRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "Journey_journeyNumber_key" ON "Journey"("journeyNumber");

-- CreateIndex
CREATE INDEX "Journey_journeyNumber_idx" ON "Journey"("journeyNumber");

-- CreateIndex
CREATE INDEX "Journey_businessId_departureDate_idx" ON "Journey"("businessId", "departureDate");

-- CreateIndex
CREATE INDEX "Parcel_pickedUpByCourierId_idx" ON "Parcel"("pickedUpByCourierId");

-- CreateIndex
CREATE INDEX "Parcel_pickedUpByDriverId_idx" ON "Parcel"("pickedUpByDriverId");

-- CreateIndex
CREATE INDEX "Parcel_deliveredByCourierId_idx" ON "Parcel"("deliveredByCourierId");

-- CreateIndex
CREATE INDEX "Parcel_deliveredByDriverId_idx" ON "Parcel"("deliveredByDriverId");

-- CreateIndex
CREATE INDEX "Parcel_parcelTypeId_idx" ON "Parcel"("parcelTypeId");

-- RenameForeignKey
ALTER TABLE "ConnectedParcel" RENAME CONSTRAINT "ConnectedParcel_parcelId_fkey" TO "ConnectedParcel_parcel_fkey";

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelNote" ADD CONSTRAINT "ParcelNote_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelNote" ADD CONSTRAINT "ParcelNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyNote" ADD CONSTRAINT "JourneyNote_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyNote" ADD CONSTRAINT "JourneyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierJourneyNote" ADD CONSTRAINT "CourierJourneyNote_courierJourneyId_fkey" FOREIGN KEY ("courierJourneyId") REFERENCES "CourierJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierJourneyNote" ADD CONSTRAINT "CourierJourneyNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_pickedUpByCourierId_fkey" FOREIGN KEY ("pickedUpByCourierId") REFERENCES "CourierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_pickedUpByDriverId_fkey" FOREIGN KEY ("pickedUpByDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_deliveredByCourierId_fkey" FOREIGN KEY ("deliveredByCourierId") REFERENCES "CourierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_deliveredByDriverId_fkey" FOREIGN KEY ("deliveredByDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_parcelTypeId_fkey" FOREIGN KEY ("parcelTypeId") REFERENCES "ParcelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelType" ADD CONSTRAINT "ParcelType_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_parcelTypeId_fkey" FOREIGN KEY ("parcelTypeId") REFERENCES "ParcelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelDiscount" ADD CONSTRAINT "ParcelDiscount_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelDiscount" ADD CONSTRAINT "ParcelDiscount_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "DiscountRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
