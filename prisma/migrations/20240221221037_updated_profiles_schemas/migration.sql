/*
  Warnings:

  - You are about to drop the column `driverProfileId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `DriverProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `DriverProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_driverProfileId_fkey";

-- DropIndex
DROP INDEX "User_driverProfileId_key";

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "courierProfileId" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "driverProfileId";

-- CreateTable
CREATE TABLE "CourierProfile" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CourierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierProfile_userId_key" ON "CourierProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierProfile" ADD CONSTRAINT "CourierProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_courierProfileId_fkey" FOREIGN KEY ("courierProfileId") REFERENCES "CourierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
