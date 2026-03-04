/*
  Warnings:

  - The values [FATAL,ERROR,WARN,INFO,VERBOSE,DEBUG] on the enum `LogLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LogLevel_new" AS ENUM ('fatal', 'error', 'warn', 'info', 'verbose', 'debug');
ALTER TYPE "LogLevel" RENAME TO "LogLevel_old";
ALTER TYPE "LogLevel_new" RENAME TO "LogLevel";
DROP TYPE "public"."LogLevel_old";
COMMIT;
