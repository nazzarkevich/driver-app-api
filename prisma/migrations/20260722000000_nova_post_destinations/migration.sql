-- CreateEnum
CREATE TYPE "ParcelDestinationType" AS ENUM ('CustomerAddress', 'NovaPostWarehouse');

-- Add lifecycle state to customer addresses.
ALTER TABLE "Address"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NovaPostWarehouse" (
    "id" SERIAL NOT NULL,
    "externalRef" TEXT NOT NULL,
    "cityRef" TEXT,
    "areaRef" TEXT,
    "regionRef" TEXT,
    "warehouseNumber" TEXT,
    "name" TEXT NOT NULL,
    "shortAddress" TEXT,
    "cityName" TEXT NOT NULL,
    "areaName" TEXT,
    "regionName" TEXT,
    "warehouseType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "providerData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovaPostWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNovaPostAddress" (
    "id" SERIAL NOT NULL,
    "customerProfileId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNovaPostAddress_pkey" PRIMARY KEY ("id")
);

-- Add the new parcel destination columns as nullable until existing rows are backfilled.
ALTER TABLE "Parcel"
ADD COLUMN "destinationType" "ParcelDestinationType",
ADD COLUMN "customerNovaPostAddressId" INTEGER,
ADD COLUMN "novaPostWarehouseId" INTEGER,
ADD COLUMN "destinationSnapshot" JSONB;

-- Legacy Nova Post selections are intentionally discarded. Every existing parcel
-- already has a required regular destination and remains a regular-address parcel.
UPDATE "Parcel"
SET "destinationType" = 'CustomerAddress';

UPDATE "Parcel" AS parcel
SET "destinationSnapshot" = jsonb_strip_nulls(
    jsonb_build_object(
        'type', 'CustomerAddress',
        'addressId', address."id",
        'street', address."street",
        'city', address."city",
        'village', address."village",
        'postcode', address."postcode",
        'region', address."region",
        'block', address."block",
        'building', address."building",
        'flat', address."flat",
        'note', address."note",
        'countryIsoCode', country."isoCode"
    )
)
FROM "Address" AS address
LEFT JOIN "Country" AS country ON country."id" = address."countryId"
WHERE parcel."destinationAddressId" = address."id";

ALTER TABLE "Parcel"
ALTER COLUMN "destinationType" SET NOT NULL,
ALTER COLUMN "destinationAddressId" DROP NOT NULL;

-- Remove legacy relations and storage after the replacement destination is valid.
ALTER TABLE "CustomerProfile"
DROP CONSTRAINT IF EXISTS "CustomerProfile_novaPostAddressId_fkey";

ALTER TABLE "Parcel"
DROP CONSTRAINT IF EXISTS "Parcel_novaPostAddressId_fkey";

ALTER TABLE "CustomerProfile"
DROP COLUMN "novaPostAddressId";

ALTER TABLE "Parcel"
DROP COLUMN "novaPostAddressId";

DROP TABLE "NovaPostAddress";

-- Normalize historical duplicate primary rows before enforcing the invariant.
WITH ranked_primary AS (
    SELECT "id", row_number() OVER (
        PARTITION BY "profileId"
        ORDER BY "id"
    ) AS position
    FROM "Address"
    WHERE "isPrimary" = true
)
UPDATE "Address"
SET "isPrimary" = false
WHERE "id" IN (
    SELECT "id" FROM ranked_primary WHERE position > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "NovaPostWarehouse_externalRef_key"
ON "NovaPostWarehouse"("externalRef");
CREATE INDEX "NovaPostWarehouse_cityRef_idx"
ON "NovaPostWarehouse"("cityRef");
CREATE INDEX "NovaPostWarehouse_cityName_idx"
ON "NovaPostWarehouse"("cityName");
CREATE INDEX "NovaPostWarehouse_warehouseNumber_idx"
ON "NovaPostWarehouse"("warehouseNumber");
CREATE INDEX "NovaPostWarehouse_isActive_idx"
ON "NovaPostWarehouse"("isActive");

CREATE UNIQUE INDEX "CustomerNovaPostAddress_customerProfileId_warehouseId_key"
ON "CustomerNovaPostAddress"("customerProfileId", "warehouseId");
CREATE INDEX "CustomerNovaPostAddress_customerProfileId_idx"
ON "CustomerNovaPostAddress"("customerProfileId");
CREATE INDEX "CustomerNovaPostAddress_warehouseId_idx"
ON "CustomerNovaPostAddress"("warehouseId");
CREATE INDEX "CustomerNovaPostAddress_customerProfileId_isDefault_idx"
ON "CustomerNovaPostAddress"("customerProfileId", "isDefault");

CREATE INDEX "Parcel_destinationType_idx" ON "Parcel"("destinationType");
CREATE INDEX "Parcel_destinationAddressId_idx" ON "Parcel"("destinationAddressId");
CREATE INDEX "Parcel_customerNovaPostAddressId_idx" ON "Parcel"("customerNovaPostAddressId");
CREATE INDEX "Parcel_novaPostWarehouseId_idx" ON "Parcel"("novaPostWarehouseId");

CREATE UNIQUE INDEX "CustomerNovaPostAddress_one_default_per_customer"
ON "CustomerNovaPostAddress" ("customerProfileId")
WHERE "isDefault" = true;

CREATE UNIQUE INDEX "Address_one_primary_per_profile"
ON "Address" ("profileId")
WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "CustomerNovaPostAddress"
ADD CONSTRAINT "CustomerNovaPostAddress_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerNovaPostAddress"
ADD CONSTRAINT "CustomerNovaPostAddress_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "NovaPostWarehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_customerNovaPostAddressId_fkey"
FOREIGN KEY ("customerNovaPostAddressId") REFERENCES "CustomerNovaPostAddress"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_novaPostWarehouseId_fkey"
FOREIGN KEY ("novaPostWarehouseId") REFERENCES "NovaPostWarehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_destination_shape_check" CHECK (
    (
        "destinationType" = 'CustomerAddress'
        AND "destinationAddressId" IS NOT NULL
        AND "customerNovaPostAddressId" IS NULL
        AND "novaPostWarehouseId" IS NULL
    )
    OR
    (
        "destinationType" = 'NovaPostWarehouse'
        AND "destinationAddressId" IS NULL
        AND "novaPostWarehouseId" IS NOT NULL
    )
);
