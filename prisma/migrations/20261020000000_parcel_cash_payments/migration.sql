-- Cash-payment ledger and legacy reconciliation. This migration preserves all
-- parcels and does not infer historical currency from current business settings.
CREATE TYPE "ParcelPaymentEntryKind" AS ENUM ('Collection', 'Reversal', 'LegacyOpeningBalance');
CREATE TYPE "ParcelPaymentMethod" AS ENUM ('Cash');
CREATE TYPE "PaymentReconciliationState" AS ENUM ('Reconciled', 'RequiresReconciliation');

ALTER TABLE "Parcel"
  ADD COLUMN "paymentCurrency" TEXT,
  ADD COLUMN "paymentReconciliationState" "PaymentReconciliationState";

ALTER TABLE "ParcelPrice"
  ADD COLUMN "changeReason" TEXT,
  ADD COLUMN "changedByUserId" INTEGER;

CREATE TABLE "ParcelPaymentEntry" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "parcelId" INTEGER NOT NULL,
  "parcelPriceId" INTEGER NOT NULL,
  "kind" "ParcelPaymentEntryKind" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "method" "ParcelPaymentMethod",
  "payerParty" "PaymentParty",
  "collectorId" INTEGER,
  "recordedById" INTEGER,
  "note" TEXT,
  "reason" TEXT,
  "reversesEntryId" INTEGER,
  "replacementEntryId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParcelPaymentEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParcelPaymentEntry_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "ParcelPaymentRequest" (
  "businessId" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "parcelId" INTEGER NOT NULL,
  "operation" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "responsePayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParcelPaymentRequest_pkey" PRIMARY KEY ("businessId", "idempotencyKey")
);

CREATE UNIQUE INDEX "ParcelPaymentEntry_reversesEntryId_key" ON "ParcelPaymentEntry"("reversesEntryId");
CREATE UNIQUE INDEX "ParcelPaymentEntry_replacementEntryId_key" ON "ParcelPaymentEntry"("replacementEntryId");
CREATE INDEX "ParcelPaymentEntry_businessId_parcelId_createdAt_idx" ON "ParcelPaymentEntry"("businessId", "parcelId", "createdAt");
CREATE INDEX "ParcelPaymentEntry_parcelPriceId_idx" ON "ParcelPaymentEntry"("parcelPriceId");
CREATE INDEX "ParcelPaymentEntry_collectorId_idx" ON "ParcelPaymentEntry"("collectorId");
CREATE INDEX "ParcelPaymentEntry_recordedById_idx" ON "ParcelPaymentEntry"("recordedById");
CREATE INDEX "ParcelPaymentRequest_parcelId_idx" ON "ParcelPaymentRequest"("parcelId");
CREATE INDEX "ParcelPrice_changedByUserId_idx" ON "ParcelPrice"("changedByUserId");

ALTER TABLE "ParcelPrice" ADD CONSTRAINT "ParcelPrice_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_parcelId_fkey"
  FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_parcelPriceId_fkey"
  FOREIGN KEY ("parcelPriceId") REFERENCES "ParcelPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_collectorId_fkey"
  FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_reversesEntryId_fkey"
  FOREIGN KEY ("reversesEntryId") REFERENCES "ParcelPaymentEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentEntry" ADD CONSTRAINT "ParcelPaymentEntry_replacementEntryId_fkey"
  FOREIGN KEY ("replacementEntryId") REFERENCES "ParcelPaymentEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentRequest" ADD CONSTRAINT "ParcelPaymentRequest_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelPaymentRequest" ADD CONSTRAINT "ParcelPaymentRequest_parcelId_fkey"
  FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Parcel" AS p
SET "paymentCurrency" = pp."currency"
FROM "ParcelPrice" AS pp
WHERE p."selectedPriceId" = pp."id";

UPDATE "Parcel"
SET "paymentReconciliationState" = CASE
  WHEN "paymentStatus" = 'PartiallyPaid' OR "paymentCurrency" IS NULL
    THEN 'RequiresReconciliation'::"PaymentReconciliationState"
  ELSE 'Reconciled'::"PaymentReconciliationState"
END;

UPDATE "Parcel"
SET "paymentStatus" = 'Paid'
WHERE "price" = 0
  AND "paymentReconciliationState" = 'Reconciled';

INSERT INTO "ParcelPaymentEntry" (
  "businessId", "parcelId", "parcelPriceId", "kind", "amount", "currency", "reason"
)
SELECT
  p."businessId",
  p."id",
  p."selectedPriceId",
  'LegacyOpeningBalance'::"ParcelPaymentEntryKind",
  p."price",
  p."paymentCurrency",
  'Migrated from legacy Paid status'
FROM "Parcel" AS p
WHERE p."paymentStatus" = 'Paid'
  AND p."price" > 0
  AND p."paymentReconciliationState" = 'Reconciled'
  AND p."selectedPriceId" IS NOT NULL;

ALTER TABLE "Parcel"
  ALTER COLUMN "paymentReconciliationState" SET NOT NULL,
  ALTER COLUMN "paymentReconciliationState" SET DEFAULT 'Reconciled';
