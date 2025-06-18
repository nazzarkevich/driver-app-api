/*
  Warnings:

  - Added the required column `businessId` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add businessId as nullable first
ALTER TABLE "Address" ADD COLUMN "businessId" INTEGER;

-- Step 2: Update existing addresses to use businessId = 1 (assuming there's a default business)
UPDATE "Address" SET "businessId" = 1 WHERE "businessId" IS NULL;

-- Step 3: Make businessId NOT NULL
ALTER TABLE "Address" ALTER COLUMN "businessId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Address_businessId_idx" ON "Address"("businessId");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
