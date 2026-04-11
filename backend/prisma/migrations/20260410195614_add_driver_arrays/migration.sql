/*
  Warnings:

  - You are about to drop the column `rejectedDriverIds` on the `Evaluation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "rejectedDriverIds";

-- AlterTable
ALTER TABLE "Trajet" ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "fallbackStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mlScores" JSONB,
ADD COLUMN     "recommendedDrivers" JSONB,
ADD COLUMN     "sentDrivers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "timedOutDriverIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
