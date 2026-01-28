-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "numTel" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "numTel" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "age" INTEGER NOT NULL,
    "carteIdNum" TEXT NOT NULL,
    "selfieUrl" TEXT,
    "fumeur" BOOLEAN NOT NULL,
    "note" DOUBLE PRECISION,
    "preference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
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
CREATE TABLE "Trajet" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "passagerId" TEXT,
    "depart" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT,
    "placesDispo" INTEGER NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
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
CREATE INDEX "Trajet_driverId_idx" ON "Trajet"("driverId");

-- CreateIndex
CREATE INDEX "Trajet_passagerId_idx" ON "Trajet"("passagerId");

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_passagerId_fkey" FOREIGN KEY ("passagerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
