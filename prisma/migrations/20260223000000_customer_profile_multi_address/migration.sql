-- Add isPrimary column (default false)
ALTER TABLE "Address" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing addresses as primary (each profile currently has exactly one)
UPDATE "Address" SET "isPrimary" = true;

-- Drop the unique index that enforced 1:1
DROP INDEX "Address_profileId_key";

-- Add index on profileId (replaces the implicit index from the unique constraint)
CREATE INDEX "Address_profileId_idx" ON "Address"("profileId");
