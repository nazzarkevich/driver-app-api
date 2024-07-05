/*
  Warnings:

  - You are about to drop the column `departmentNumber` on the `NovaPostAddress` table. All the data in the column will be lost.
  - Added the required column `Area` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `MainDescription` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Region` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `SettlementTypeCode` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Warehouses` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `NovaPostAddress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NovaPostAddress" DROP COLUMN "departmentNumber",
ADD COLUMN     "Area" TEXT NOT NULL,
ADD COLUMN     "MainDescription" TEXT NOT NULL,
ADD COLUMN     "Region" TEXT NOT NULL,
ADD COLUMN     "SettlementTypeCode" TEXT NOT NULL,
ADD COLUMN     "Warehouses" TEXT NOT NULL,
ADD COLUMN     "street" TEXT NOT NULL;
