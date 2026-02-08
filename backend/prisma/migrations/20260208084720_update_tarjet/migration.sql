/*
  Warnings:

  - The values [CANCELLED] on the enum `RideStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RideStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER');
ALTER TABLE "Ride" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trajet" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trajet" ALTER COLUMN "status" TYPE "RideStatus_new" USING ("status"::text::"RideStatus_new");
ALTER TABLE "Ride" ALTER COLUMN "status" TYPE "RideStatus_new" USING ("status"::text::"RideStatus_new");
ALTER TYPE "RideStatus" RENAME TO "RideStatus_old";
ALTER TYPE "RideStatus_new" RENAME TO "RideStatus";
DROP TYPE "RideStatus_old";
ALTER TABLE "Ride" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "Trajet" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
