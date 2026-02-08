-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RideStatus" ADD VALUE 'CANCELLED_BY_PASSENGER';
ALTER TYPE "RideStatus" ADD VALUE 'CANCELLED_BY_DRIVER';

-- AlterTable
ALTER TABLE "Trajet" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "status" "RideStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Trajet_status_idx" ON "Trajet"("status");
