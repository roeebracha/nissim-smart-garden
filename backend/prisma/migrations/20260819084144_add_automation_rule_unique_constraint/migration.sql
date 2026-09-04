/*
  Warnings:

  - A unique constraint covering the columns `[planterId,sensorType,actuatorType]` on the table `automation_rules` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_planterId_sensorType_actuatorType_key" ON "automation_rules"("planterId", "sensorType", "actuatorType");
