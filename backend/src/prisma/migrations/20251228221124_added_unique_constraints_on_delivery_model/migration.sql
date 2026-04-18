/*
  Warnings:

  - A unique constraint covering the columns `[gateway_message_id]` on the table `deliveries` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "deliveries_gateway_message_id_key" ON "deliveries"("gateway_message_id");
