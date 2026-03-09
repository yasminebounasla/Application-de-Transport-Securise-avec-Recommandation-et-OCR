-- Safe migration rewrite:
-- Keep this migration compatible with the previous one that already created
-- TrajetStatus, Evaluation, avgRating, ratingsCount and base Trajet fields.

-- Make driver optional on Trajet (required by current app flow).
ALTER TABLE "Trajet"
  ALTER COLUMN "driverId" DROP NOT NULL;

-- Ensure completion timestamp exists.
ALTER TABLE "Trajet"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Ensure GPS/address columns exist (nullable; app fills them on create).
ALTER TABLE "Trajet"
  ADD COLUMN IF NOT EXISTS "startLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "startLng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "startAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "endLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "endLng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "endAddress" TEXT;

-- Helpful status index for activity screens.
CREATE INDEX IF NOT EXISTS "Trajet_status_idx" ON "Trajet"("status");
