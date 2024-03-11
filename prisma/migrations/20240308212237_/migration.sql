/*
  Warnings:

  - You are about to drop the column `destination` on the `Journey` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `Journey` table. All the data in the column will be lost.
  - Added the required column `endLocation` to the `Journey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLocation` to the `Journey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Journey" DROP COLUMN "destination",
DROP COLUMN "origin",
ADD COLUMN     "endLocation" TEXT NOT NULL,
ADD COLUMN     "startLocation" TEXT NOT NULL;
