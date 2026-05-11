/*
  Warnings:

  - You are about to drop the column `clientName` on the `PickupRequest` table. All the data in the column will be lost.
  - Added the required column `customerName` to the `PickupRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PickupRequest" DROP COLUMN "clientName",
ADD COLUMN     "customerName" TEXT NOT NULL;
