/*
  Warnings:

  - You are about to drop the column `auth0Id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[supabaseId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SIGNUP', 'PASSWORD_CHANGE', 'ROLE_CHANGE', 'PROFILE_UPDATE', 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'EXPORT_DATA', 'IMPORT_DATA', 'ARCHIVE', 'RESTORE', 'APPROVE', 'REJECT', 'ASSIGN', 'UNASSIGN', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_phoneId_fkey";

-- DropIndex
DROP INDEX "User_auth0Id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "auth0Id",
DROP COLUMN "password",
ADD COLUMN     "supabaseId" TEXT,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "dateOfBirth" DROP NOT NULL,
ALTER COLUMN "phoneId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthProfile" (
    "id" SERIAL NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "lastSignIn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "method" TEXT,
    "endpoint" TEXT,
    "requestId" TEXT,
    "duration" INTEGER,
    "statusCode" INTEGER,
    "businessId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthProfile_supabaseId_key" ON "AuthProfile"("supabaseId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_idx" ON "AuditLog"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
