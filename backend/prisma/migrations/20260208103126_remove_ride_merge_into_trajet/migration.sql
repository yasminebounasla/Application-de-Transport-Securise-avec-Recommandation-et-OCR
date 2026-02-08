/*
  Warnings:

  - You are about to drop the column `depart` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the `Ride` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endAddress` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endLat` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endLng` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startAddress` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLat` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLng` to the `Trajet` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TrajetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Ride" DROP CONSTRAINT "Ride_passengerId_fkey";

-- AlterTable
ALTER TABLE "Trajet" DROP COLUMN "depart",
DROP COLUMN "destination",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "endAddress" TEXT NOT NULL,
ADD COLUMN     "endLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "endLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "noPets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noSmoking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quiet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "startAddress" TEXT NOT NULL,
ADD COLUMN     "startLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "startLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "status" "TrajetStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "Ride";

-- DropEnum
DROP TYPE "RideStatus";

-- CreateIndex
CREATE INDEX "Trajet_status_idx" ON "Trajet"("status");
