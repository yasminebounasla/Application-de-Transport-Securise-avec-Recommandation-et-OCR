-- DropForeignKey
ALTER TABLE "Trajet" DROP CONSTRAINT "Trajet_driverId_fkey";

-- AlterTable
ALTER TABLE "Trajet" ALTER COLUMN "driverId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
