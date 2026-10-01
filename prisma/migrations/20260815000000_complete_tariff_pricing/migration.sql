ALTER TABLE "Business"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP';

UPDATE "Tariff"
SET "minimumPrice" = COALESCE("fixedPrice", "minimumPrice"),
    "currency" = 'GBP'
WHERE "pricingType" = 'Fixed';

UPDATE "Tariff"
SET "pricingType" = 'PerKg'
WHERE "pricingType" = 'PerKgWithMinimum';

UPDATE "Business" SET "currency" = 'GBP';

UPDATE "Tariff"
SET "isActive" = false
WHERE "tariffGroupId" IS NULL;

DROP INDEX IF EXISTS "Tariff_isDefault_idx";
DROP INDEX IF EXISTS "Tariff_businessId_isDefault_idx";
DROP INDEX IF EXISTS "Tariff_originCountryId_idx";
DROP INDEX IF EXISTS "Tariff_destinationCountryId_idx";
DROP INDEX IF EXISTS "Tariff_priority_idx";

ALTER TABLE "Tariff"
DROP COLUMN "currency",
DROP COLUMN "isDefault",
DROP COLUMN "originCountryId",
DROP COLUMN "destinationCountryId",
DROP COLUMN "fixedPrice",
DROP COLUMN "priority";

ALTER TABLE "Parcel"
ADD COLUMN "originType" "ParcelDestinationType" NOT NULL DEFAULT 'CustomerAddress',
ADD COLUMN "originCustomerNovaPostAddressId" INTEGER,
ADD COLUMN "originNovaPostWarehouseId" INTEGER,
ALTER COLUMN "originAddressId" DROP NOT NULL;

CREATE INDEX "Parcel_originType_idx" ON "Parcel"("originType");
CREATE INDEX "Parcel_originCustomerNovaPostAddressId_idx" ON "Parcel"("originCustomerNovaPostAddressId");
CREATE INDEX "Parcel_originNovaPostWarehouseId_idx" ON "Parcel"("originNovaPostWarehouseId");
CREATE UNIQUE INDEX "Parcel_selectedPriceId_key" ON "Parcel"("selectedPriceId");

ALTER TABLE "Parcel"
ADD CONSTRAINT "Parcel_originCustomerNovaPostAddressId_fkey"
FOREIGN KEY ("originCustomerNovaPostAddressId") REFERENCES "CustomerNovaPostAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "Parcel_originNovaPostWarehouseId_fkey"
FOREIGN KEY ("originNovaPostWarehouseId") REFERENCES "NovaPostWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ParcelPrice"
ADD COLUMN "tariffGroupId" INTEGER,
ADD COLUMN "tariffGroupName" TEXT;

CREATE INDEX "ParcelPrice_tariffGroupId_idx" ON "ParcelPrice"("tariffGroupId");

ALTER TABLE "ParcelPrice"
ADD CONSTRAINT "ParcelPrice_tariffGroupId_fkey"
FOREIGN KEY ("tariffGroupId") REFERENCES "TariffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
