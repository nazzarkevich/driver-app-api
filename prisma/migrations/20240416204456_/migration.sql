/*
  Warnings:

  - You are about to drop the column `customerProfileId` on the `Phone` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phoneId]` on the table `CustomerProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phoneId` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Phone" DROP CONSTRAINT "Phone_customerProfileId_fkey";

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "phoneId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "recipientPhoneNumber" TEXT,
ADD COLUMN     "senderPhoneNumber" TEXT;

-- AlterTable
ALTER TABLE "Phone" DROP COLUMN "customerProfileId";

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_phoneId_key" ON "CustomerProfile"("phoneId");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
