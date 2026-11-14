-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('ENTRY', 'EXIT', 'SURVEILLANCE');

-- CreateEnum
CREATE TYPE "CameraSourceType" AS ENUM ('USB', 'RTSP', 'ONVIF', 'VIDEO_FILE', 'ANDROID_PHONE', 'MOCK_SYNTHETIC');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "JourneyState" AS ENUM ('WAITING', 'DISPATCHED', 'ON_ROUTE', 'ARRIVED', 'READY_FOR_RETURN');

-- CreateEnum
CREATE TYPE "QueueEntryType" AS ENUM ('AUTO_RECOGNIZED', 'MANUAL', 'VIOLATION');

-- CreateEnum
CREATE TYPE "RecognitionProcessingResult" AS ENUM ('ACCEPTED', 'DUPLICATE', 'UNKNOWN', 'LOW_CONFIDENCE', 'NOT_ASSIGNED', 'UNAUTHORIZED_TERMINAL', 'SUSPENDED');

-- AlterTable
ALTER TABLE "DispatchRecord" ADD COLUMN     "departureConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exitRecognitionEventId" TEXT;

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "cameraId" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "entryType" "QueueEntryType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "recognitionEventId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "journeyState" "JourneyState" NOT NULL DEFAULT 'WAITING';

-- CreateTable
CREATE TABLE "CameraDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "gateName" TEXT NOT NULL,
    "cameraType" "CameraType" NOT NULL DEFAULT 'ENTRY',
    "sourceType" "CameraSourceType" NOT NULL DEFAULT 'RTSP',
    "sourceAddress" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastHeartbeat" TIMESTAMP(3),
    "recognitionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecognitionEvent" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "cameraType" "CameraType" NOT NULL DEFAULT 'ENTRY',
    "plateNumber" TEXT NOT NULL,
    "rawPlateNumber" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagePath" TEXT,
    "processingResult" "RecognitionProcessingResult" NOT NULL DEFAULT 'ACCEPTED',
    "vehicleId" TEXT,
    "queueEntryId" TEXT,
    "violationId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecognitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecognitionConfiguration" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "minConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "autoQueueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "violationOnUnassigned" BOOLEAN NOT NULL DEFAULT true,
    "duplicateWindowSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecognitionConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraHeartbeat" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,

    CONSTRAINT "CameraHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CameraDevice_code_key" ON "CameraDevice"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RecognitionConfiguration_terminalId_key" ON "RecognitionConfiguration"("terminalId");

-- AddForeignKey
ALTER TABLE "CameraDevice" ADD CONSTRAINT "CameraDevice_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecognitionEvent" ADD CONSTRAINT "RecognitionEvent_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "CameraDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecognitionEvent" ADD CONSTRAINT "RecognitionEvent_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecognitionEvent" ADD CONSTRAINT "RecognitionEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraHeartbeat" ADD CONSTRAINT "CameraHeartbeat_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "CameraDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
