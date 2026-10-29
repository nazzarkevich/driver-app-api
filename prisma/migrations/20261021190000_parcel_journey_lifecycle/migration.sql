CREATE TYPE "JourneyStatus" AS ENUM (
  'Scheduled',
  'InTransit',
  'Completed',
  'Cancelled'
);

ALTER TABLE "Journey"
ADD COLUMN "status" "JourneyStatus" NOT NULL DEFAULT 'Scheduled',
ADD COLUMN "actualDepartureAt" TIMESTAMP(3);

UPDATE "Journey"
SET
  "status" = 'Completed',
  "actualDepartureAt" = COALESCE("departureDate", "createdAt")
WHERE "isCompleted" = TRUE;

UPDATE "Journey"
SET
  "status" = 'InTransit',
  "actualDepartureAt" = "departureDate"
WHERE "isCompleted" = FALSE
  AND "departureDate" <= CURRENT_TIMESTAMP;

UPDATE "Parcel" AS parcel
SET "deliveryStatus" = 'AtDestinationWarehouse'
FROM "Journey" AS journey
WHERE parcel."journeyId" = journey."id"
  AND parcel."deliveryStatus" = 'InTransit'
  AND journey."status" = 'Completed';

UPDATE "Parcel" AS parcel
SET "deliveryStatus" = 'PickedUp'
WHERE parcel."deliveryStatus" = 'InTransit'
  AND (
    parcel."journeyId" IS NULL
    OR EXISTS (
      SELECT 1
      FROM "Journey" AS journey
      WHERE journey."id" = parcel."journeyId"
        AND journey."status" = 'Scheduled'
    )
  );

CREATE TABLE "ParcelStatusTransition" (
  "id" SERIAL NOT NULL,
  "parcelId" INTEGER NOT NULL,
  "businessId" INTEGER NOT NULL,
  "journeyId" INTEGER,
  "batchId" UUID NOT NULL,
  "fromStatus" "DeliveryStatus" NOT NULL,
  "toStatus" "DeliveryStatus" NOT NULL,
  "actorId" INTEGER,
  "reason" TEXT,
  "isCorrection" BOOLEAN NOT NULL DEFAULT FALSE,
  "reversesBatchId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParcelStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JourneyStatusTransition" (
  "id" SERIAL NOT NULL,
  "journeyId" INTEGER NOT NULL,
  "businessId" INTEGER NOT NULL,
  "batchId" UUID NOT NULL,
  "fromStatus" "JourneyStatus" NOT NULL,
  "toStatus" "JourneyStatus" NOT NULL,
  "actorId" INTEGER,
  "reason" TEXT,
  "isCorrection" BOOLEAN NOT NULL DEFAULT FALSE,
  "reversesBatchId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParcelStatusTransition_parcelId_createdAt_idx"
ON "ParcelStatusTransition"("parcelId", "createdAt");
CREATE INDEX "ParcelStatusTransition_businessId_batchId_idx"
ON "ParcelStatusTransition"("businessId", "batchId");
CREATE INDEX "ParcelStatusTransition_journeyId_idx"
ON "ParcelStatusTransition"("journeyId");
CREATE INDEX "JourneyStatusTransition_journeyId_createdAt_idx"
ON "JourneyStatusTransition"("journeyId", "createdAt");
CREATE INDEX "JourneyStatusTransition_businessId_batchId_idx"
ON "JourneyStatusTransition"("businessId", "batchId");

ALTER TABLE "ParcelStatusTransition"
ADD CONSTRAINT "ParcelStatusTransition_parcelId_fkey"
FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JourneyStatusTransition"
ADD CONSTRAINT "JourneyStatusTransition_journeyId_fkey"
FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
