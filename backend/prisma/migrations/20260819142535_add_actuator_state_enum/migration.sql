/*
  Warnings:

  - Changed the type of `desiredState` on the `actuators` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reportedState` on the `actuators` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ActuatorState" AS ENUM ('on', 'off');

-- AlterTable
ALTER TABLE "actuators" DROP COLUMN "desiredState",
ADD COLUMN     "desiredState" "ActuatorState" NOT NULL,
DROP COLUMN "reportedState",
ADD COLUMN     "reportedState" "ActuatorState" NOT NULL;
