ALTER TABLE "Address"
ADD COLUMN "line1" TEXT,
ADD COLUMN "line2" TEXT,
ADD COLUMN "line3" TEXT,
ADD COLUMN "county" TEXT,
ADD COLUMN "uprn" TEXT,
ADD COLUMN "latitude" DECIMAL(9, 6),
ADD COLUMN "longitude" DECIMAL(9, 6),
ADD COLUMN "provider" TEXT,
ADD COLUMN "providerRef" TEXT;

CREATE INDEX "Address_provider_providerRef_idx"
ON "Address"("provider", "providerRef");

ALTER TABLE "Parcel" ADD COLUMN "originSnapshot" JSONB;

-- Existing parcels keep a structured copy before saved addresses can be edited.
UPDATE "Parcel" AS parcel
SET "originSnapshot" = jsonb_build_object(
  'type', 'CustomerAddress',
  'addressId', address.id,
  'line1', address."line1",
  'line2', address."line2",
  'line3', address."line3",
  'street', address.street,
  'city', address.city,
  'village', address.village,
  'county', address.county,
  'postcode', address.postcode,
  'region', address.region,
  'block', address.block,
  'building', address.building,
  'flat', address.flat,
  'note', address.note,
  'countryIsoCode', country."isoCode",
  'uprn', address.uprn,
  'latitude', address.latitude,
  'longitude', address.longitude,
  'provider', address.provider,
  'providerRef', address."providerRef"
)
FROM "Address" AS address
JOIN "Country" AS country ON country.id = address."countryId"
WHERE parcel."originAddressId" = address.id
  AND parcel."originSnapshot" IS NULL;
