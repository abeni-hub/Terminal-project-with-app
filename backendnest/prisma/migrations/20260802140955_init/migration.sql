-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');

-- CreateEnum
CREATE TYPE "TerminalStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PLANNED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('IDLE', 'WAITING', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BUS', 'MINIBUS', 'COASTER', 'TRUCK');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'DISPATCHED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'OFFLINE');

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "terminalId" TEXT,
    "avatarColor" TEXT DEFAULT '#3B82F6',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TerminalStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "originTerminalId" TEXT NOT NULL,
    "destinationTerminalId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "VehicleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'IDLE',
    "groupId" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "lastMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAssignment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "vehicleGroupId" TEXT NOT NULL,
    "originTerminalId" TEXT NOT NULL,
    "destinationTerminalId" TEXT NOT NULL,
    "dispatcherIds" TEXT[],
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleGroupName" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "terminalName" TEXT NOT NULL,
    "destinationTerminalName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedBy" TEXT,
    "isViolation" BOOLEAN NOT NULL DEFAULT false,
    "violationRemark" TEXT,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleGroupId" TEXT NOT NULL,
    "vehicleGroupName" TEXT NOT NULL,
    "originTerminalId" TEXT NOT NULL,
    "originTerminalName" TEXT NOT NULL,
    "destinationTerminalId" TEXT NOT NULL,
    "destinationTerminalName" TEXT NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "dispatcherName" TEXT NOT NULL,
    "dispatchTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuePosition" INTEGER NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "feeRuleId" TEXT NOT NULL,
    "deviceId" TEXT,
    "auditRef" TEXT NOT NULL,

    CONSTRAINT "DispatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchFeeRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "vehicleType" "VehicleType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Violation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "assignmentId" TEXT,
    "routeId" TEXT,
    "terminalId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ViolationStatus" NOT NULL DEFAULT 'OPEN',
    "reportedBy" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "Violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "assignmentId" TEXT,
    "status" "OverrideStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "auditRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "terminalId" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "appVersion" TEXT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_code_key" ON "Terminal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_key" ON "Route"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_originTerminalId_fkey" FOREIGN KEY ("originTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationTerminalId_fkey" FOREIGN KEY ("destinationTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VehicleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAssignment" ADD CONSTRAINT "WeeklyAssignment_vehicleGroupId_fkey" FOREIGN KEY ("vehicleGroupId") REFERENCES "VehicleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAssignment" ADD CONSTRAINT "WeeklyAssignment_originTerminalId_fkey" FOREIGN KEY ("originTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAssignment" ADD CONSTRAINT "WeeklyAssignment_destinationTerminalId_fkey" FOREIGN KEY ("destinationTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WeeklyAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
