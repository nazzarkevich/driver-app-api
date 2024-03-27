/*
  Warnings:

  - You are about to drop the column `courierProfileId` on the `Parcel` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Parcel" DROP CONSTRAINT "Parcel_courierProfileId_fkey";

-- AlterTable
ALTER TABLE "CourierProfile" ADD COLUMN     "courierJourneyId" INTEGER;

-- AlterTable
ALTER TABLE "Journey" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "courierProfileId",
ADD COLUMN     "courierJourneyId" INTEGER,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CourierJourney" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "route" TEXT NOT NULL,
    "notes" TEXT,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "businessId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,

    CONSTRAINT "CourierJourney_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CourierProfile" ADD CONSTRAINT "CourierProfile_courierJourneyId_fkey" FOREIGN KEY ("courierJourneyId") REFERENCES "CourierJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierJourney" ADD CONSTRAINT "CourierJourney_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierJourney" ADD CONSTRAINT "CourierJourney_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_courierJourneyId_fkey" FOREIGN KEY ("courierJourneyId") REFERENCES "CourierJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;
