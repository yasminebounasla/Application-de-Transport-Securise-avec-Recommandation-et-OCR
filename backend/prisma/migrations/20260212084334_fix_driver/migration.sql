/*
  Warnings:

  - You are about to drop the column `note` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `ratingsCount` on the `Trajet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "note",
ADD COLUMN     "ratingsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Trajet" DROP COLUMN "ratingsCount";
