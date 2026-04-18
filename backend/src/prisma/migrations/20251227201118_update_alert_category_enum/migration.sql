/*
  Warnings:

  - The values [WEATHER,FLOOD,DISASTER,TRAFFIC] on the enum `AlertCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AlertCategory_new" AS ENUM ('GEO', 'MET', 'SAFETY', 'SECURITY', 'RESCUE', 'FIRE', 'HEALTH', 'ENV', 'TRANSPORT', 'INFRA', 'CBRNE', 'OTHER');
ALTER TABLE "alerts" ALTER COLUMN "category" TYPE "AlertCategory_new" USING ("category"::text::"AlertCategory_new");
ALTER TYPE "AlertCategory" RENAME TO "AlertCategory_old";
ALTER TYPE "AlertCategory_new" RENAME TO "AlertCategory";
DROP TYPE "public"."AlertCategory_old";
COMMIT;
