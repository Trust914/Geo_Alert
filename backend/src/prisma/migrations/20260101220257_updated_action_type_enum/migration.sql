-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'TWO_FA_ENABLED';
ALTER TYPE "ActionType" ADD VALUE 'TWO_FA_DISABLED';
ALTER TYPE "ActionType" ADD VALUE 'BACKUP_CODE_USED';
ALTER TYPE "ActionType" ADD VALUE 'TWO_FA_METHOD_CHANGED';
