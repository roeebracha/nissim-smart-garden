-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending');

-- AlterTable
ALTER TABLE "llm_insights" ADD COLUMN     "trace" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "suggestions" (
    "id" SERIAL NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "planterId" INTEGER NOT NULL,
    "sensorType" TEXT NOT NULL,
    "actuatorType" TEXT NOT NULL,
    "onThreshold" DOUBLE PRECISION NOT NULL,
    "offThreshold" DOUBLE PRECISION NOT NULL,
    "operator" "ThresholdOperator" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "planters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
