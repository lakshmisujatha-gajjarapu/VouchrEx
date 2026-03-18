ALTER TABLE "Brand"
ADD COLUMN "normalizedName" TEXT;

UPDATE "Brand"
SET "normalizedName" = lower(trim(regexp_replace("name", '\s+', ' ', 'g')));

ALTER TABLE "Brand"
ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "Brand"("normalizedName");
