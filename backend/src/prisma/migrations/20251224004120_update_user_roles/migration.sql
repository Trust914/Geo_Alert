-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_must_change_password_idx" ON "users"("must_change_password");
