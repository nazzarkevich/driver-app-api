-- Keep existing pickup identities intact; do not infer historical staff pickups.
ALTER TABLE "Parcel" ADD COLUMN "pickedUpByUserId" INTEGER;
CREATE INDEX "Parcel_pickedUpByUserId_idx" ON "Parcel"("pickedUpByUserId");
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_pickedUpByUserId_fkey" FOREIGN KEY ("pickedUpByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
