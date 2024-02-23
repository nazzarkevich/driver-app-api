/*
  Warnings:

  - The values [Subscriber] on the enum `UserType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserType_new" AS ENUM ('Moderator', 'Customer', 'Manager', 'Member', 'InternationalDriver', 'ParcelCourier');
ALTER TABLE "User" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "type" TYPE "UserType_new" USING ("type"::text::"UserType_new");
ALTER TYPE "UserType" RENAME TO "UserType_old";
ALTER TYPE "UserType_new" RENAME TO "UserType";
DROP TYPE "UserType_old";
ALTER TABLE "User" ALTER COLUMN "type" SET DEFAULT 'Member';
COMMIT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "type" SET DEFAULT 'Member';
