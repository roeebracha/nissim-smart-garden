-- CreateEnum
CREATE TYPE "DecisionSource" AS ENUM ('manual', 'rule', 'ml');

-- CreateTable
CREATE TABLE "planters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "planters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planterId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" SERIAL NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sensorId" INTEGER NOT NULL,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuators" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "desiredState" TEXT NOT NULL,
    "desiredSince" TIMESTAMP(3) NOT NULL,
    "reportedState" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "planterId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "actuators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuator_events" (
    "id" SERIAL NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionSource" "DecisionSource" NOT NULL,
    "actuatorId" INTEGER NOT NULL,

    CONSTRAINT "actuator_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sensorType" TEXT NOT NULL,
    "actuatorType" TEXT NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "planterId" INTEGER NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_insights" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planterId" INTEGER,

    CONSTRAINT "llm_insights_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "planters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuators" ADD CONSTRAINT "actuators_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "planters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuators" ADD CONSTRAINT "actuators_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuator_events" ADD CONSTRAINT "actuator_events_actuatorId_fkey" FOREIGN KEY ("actuatorId") REFERENCES "actuators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "planters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_insights" ADD CONSTRAINT "llm_insights_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "planters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
