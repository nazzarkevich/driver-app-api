CREATE TABLE "ParcelTrackingSequence" (
    "businessId" INTEGER NOT NULL,
    "dateKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelTrackingSequence_pkey" PRIMARY KEY ("businessId", "dateKey")
);

ALTER TABLE "ParcelTrackingSequence"
ADD CONSTRAINT "ParcelTrackingSequence_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
