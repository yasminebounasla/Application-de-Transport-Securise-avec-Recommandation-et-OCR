/*
  Warnings:

  - The primary key for the `Driver` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Driver` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Passenger` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Passenger` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Trajet` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Trajet` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `passagerId` column on the `Trajet` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Vehicule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Vehicule` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `driverId` on the `Trajet` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `driverId` on the `Vehicule` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Trajet" DROP CONSTRAINT "Trajet_driverId_fkey";

-- DropForeignKey
ALTER TABLE "Trajet" DROP CONSTRAINT "Trajet_passagerId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicule" DROP CONSTRAINT "Vehicule_driverId_fkey";

-- AlterTable
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Driver_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Passenger" DROP CONSTRAINT "Passenger_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Trajet" DROP CONSTRAINT "Trajet_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "driverId",
ADD COLUMN     "driverId" INTEGER NOT NULL,
DROP COLUMN "passagerId",
ADD COLUMN     "passagerId" INTEGER,
ADD CONSTRAINT "Trajet_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Vehicule" DROP CONSTRAINT "Vehicule_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "driverId",
ADD COLUMN     "driverId" INTEGER NOT NULL,
ADD CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Trajet_driverId_idx" ON "Trajet"("driverId");

-- CreateIndex
CREATE INDEX "Trajet_passagerId_idx" ON "Trajet"("passagerId");

-- CreateIndex
CREATE INDEX "Vehicule_driverId_idx" ON "Vehicule"("driverId");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_passagerId_fkey" FOREIGN KEY ("passagerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
