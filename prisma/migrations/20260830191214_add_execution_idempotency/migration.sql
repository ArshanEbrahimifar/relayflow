/*
  Warnings:

  - A unique constraint covering the columns `[workflowId,idempotencyKey]` on the table `Execution` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Execution_workflowId_idempotencyKey_key" ON "Execution"("workflowId", "idempotencyKey");
