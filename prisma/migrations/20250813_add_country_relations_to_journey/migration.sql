-- Step 1: Add new columns for country IDs (nullable initially)
ALTER TABLE "Journey" ADD COLUMN "startCountryId" INTEGER;
ALTER TABLE "Journey" ADD COLUMN "endCountryId" INTEGER;

-- Step 2: Populate the new columns based on existing string values
UPDATE "Journey" 
SET "startCountryId" = c.id 
FROM "Country" c 
WHERE "Journey"."startLocation" = c.name;

UPDATE "Journey" 
SET "endCountryId" = c.id 
FROM "Country" c 
WHERE "Journey"."endLocation" = c.name;

-- Step 3: For any journeys that don't match country names, try ISO codes
UPDATE "Journey" 
SET "startCountryId" = c.id 
FROM "Country" c 
WHERE "Journey"."startLocation" = c."isoCode" AND "Journey"."startCountryId" IS NULL;

UPDATE "Journey" 
SET "endCountryId" = c.id 
FROM "Country" c 
WHERE "Journey"."endLocation" = c."isoCode" AND "Journey"."endCountryId" IS NULL;

-- Step 4: Set default values for any remaining nulls (default to Ukraine = 1)
UPDATE "Journey" SET "startCountryId" = 1 WHERE "startCountryId" IS NULL;
UPDATE "Journey" SET "endCountryId" = 1 WHERE "endCountryId" IS NULL;

-- Step 5: Make the columns NOT NULL
ALTER TABLE "Journey" ALTER COLUMN "startCountryId" SET NOT NULL;
ALTER TABLE "Journey" ALTER COLUMN "endCountryId" SET NOT NULL;

-- Step 6: Add foreign key constraints
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_startCountryId_fkey" 
  FOREIGN KEY ("startCountryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Journey" ADD CONSTRAINT "Journey_endCountryId_fkey" 
  FOREIGN KEY ("endCountryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Add indexes for performance
CREATE INDEX "Journey_startCountryId_idx" ON "Journey"("startCountryId");
CREATE INDEX "Journey_endCountryId_idx" ON "Journey"("endCountryId");

-- Step 8: Drop the old string columns
ALTER TABLE "Journey" DROP COLUMN "startLocation";
ALTER TABLE "Journey" DROP COLUMN "endLocation";