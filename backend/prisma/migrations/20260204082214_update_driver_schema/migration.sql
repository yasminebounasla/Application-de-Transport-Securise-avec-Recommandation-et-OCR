/*
  Warnings:

  - You are about to drop the column `preference` on the `Driver` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "preference",
ADD COLUMN     "car_big" BOOLEAN,
ADD COLUMN     "pets_allowed" BOOLEAN,
ADD COLUMN     "radio_on" BOOLEAN,
ADD COLUMN     "smoking_allowed" BOOLEAN,
ADD COLUMN     "talkative" BOOLEAN,
ADD COLUMN     "works_afternoon" BOOLEAN,
ADD COLUMN     "works_evening" BOOLEAN,
ADD COLUMN     "works_morning" BOOLEAN,
ADD COLUMN     "works_night" BOOLEAN,
ALTER COLUMN "fumeur" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Passenger" ADD COLUMN     "female_driver_pref" BOOLEAN,
ADD COLUMN     "luggage_large" BOOLEAN,
ADD COLUMN     "pets_ok" BOOLEAN,
ADD COLUMN     "quiet_ride" BOOLEAN,
ADD COLUMN     "radio_ok" BOOLEAN,
ADD COLUMN     "smoking_ok" BOOLEAN;
