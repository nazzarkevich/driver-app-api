ALTER TABLE "CustomerNovaPostAddress" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "customer_nova_post_lifecycle_idx" ON "CustomerNovaPostAddress"("customerProfileId", "archivedAt", "isDefault");
