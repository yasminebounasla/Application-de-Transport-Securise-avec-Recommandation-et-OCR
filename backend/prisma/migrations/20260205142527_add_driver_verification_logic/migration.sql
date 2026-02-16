/*
  Warnings:

  - You are about to drop the column `permisNum` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `selfieUrl` on the `Driver` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "permisNum",
DROP COLUMN "selfieUrl",
ADD COLUMN     "hasAcceptedPhotoStorage" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Verification" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "selfieImage" BYTEA NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "licenseQuality" INTEGER,
    "selfieQuality" INTEGER,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "ninEncrypted" VARCHAR(500) NOT NULL,
    "permisImage" BYTEA NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "ocrConfidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Verification_driverId_key" ON "Verification"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "License_driverId_key" ON "License"("driverId");

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
