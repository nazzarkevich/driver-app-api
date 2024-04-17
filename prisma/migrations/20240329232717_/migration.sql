/*
  Warnings:

  - You are about to drop the column `apartment` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumberUa` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumberUk` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Parcel` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `User` table. All the data in the column will be lost.
  - Added the required column `countryId` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost` to the `Parcel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationAddressId` to the `Parcel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originAddressId` to the `Parcel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "apartment",
DROP COLUMN "country",
DROP COLUMN "state",
ADD COLUMN     "block" TEXT,
ADD COLUMN     "building" TEXT,
ADD COLUMN     "countryId" INTEGER NOT NULL,
ADD COLUMN     "flat" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CourierProfile" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomerProfile" DROP COLUMN "phoneNumberUa",
DROP COLUMN "phoneNumberUk",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "novaPostAddressId" INTEGER;

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "type",
ADD COLUMN     "cargoType" "ParcelType" NOT NULL DEFAULT 'Regular',
ADD COLUMN     "cost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "destinationAddressId" INTEGER NOT NULL,
ADD COLUMN     "novaPostAddressId" INTEGER,
ADD COLUMN     "novaPostTrackingNumber" TEXT,
ADD COLUMN     "originAddressId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneNumber",
ADD COLUMN     "phoneId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Phone" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "customerProfileId" INTEGER,
    "parcelId" INTEGER,

    CONSTRAINT "Phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovaPostAddress" (
    "id" SERIAL NOT NULL,
    "city" TEXT NOT NULL,
    "departmentNumber" TEXT NOT NULL,

    CONSTRAINT "NovaPostAddress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_novaPostAddressId_fkey" FOREIGN KEY ("novaPostAddressId") REFERENCES "NovaPostAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phone" ADD CONSTRAINT "Phone_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phone" ADD CONSTRAINT "Phone_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_originAddressId_fkey" FOREIGN KEY ("originAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_destinationAddressId_fkey" FOREIGN KEY ("destinationAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_novaPostAddressId_fkey" FOREIGN KEY ("novaPostAddressId") REFERENCES "NovaPostAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
