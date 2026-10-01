CREATE TABLE "TariffGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "businessId" INTEGER NOT NULL,
    "originCountryId" INTEGER NOT NULL,
    "destinationCountryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TariffGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tariff" ADD COLUMN "tariffGroupId" INTEGER;

CREATE UNIQUE INDEX "TariffGroup_businessId_originCountryId_destinationCountryId_key"
ON "TariffGroup"("businessId", "originCountryId", "destinationCountryId");
CREATE INDEX "TariffGroup_businessId_idx" ON "TariffGroup"("businessId");
CREATE INDEX "TariffGroup_isActive_idx" ON "TariffGroup"("isActive");
CREATE INDEX "TariffGroup_isDeleted_idx" ON "TariffGroup"("isDeleted");
CREATE INDEX "Tariff_tariffGroupId_idx" ON "Tariff"("tariffGroupId");

ALTER TABLE "TariffGroup"
ADD CONSTRAINT "TariffGroup_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TariffGroup"
ADD CONSTRAINT "TariffGroup_originCountryId_fkey"
FOREIGN KEY ("originCountryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TariffGroup"
ADD CONSTRAINT "TariffGroup_destinationCountryId_fkey"
FOREIGN KEY ("destinationCountryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tariff"
ADD CONSTRAINT "Tariff_tariffGroupId_fkey"
FOREIGN KEY ("tariffGroupId") REFERENCES "TariffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH tariff_routes AS (
  SELECT DISTINCT
    tariff."businessId",
    tariff."originCountryId",
    COALESCE(
      tariff."destinationCountryId",
      CASE
        WHEN origin."isoCode" = 'GB' THEN (
          SELECT "id" FROM "Country" WHERE "isoCode" = 'UA' LIMIT 1
        )
        WHEN origin."isoCode" = 'UA' THEN (
          SELECT "id" FROM "Country" WHERE "isoCode" = 'GB' LIMIT 1
        )
      END
    ) AS "destinationCountryId"
  FROM "Tariff" tariff
  JOIN "Country" origin ON origin."id" = tariff."originCountryId"
  WHERE tariff."originCountryId" IS NOT NULL
    AND tariff."isDeleted" = false
), valid_routes AS (
  SELECT * FROM tariff_routes
  WHERE "destinationCountryId" IS NOT NULL
    AND "originCountryId" <> "destinationCountryId"
)
INSERT INTO "TariffGroup" (
  "name",
  "businessId",
  "originCountryId",
  "destinationCountryId",
  "updatedAt"
)
SELECT
  origin."name" || ' → ' || destination."name",
  route."businessId",
  route."originCountryId",
  route."destinationCountryId",
  CURRENT_TIMESTAMP
FROM valid_routes route
JOIN "Country" origin ON origin."id" = route."originCountryId"
JOIN "Country" destination ON destination."id" = route."destinationCountryId"
ON CONFLICT ("businessId", "originCountryId", "destinationCountryId") DO NOTHING;

UPDATE "Tariff" tariff
SET "tariffGroupId" = tariff_group."id"
FROM "TariffGroup" tariff_group
JOIN "Country" origin ON origin."id" = tariff_group."originCountryId"
WHERE tariff."businessId" = tariff_group."businessId"
  AND tariff."originCountryId" = tariff_group."originCountryId"
  AND COALESCE(
    tariff."destinationCountryId",
    CASE
      WHEN origin."isoCode" = 'GB' THEN (
        SELECT "id" FROM "Country" WHERE "isoCode" = 'UA' LIMIT 1
      )
      WHEN origin."isoCode" = 'UA' THEN (
        SELECT "id" FROM "Country" WHERE "isoCode" = 'GB' LIMIT 1
      )
    END
  ) = tariff_group."destinationCountryId";
