-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "cancel_reason" TEXT;

--  CHECK Constraint ensures cancel_reason is NULL unless status is 'CANCELLED'
ALTER TABLE "alerts"
ADD CONSTRAINT "check_cancel_reason_validity"
CHECK ((status = 'CANCELLED') OR (cancel_reason IS NULL));