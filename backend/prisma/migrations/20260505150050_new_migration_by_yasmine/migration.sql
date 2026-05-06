/*
  Warnings:

  - You are about to drop the column `car_big` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `pets_allowed` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `radio_on` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `smoking_allowed` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `talkative` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `works_afternoon` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `works_evening` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `works_morning` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `works_night` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `female_driver_pref` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `luggage_large` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `pets_ok` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `quiet_ride` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `radio_ok` on the `Trajet` table. All the data in the column will be lost.
  - You are about to drop the column `smoking_ok` on the `Trajet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "car_big",
DROP COLUMN "pets_allowed",
DROP COLUMN "radio_on",
DROP COLUMN "smoking_allowed",
DROP COLUMN "talkative",
DROP COLUMN "works_afternoon",
DROP COLUMN "works_evening",
DROP COLUMN "works_morning",
DROP COLUMN "works_night",
ALTER COLUMN "sexe" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Trajet" DROP COLUMN "female_driver_pref",
DROP COLUMN "luggage_large",
DROP COLUMN "pets_ok",
DROP COLUMN "quiet_ride",
DROP COLUMN "radio_ok",
DROP COLUMN "smoking_ok";

-- CreateTable
CREATE TABLE "WorkingHours" (
    "id" SERIAL NOT NULL,
    "works_morning" BOOLEAN NOT NULL DEFAULT false,
    "works_afternoon" BOOLEAN NOT NULL DEFAULT false,
    "works_evening" BOOLEAN NOT NULL DEFAULT false,
    "works_night" BOOLEAN NOT NULL DEFAULT false,
    "driverId" INTEGER NOT NULL,

    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preferences" (
    "id" SERIAL NOT NULL,
    "talkative" BOOLEAN NOT NULL DEFAULT false,
    "radio" BOOLEAN NOT NULL DEFAULT false,
    "smoking" BOOLEAN NOT NULL DEFAULT false,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "luggage_large" BOOLEAN NOT NULL DEFAULT false,
    "femal_driver_pref" BOOLEAN NOT NULL DEFAULT false,
    "driverId" INTEGER,
    "trajetId" INTEGER,

    CONSTRAINT "Preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHours_driverId_key" ON "WorkingHours"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Preferences_driverId_key" ON "Preferences"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Preferences_trajetId_key" ON "Preferences"("trajetId");

-- AddForeignKey
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preferences" ADD CONSTRAINT "Preferences_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preferences" ADD CONSTRAINT "Preferences_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
