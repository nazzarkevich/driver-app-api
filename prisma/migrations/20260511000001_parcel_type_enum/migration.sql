-- Step 1: Add temporary text columns for backfill
ALTER TABLE "Parcel" ADD COLUMN "parcelTypeTemp" TEXT;
ALTER TABLE "Tariff" ADD COLUMN "parcelTypeTemp" TEXT;

-- Step 2: Backfill from the ParcelType table into the temp columns
UPDATE "Parcel" p
SET "parcelTypeTemp" = pt."name"
FROM "ParcelType" pt
WHERE p."parcelTypeId" = pt."id";

UPDATE "Tariff" t
SET "parcelTypeTemp" = pt."name"
FROM "ParcelType" pt
WHERE t."parcelTypeId" = pt."id";

-- Step 3: Fallback for any unmapped rows
UPDATE "Parcel" SET "parcelTypeTemp" = 'Regular' WHERE "parcelTypeTemp" IS NULL;

-- Step 4: Drop FK columns
ALTER TABLE "Parcel" DROP COLUMN "parcelTypeId";
ALTER TABLE "Tariff" DROP COLUMN "parcelTypeId";

-- Step 5: Drop the ParcelType table — this frees the "ParcelType" name in pg_type
DROP TABLE "ParcelType";

-- Step 6: Now the name is free, create the enum
CREATE TYPE "ParcelType" AS ENUM ('Regular', 'Passport', 'Document', 'Money');

-- Step 7: Add enum columns
ALTER TABLE "Parcel" ADD COLUMN "parcelType" "ParcelType";
ALTER TABLE "Tariff" ADD COLUMN "parcelType" "ParcelType";

-- Step 8: Transfer from temp columns
UPDATE "Parcel" SET "parcelType" = "parcelTypeTemp"::"ParcelType";
UPDATE "Tariff" SET "parcelType" = "parcelTypeTemp"::"ParcelType";

-- Step 9: Make Parcel.parcelType NOT NULL
ALTER TABLE "Parcel" ALTER COLUMN "parcelType" SET NOT NULL;

-- Step 10: Drop temp columns
ALTER TABLE "Parcel" DROP COLUMN "parcelTypeTemp";
ALTER TABLE "Tariff" DROP COLUMN "parcelTypeTemp";
