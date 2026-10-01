-- CreateEnum
CREATE TYPE "TariffPricingType" AS ENUM ('Fixed', 'PerKg', 'PerKgWithMinimum');

-- CreateEnum
CREATE TYPE "DiscountReason" AS ENUM ('Manual', 'Subscriber', 'Referral', 'FirstTimePurchase', 'PromoCode');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('Supabase', 'Google', 'Apple', 'EmailPassword');

-- AlterEnum
BEGIN;
CREATE TYPE "DiscountType_new" AS ENUM ('None', 'Percentage', 'FixedAmount');
ALTER TABLE "public"."Parcel" ALTER COLUMN "discountType" DROP DEFAULT;
ALTER TABLE "Parcel" ALTER COLUMN "discountType" TYPE "DiscountType_new" USING ("discountType"::text::"DiscountType_new");
ALTER TABLE "DiscountRule" ALTER COLUMN "discountType" TYPE "DiscountType_new" USING ("discountType"::text::"DiscountType_new");
ALTER TYPE "DiscountType" RENAME TO "DiscountType_old";
ALTER TYPE "DiscountType_new" RENAME TO "DiscountType";
DROP TYPE "public"."DiscountType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "DiscountRule" DROP CONSTRAINT "DiscountRule_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Parcel" DROP CONSTRAINT "Parcel_tariffId_fkey";

-- DropForeignKey
ALTER TABLE "ParcelDiscount" DROP CONSTRAINT "ParcelDiscount_discountRuleId_fkey";

-- DropForeignKey
ALTER TABLE "ParcelDiscount" DROP CONSTRAINT "ParcelDiscount_parcelId_fkey";

-- DropIndex
DROP INDEX "AuthProfile_supabaseId_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_supabaseId_key";

-- AlterTable
ALTER TABLE "AuthProfile" DROP COLUMN "supabaseId",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "providerId" TEXT NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL,
DROP COLUMN "provider",
ADD COLUMN     "provider" "AuthProvider" NOT NULL;

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "email" TEXT,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parcel" DROP COLUMN "discount",
DROP COLUMN "discountType",
DROP COLUMN "tariffId",
ADD COLUMN     "selectedPriceId" INTEGER,
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(10,3),
ALTER COLUMN "parcelMoneyAmount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "cost" SET DEFAULT 0,
ALTER COLUMN "cost" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "calculatedPrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Phone" DROP COLUMN "parcelId";

-- AlterTable
ALTER TABLE "Tariff" DROP COLUMN "isWeightBased",
ADD COLUMN     "destinationCountryId" INTEGER,
ADD COLUMN     "fixedPrice" DECIMAL(10,2),
ADD COLUMN     "pricingType" "TariffPricingType" NOT NULL DEFAULT 'Fixed',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "currency" SET DEFAULT 'GBP',
ALTER COLUMN "minimumPrice" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "pricePerKg" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "weightThreshold" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "supabaseId",
ALTER COLUMN "lastName" DROP NOT NULL,
ALTER COLUMN "firstName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "year",
ADD COLUMN     "year" INTEGER NOT NULL;

-- DropTable
DROP TABLE "DiscountRule";

-- DropTable
DROP TABLE "ParcelDiscount";

-- CreateTable
CREATE TABLE "ParcelPrice" (
    "id" SERIAL NOT NULL,
    "parcelId" INTEGER NOT NULL,
    "tariffId" INTEGER,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "parcelType" "ParcelType" NOT NULL,
    "weight" DECIMAL(10,3) NOT NULL,
    "tariffName" TEXT,
    "pricingType" "TariffPricingType" NOT NULL,
    "fixedPrice" DECIMAL(10,2),
    "minimumPrice" DECIMAL(10,2),
    "pricePerKg" DECIMAL(10,2),
    "weightThreshold" DECIMAL(10,3),
    "originCountryId" INTEGER,
    "destinationCountryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelPriceDiscount" (
    "id" SERIAL NOT NULL,
    "parcelPriceId" INTEGER NOT NULL,
    "discountId" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'None',
    "discountReason" "DiscountReason" NOT NULL DEFAULT 'Manual',
    "value" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelPriceDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "businessId" INTEGER NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'None',
    "discountReason" "DiscountReason" NOT NULL DEFAULT 'Manual',
    "value" DECIMAL(10,2) NOT NULL,
    "parcelType" "ParcelType",
    "originCountryId" INTEGER,
    "destinationCountryId" INTEGER,
    "minimumAmount" DECIMAL(10,2),
    "minimumWeight" DECIMAL(10,3),
    "maximumWeight" DECIMAL(10,3),
    "minParcelCount" INTEGER,
    "isForSubscribers" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcelPrice_parcelId_idx" ON "ParcelPrice"("parcelId");

-- CreateIndex
CREATE INDEX "ParcelPrice_tariffId_idx" ON "ParcelPrice"("tariffId");

-- CreateIndex
CREATE INDEX "ParcelPrice_parcelId_isSelected_idx" ON "ParcelPrice"("parcelId", "isSelected");

-- CreateIndex
CREATE INDEX "ParcelPrice_originCountryId_idx" ON "ParcelPrice"("originCountryId");

-- CreateIndex
CREATE INDEX "ParcelPrice_destinationCountryId_idx" ON "ParcelPrice"("destinationCountryId");

-- CreateIndex
CREATE INDEX "ParcelPriceDiscount_parcelPriceId_idx" ON "ParcelPriceDiscount"("parcelPriceId");

-- CreateIndex
CREATE INDEX "ParcelPriceDiscount_discountId_idx" ON "ParcelPriceDiscount"("discountId");

-- CreateIndex
CREATE INDEX "Discount_businessId_idx" ON "Discount"("businessId");

-- CreateIndex
CREATE INDEX "Discount_isActive_idx" ON "Discount"("isActive");

-- CreateIndex
CREATE INDEX "Discount_isDeleted_idx" ON "Discount"("isDeleted");

-- CreateIndex
CREATE INDEX "Discount_parcelType_idx" ON "Discount"("parcelType");

-- CreateIndex
CREATE INDEX "Discount_originCountryId_idx" ON "Discount"("originCountryId");

-- CreateIndex
CREATE INDEX "Discount_destinationCountryId_idx" ON "Discount"("destinationCountryId");

-- CreateIndex
CREATE INDEX "Discount_createdAt_idx" ON "Discount"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_businessId_code_key" ON "Discount"("businessId", "code");

-- CreateIndex
CREATE INDEX "AuthProfile_userId_idx" ON "AuthProfile"("userId");

-- CreateIndex
CREATE INDEX "AuthProfile_email_idx" ON "AuthProfile"("email");

-- CreateIndex
CREATE INDEX "AuthProfile_phone_idx" ON "AuthProfile"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProfile_provider_providerId_key" ON "AuthProfile"("provider", "providerId");

-- CreateIndex
CREATE INDEX "CustomerProfile_businessId_idx" ON "CustomerProfile"("businessId");

-- CreateIndex
CREATE INDEX "CustomerProfile_email_idx" ON "CustomerProfile"("email");

-- CreateIndex
CREATE INDEX "Parcel_selectedPriceId_idx" ON "Parcel"("selectedPriceId");

-- CreateIndex
CREATE INDEX "Parcel_businessId_idx" ON "Parcel"("businessId");

-- CreateIndex
CREATE INDEX "Parcel_senderId_idx" ON "Parcel"("senderId");

-- CreateIndex
CREATE INDEX "Parcel_recipientId_idx" ON "Parcel"("recipientId");

-- CreateIndex
CREATE INDEX "Parcel_parcelType_idx" ON "Parcel"("parcelType");

-- CreateIndex
CREATE INDEX "Parcel_deliveryStatus_idx" ON "Parcel"("deliveryStatus");

-- CreateIndex
CREATE INDEX "Parcel_paymentStatus_idx" ON "Parcel"("paymentStatus");

-- CreateIndex
CREATE INDEX "Parcel_createdAt_idx" ON "Parcel"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_businessId_trackingNumber_key" ON "Parcel"("businessId", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Phone_countryCode_number_key" ON "Phone"("countryCode", "number");

-- CreateIndex
CREATE INDEX "PickupRequest_status_idx" ON "PickupRequest"("status");

-- CreateIndex
CREATE INDEX "PickupRequest_createdAt_idx" ON "PickupRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Tariff_isDeleted_idx" ON "Tariff"("isDeleted");

-- CreateIndex
CREATE INDEX "Tariff_parcelType_idx" ON "Tariff"("parcelType");

-- CreateIndex
CREATE INDEX "Tariff_originCountryId_idx" ON "Tariff"("originCountryId");

-- CreateIndex
CREATE INDEX "Tariff_destinationCountryId_idx" ON "Tariff"("destinationCountryId");

-- CreateIndex
CREATE INDEX "Tariff_priority_idx" ON "Tariff"("priority");

-- CreateIndex
CREATE INDEX "Tariff_createdAt_idx" ON "Tariff"("createdAt");

-- CreateIndex
CREATE INDEX "User_customerProfileId_idx" ON "User"("customerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "User_businessId_email_key" ON "User"("businessId", "email");

-- AddForeignKey
ALTER TABLE "AuthProfile" ADD CONSTRAINT "AuthProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_selectedPriceId_fkey" FOREIGN KEY ("selectedPriceId") REFERENCES "ParcelPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_destinationCountryId_fkey" FOREIGN KEY ("destinationCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPrice" ADD CONSTRAINT "ParcelPrice_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPrice" ADD CONSTRAINT "ParcelPrice_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPriceDiscount" ADD CONSTRAINT "ParcelPriceDiscount_parcelPriceId_fkey" FOREIGN KEY ("parcelPriceId") REFERENCES "ParcelPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelPriceDiscount" ADD CONSTRAINT "ParcelPriceDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_originCountryId_fkey" FOREIGN KEY ("originCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_destinationCountryId_fkey" FOREIGN KEY ("destinationCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
