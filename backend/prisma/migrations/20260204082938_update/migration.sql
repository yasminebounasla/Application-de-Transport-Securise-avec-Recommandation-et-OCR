/*
  Warnings:

  - You are about to drop the column `carteIdNum` on the `Driver` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "carteIdNum",
ADD COLUMN     "permisNum" TEXT;
