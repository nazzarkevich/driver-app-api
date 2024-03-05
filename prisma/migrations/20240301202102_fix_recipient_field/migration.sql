/*
  Warnings:

  - You are about to drop the column `recepientId` on the `Parcel` table. All the data in the column will be lost.
  - Added the required column `recipientId` to the `Parcel` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Parcel" DROP CONSTRAINT "Parcel_recepientId_fkey";

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "recepientId",
ADD COLUMN     "recipientId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
