/*
  Warnings:

  - You are about to drop the column `route` on the `CourierJourney` table. All the data in the column will be lost.
  - Added the required column `destination` to the `CourierJourney` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CourierJourney" DROP COLUMN "route",
ADD COLUMN     "destination" TEXT NOT NULL;
