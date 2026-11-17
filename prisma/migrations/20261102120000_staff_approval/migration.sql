CREATE TYPE "StaffApprovalStatus" AS ENUM ('Pending', 'Approved');
ALTER TABLE "User"
  ADD COLUMN "staffApprovalStatus" "StaffApprovalStatus" NOT NULL DEFAULT 'Approved',
  ADD COLUMN "staffApprovedAt" TIMESTAMP(3);
CREATE INDEX "User_businessId_staffApprovalStatus_createdAt_idx"
  ON "User"("businessId", "staffApprovalStatus", "createdAt");
