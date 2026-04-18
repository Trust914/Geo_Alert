/*
  Warnings:

  - Changed the type of `entity_type` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('AGENCY', 'USER', 'CITIZEN', 'ALERT', 'ALERT_TARGET', 'DELIVERED_ALERT', 'STATE', 'LGA', 'WARD', 'SYSTEM');

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entity_type",
ADD COLUMN     "entity_type" "EntityType" NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
