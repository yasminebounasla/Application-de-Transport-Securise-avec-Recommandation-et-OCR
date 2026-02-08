-- CreateEnum
CREATE TYPE "TrajetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Passenger" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "numTel" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quiet_ride" BOOLEAN,
    "radio_ok" BOOLEAN,
    "smoking_ok" BOOLEAN,
    "pets_ok" BOOLEAN,
    "luggage_large" BOOLEAN,
    "female_driver_pref" BOOLEAN,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "numTel" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER NOT NULL,
    "hasAcceptedPhotoStorage" BOOLEAN NOT NULL DEFAULT false,
    "fumeur" BOOLEAN,
    "talkative" BOOLEAN,
    "radio_on" BOOLEAN,
    "smoking_allowed" BOOLEAN,
    "pets_allowed" BOOLEAN,
    "car_big" BOOLEAN,
    "works_morning" BOOLEAN,
    "works_afternoon" BOOLEAN,
    "works_evening" BOOLEAN,
    "works_night" BOOLEAN,
    "note" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT,
    "annee" INTEGER,
    "nbPlaces" INTEGER,
    "plaque" TEXT,
    "couleur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Trajet" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "passagerId" INTEGER,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "startAddress" TEXT NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "endAddress" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT,
    "placesDispo" INTEGER NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "status" "TrajetStatus" NOT NULL DEFAULT 'PENDING',
    "rating" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trajet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_email_key" ON "Passenger"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE INDEX "Vehicule_driverId_idx" ON "Vehicule"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_driverId_key" ON "Verification"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "License_driverId_key" ON "License"("driverId");

-- CreateIndex
CREATE INDEX "Trajet_driverId_idx" ON "Trajet"("driverId");

-- CreateIndex
CREATE INDEX "Trajet_passagerId_idx" ON "Trajet"("passagerId");

-- CreateIndex
CREATE INDEX "Trajet_status_idx" ON "Trajet"("status");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_passagerId_fkey" FOREIGN KEY ("passagerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
