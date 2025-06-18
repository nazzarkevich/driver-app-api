/*
  Warnings:

  - You are about to drop the column `connectedTo` on the `ConnectedParcel` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[parcelId,connectedToId]` on the table `ConnectedParcel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `connectedToId` to the `ConnectedParcel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connectionType` to the `ConnectedParcel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ConnectedParcel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConnectedParcel" DROP COLUMN "connectedTo",
ADD COLUMN     "connectedToId" INTEGER NOT NULL,
ADD COLUMN     "connectionType" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ConnectedParcel_parcelId_idx" ON "ConnectedParcel"("parcelId");

-- CreateIndex
CREATE INDEX "ConnectedParcel_connectedToId_idx" ON "ConnectedParcel"("connectedToId");

-- CreateIndex
CREATE INDEX "ConnectedParcel_connectionType_idx" ON "ConnectedParcel"("connectionType");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedParcel_parcelId_connectedToId_key" ON "ConnectedParcel"("parcelId", "connectedToId");

-- AddForeignKey
ALTER TABLE "ConnectedParcel" ADD CONSTRAINT "ConnectedParcel_parcel_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedParcel" ADD CONSTRAINT "ConnectedParcel_connectedTo_fkey" FOREIGN KEY ("connectedToId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
