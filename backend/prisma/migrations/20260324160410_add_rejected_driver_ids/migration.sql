-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "workZoneAddress" TEXT;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "rejectedDriverIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Trajet" ADD COLUMN     "notifiedDriversCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectedDriverIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
