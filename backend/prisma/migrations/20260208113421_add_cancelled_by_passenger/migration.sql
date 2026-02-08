/*
  Warnings:

  - The values [CANCELLED] on the enum `TrajetStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TrajetStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER');
ALTER TABLE "Trajet" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trajet" ALTER COLUMN "status" TYPE "TrajetStatus_new" USING ("status"::text::"TrajetStatus_new");
ALTER TYPE "TrajetStatus" RENAME TO "TrajetStatus_old";
ALTER TYPE "TrajetStatus_new" RENAME TO "TrajetStatus";
DROP TYPE "TrajetStatus_old";
ALTER TABLE "Trajet" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
