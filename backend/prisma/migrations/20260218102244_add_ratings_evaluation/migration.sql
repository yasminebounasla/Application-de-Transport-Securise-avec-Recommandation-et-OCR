/*
  Warnings:

  - You are about to drop the column `note` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `depart` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `Trajet` table. All the data in the column will be lost.
  - Added the required column `endAddress` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endLat` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endLng` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startAddress` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLat` to the `Trajet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startLng` to the `Trajet` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TrajetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER');

-- DropForeignKey
ALTER TABLE "Trajet" DROP CONSTRAINT "Trajet_driverId_fkey";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "note",
ADD COLUMN     "avgRating" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "ratingsCount" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Trajet" DROP COLUMN "depart",
DROP COLUMN "destination",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "endAddress" TEXT NOT NULL,
ADD COLUMN     "endLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "endLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "rating" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "startAddress" TEXT NOT NULL,
ADD COLUMN     "startLat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "startLng" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "status" "TrajetStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "driverId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" SERIAL NOT NULL,
    "trajetId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_trajetId_key" ON "Evaluation"("trajetId");

-- CreateIndex
CREATE INDEX "Trajet_status_idx" ON "Trajet"("status");

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
