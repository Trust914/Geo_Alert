/*
  Warnings:

  - Added the required column `created_by_id` to the `agencies` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_created_by_user_id_fkey";

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "created_by_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "agencies_created_by_id_idx" ON "agencies"("created_by_id");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
