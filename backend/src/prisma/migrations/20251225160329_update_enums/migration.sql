/*
  Warnings:

  - The values [OTHER] on the enum `AlertCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('FATAL', 'ERROR', 'WARN', 'INFO', 'VERBOSE', 'DEBUG');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgencyType" ADD VALUE 'EMERGENCY';
ALTER TYPE "AgencyType" ADD VALUE 'HEALTH';
ALTER TYPE "AgencyType" ADD VALUE 'SECURITY';

-- AlterEnum
BEGIN;
CREATE TYPE "AlertCategory_new" AS ENUM ('WEATHER', 'SECURITY', 'HEALTH', 'SAFETY', 'FIRE', 'FLOOD', 'DISASTER', 'TRAFFIC');
ALTER TABLE "alerts" ALTER COLUMN "category" TYPE "AlertCategory_new" USING ("category"::text::"AlertCategory_new");
ALTER TYPE "AlertCategory" RENAME TO "AlertCategory_old";
ALTER TYPE "AlertCategory_new" RENAME TO "AlertCategory";
DROP TYPE "public"."AlertCategory_old";
COMMIT;
