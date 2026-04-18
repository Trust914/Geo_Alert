-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('NONE', 'GOOGLE_AUTHENTICATOR', 'EMAIL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorBackupCodes" TEXT[],
ADD COLUMN     "twoFactorMethod" "TwoFactorMethod" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "twoFactorSecret" TEXT;
