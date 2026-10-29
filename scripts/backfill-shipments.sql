BEGIN;

WITH source AS (
  SELECT p.*,
    md5(p."businessId"::text || ':' || CASE WHEN p."groupId" IS NOT NULL
      THEN 'group:' || p."groupId"::text ELSE 'parcel:' || p."id"::text END)::uuid AS shipment_id,
    NULLIF(upper(regexp_replace(COALESCE(p."destinationSnapshot"->>'postcode', ''), '[[:space:]]', '', 'g')), '') AS destination_postcode,
    NULLIF(upper(regexp_replace(COALESCE(p."originSnapshot"->>'postcode', ''), '[[:space:]]', '', 'g')), '') AS sender_postcode
  FROM "Parcel" p
  WHERE p."shipmentId" IS NULL
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
SELECT shipment_id, "businessId", created_at, postcode, postcode_source FROM grouped
ON CONFLICT ("id") DO NOTHING;

UPDATE "Parcel" p SET "shipmentId" = md5(p."businessId"::text || ':' || CASE WHEN p."groupId" IS NOT NULL
  THEN 'group:' || p."groupId"::text ELSE 'parcel:' || p."id"::text END)::uuid
WHERE p."shipmentId" IS NULL;

COMMIT;
