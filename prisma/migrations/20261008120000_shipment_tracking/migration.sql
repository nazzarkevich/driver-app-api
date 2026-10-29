BEGIN;

CREATE TABLE "Shipment" (
  "id" UUID NOT NULL PRIMARY KEY,
  "businessId" INTEGER NOT NULL REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verificationPostcode" TEXT,
  "verificationPostcodeSource" TEXT,
  CONSTRAINT "Shipment_verification_check" CHECK (
    ("verificationPostcode" IS NULL AND "verificationPostcodeSource" IS NULL)
    OR ("verificationPostcode" IS NOT NULL AND "verificationPostcode" <> ''
      AND "verificationPostcodeSource" IS NOT NULL
      AND "verificationPostcodeSource" IN ('destination', 'sender'))
  )
);
CREATE UNIQUE INDEX "Shipment_id_businessId_key" ON "Shipment"("id", "businessId");
CREATE INDEX "Shipment_businessId_idx" ON "Shipment"("businessId");

ALTER TABLE "Parcel" ADD COLUMN "shipmentId" UUID;

-- Stable tenant-scoped IDs preserve legacy groups without merging businesses.
WITH source AS (
  SELECT p.*,
    md5(p."businessId"::text || ':' || CASE WHEN p."groupId" IS NOT NULL
      THEN 'group:' || p."groupId"::text ELSE 'parcel:' || p."id"::text END)::uuid AS shipment_id,
    NULLIF(upper(regexp_replace(COALESCE(p."destinationSnapshot"->>'postcode', ''), '[[:space:]]', '', 'g')), '') AS destination_postcode,
    NULLIF(upper(regexp_replace(COALESCE(p."originSnapshot"->>'postcode', ''), '[[:space:]]', '', 'g')), '') AS sender_postcode
  FROM "Parcel" p
), candidates AS (
  SELECT *, COALESCE(destination_postcode, sender_postcode) AS postcode,
    CASE WHEN destination_postcode IS NOT NULL THEN 'destination'
      WHEN sender_postcode IS NOT NULL THEN 'sender' END AS postcode_source
  FROM source
), grouped AS (
  SELECT shipment_id, "businessId", min("createdAt") AS created_at,
    CASE WHEN count(postcode) = count(*) AND count(DISTINCT postcode || ':' || postcode_source) = 1
      THEN min(postcode) END AS postcode,
    CASE WHEN count(postcode) = count(*) AND count(DISTINCT postcode || ':' || postcode_source) = 1
      THEN min(postcode_source) END AS postcode_source
  FROM candidates GROUP BY shipment_id, "businessId"
)
INSERT INTO "Shipment" ("id", "businessId", "createdAt", "verificationPostcode", "verificationPostcodeSource")
SELECT shipment_id, "businessId", created_at, postcode, postcode_source FROM grouped;

UPDATE "Parcel" p SET "shipmentId" = md5(p."businessId"::text || ':' || CASE WHEN p."groupId" IS NOT NULL
  THEN 'group:' || p."groupId"::text ELSE 'parcel:' || p."id"::text END)::uuid;

ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_shipmentId_businessId_fkey"
  FOREIGN KEY ("shipmentId", "businessId") REFERENCES "Shipment"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Parcel_shipmentId_businessId_idx" ON "Parcel"("shipmentId", "businessId");

CREATE TABLE "ShipmentTrackingLink" (
  "id" UUID NOT NULL PRIMARY KEY,
  "shipmentId" UUID NOT NULL REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "ShipmentTrackingLink_tokenHash_key" ON "ShipmentTrackingLink"("tokenHash");
CREATE INDEX "ShipmentTrackingLink_shipmentId_revokedAt_idx" ON "ShipmentTrackingLink"("shipmentId", "revokedAt");

CREATE TABLE "ParcelCreationRequest" (
  "businessId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "parcelIds" INTEGER[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("businessId", "userId", "key")
);

CREATE TABLE "TrackingRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "TrackingRateLimit_expiresAt_idx" ON "TrackingRateLimit"("expiresAt");

COMMIT;
