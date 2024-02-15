/*
  Warnings:

  - Changed the type of `dateOfBirth` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserType" ADD VALUE 'Admin';
ALTER TYPE "UserType" ADD VALUE 'Subscriber';
ALTER TYPE "UserType" ADD VALUE 'Member';

-- AlterTable
ALTER TABLE "Journey" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dateOfBirth",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3) NOT NULL;
