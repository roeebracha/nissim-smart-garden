/*
  Warnings:

  - You are about to drop the column `thresholdValue` on the `automation_rules` table. All the data in the column will be lost.
  - Added the required column `offThreshold` to the `automation_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `onThreshold` to the `automation_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operator` to the `automation_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `automation_rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `automation_rules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ThresholdOperator" AS ENUM ('less_than', 'greater_than');

-- CreateEnum
CREATE TYPE "ThresholdSource" AS ENUM ('seed', 'ml');

-- AlterTable
ALTER TABLE "automation_rules" DROP COLUMN "thresholdValue",
ADD COLUMN     "offThreshold" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "onThreshold" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "operator" "ThresholdOperator" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" "ThresholdSource" NOT NULL;
