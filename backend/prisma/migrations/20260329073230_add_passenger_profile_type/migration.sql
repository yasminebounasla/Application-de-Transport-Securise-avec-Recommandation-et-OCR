-- AlterTable
ALTER TABLE "Passenger" ADD COLUMN     "profile_type" TEXT DEFAULT 'neutral';

-- AlterTable
ALTER TABLE "Trajet" ADD COLUMN     "fallbackStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mlScores" JSONB,
ADD COLUMN     "notifiedDriversCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recommendedDrivers" JSONB,
ADD COLUMN     "rejectedDriverIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "sentDrivers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "timedOutDriverIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
