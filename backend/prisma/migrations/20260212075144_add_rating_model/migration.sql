/*
  Warnings:

  - You are about to drop the column `rating` on the `Trajet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Trajet" DROP COLUMN "rating";

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

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
