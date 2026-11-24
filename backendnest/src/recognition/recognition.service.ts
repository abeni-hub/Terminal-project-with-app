import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcessRecognitionDto, AssignUnknownPlateDto } from './dto/process-recognition.dto';
import { PlateNormalizer } from './plate-normalizer.util';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private mapEvent(e: any) {
    return {
      id: e.id,
      cameraId: e.cameraId,
      cameraName: e.camera?.name || '',
      cameraCode: e.camera?.code || '',
      terminalId: e.terminalId,
      terminalName: e.terminal?.name || '',
      cameraType: e.cameraType,
      plateNumber: e.plateNumber,
      rawPlateNumber: e.rawPlateNumber || e.plateNumber,
      confidence: e.confidence,
      capturedAt: e.capturedAt.toISOString(),
      imagePath: e.imagePath || null,
      processingResult: e.processingResult,
      vehicleId: e.vehicleId || null,
      queueEntryId: e.queueEntryId || null,
      violationId: e.violationId || null,
      remarks: e.remarks || null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async processRecognition(dto: ProcessRecognitionDto) {
    const rawPlate = dto.plateNumber;
    const normalizedPlate = PlateNormalizer.normalize(rawPlate);
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();

    this.logger.log(`Processing ALPR event: raw="${rawPlate}", normalized="${normalizedPlate}", camera="${dto.cameraId}"`);

    // 1. Lookup Camera
    const camera = await this.prisma.cameraDevice.findFirst({
      where: {
        OR: [{ id: dto.cameraId }, { code: dto.cameraId }],
      },
      include: { terminal: true },
    });

    const terminalId = camera ? camera.terminalId : dto.terminalId;
    const terminal = await this.prisma.terminal.findUnique({ where: { id: terminalId } });

    if (!camera) {
      this.logger.warn(`Camera ID ${dto.cameraId} not registered in DB`);
    } else if (!camera.recognitionEnabled) {
      this.logger.log(`Camera ${camera.name} has recognition disabled.`);
      return {
        success: false,
        processingResult: 'DISABLED',
        message: 'Recognition disabled for this camera.',
      };
    }

    // Check terminal recognition config min confidence (default 0.40 to allow medium confidence scans)
    const config = await this.prisma.recognitionConfiguration.findUnique({ where: { terminalId } });
    const minConfidence = config ? config.minConfidenceThreshold : 0.40;

    if (dto.confidence < minConfidence) {
      const lowConfEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: dto.cameraType || camera?.cameraType || 'ENTRY',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: 'LOW_CONFIDENCE',
          remarks: `Confidence (${(dto.confidence * 100).toFixed(1)}%) below minimum threshold (${(minConfidence * 100).toFixed(1)}%)`,
        },
        include: { camera: true, terminal: true },
      });

      const mapped = this.mapEvent(lowConfEvent);
      this.eventsGateway.emitRecognitionCaptured(mapped);

      return {
        success: false,
        processingResult: 'LOW_CONFIDENCE',
        event: mapped,
        message: `Low confidence recognition (${(dto.confidence * 100).toFixed(1)}%). Requires dispatcher review.`,
      };
    }

    // 2. Lookup Vehicle
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plateNumber: normalizedPlate },
      include: { group: true },
    });

    // CASE 3: Vehicle DOES NOT EXIST in Database
    if (!vehicle) {
      this.logger.warn(`Vehicle ${normalizedPlate} NOT found in database.`);
      const unknownEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: dto.cameraType || camera?.cameraType || 'ENTRY',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: 'UNKNOWN',
          remarks: 'Vehicle plate not registered in system.',
        },
        include: { camera: true, terminal: true },
      });

      const mapped = this.mapEvent(unknownEvent);
      this.eventsGateway.emitRecognitionCaptured(mapped);
      this.eventsGateway.emitUnknownVehicleAlert(mapped);

      return {
        success: true,
        processingResult: 'UNKNOWN',
        event: mapped,
        message: `Vehicle ${normalizedPlate} does not exist. Unknown vehicle alert triggered.`,
      };
    }

    // Check if vehicle is suspended
    if (vehicle.status === 'OFFLINE') {
      const suspendedEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: dto.cameraType || camera?.cameraType || 'ENTRY',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: 'SUSPENDED',
          vehicleId: vehicle.id,
          remarks: `Vehicle ${vehicle.plateNumber} status is OFFLINE/SUSPENDED.`,
        },
        include: { camera: true, terminal: true },
      });

      const mapped = this.mapEvent(suspendedEvent);
      this.eventsGateway.emitRecognitionCaptured(mapped);
      return {
        success: false,
        processingResult: 'SUSPENDED',
        event: mapped,
        message: `Vehicle ${normalizedPlate} is currently suspended/offline.`,
      };
    }

    // 3. EXIT CAMERA WORKFLOW
    // 3. EXIT CAMERA WORKFLOW
    if (dto.cameraType === 'EXIT' || camera?.cameraType === 'EXIT') {
      // Find active queue entry or recent dispatch for this vehicle
      const activeQueue = await this.prisma.queueEntry.findFirst({
        where: {
          vehicleId: vehicle.id,
          terminalId,
          status: { in: ['WAITING', 'LOADING', 'READY_TO_DEPART', 'DISPATCHED'] },
        },
        orderBy: { checkedInAt: 'desc' },
      });

      // Check if there is a recent authorized dispatch record awaiting exit
      const recentDispatchRecord = await this.prisma.dispatchRecord.findFirst({
        where: {
          vehicleId: vehicle.id,
          originTerminalId: terminalId,
          dispatchTime: { gte: new Date(Date.now() - 4 * 3600 * 1000) }, // within last 4 hours
        },
        orderBy: { dispatchTime: 'desc' },
      });

      const isAuthorizedDispatch = recentDispatchRecord && (activeQueue?.status === 'DISPATCHED' || !recentDispatchRecord.departureConfirmed);

      let violationId: string | null = null;
      let violationRemark: string | null = null;

      if (!isAuthorizedDispatch) {
        // UNAUTHORIZED DEPARTURE DETECTED
        this.logger.warn(`UNAUTHORIZED DEPARTURE detected for ${vehicle.plateNumber} at terminal ${terminalId}`);

        // Fetch fee rule for vehicle type
        const feeRule = await this.prisma.dispatchFeeRule.findFirst({
          where: { vehicleType: vehicle.type, active: true },
        });
        const originalDispatchFee = feeRule?.amount || 25.0;

        // Fetch penalty config
        const penaltyConfig = await this.prisma.penaltyConfiguration.findUnique({
          where: { id: 'default-penalty-config' },
        });

        let penaltyAmount = 50.0;
        if (penaltyConfig) {
          if (penaltyConfig.ruleType === 'FIXED_AMOUNT') {
            penaltyAmount = penaltyConfig.amount;
          } else if (penaltyConfig.ruleType === 'PERCENTAGE_OF_FEE') {
            penaltyAmount = Number((originalDispatchFee * (penaltyConfig.amount / 100)).toFixed(2));
          } else if (penaltyConfig.ruleType === 'FEE_MULTIPLIER') {
            penaltyAmount = Number((originalDispatchFee * penaltyConfig.amount).toFixed(2));
          }
        }
        const totalAmountDue = Number((originalDispatchFee + penaltyAmount).toFixed(2));

        // Create Violation record
        const violation = await this.prisma.violation.create({
          data: {
            vehicleId: vehicle.id,
            plateNumber: vehicle.plateNumber,
            terminalId,
            assignmentId: activeQueue?.assignmentId || null,
            type: 'UNAUTHORIZED_DEPARTURE',
            description: `Vehicle exited terminal without authorized dispatch or payment. Normal fee: ${originalDispatchFee} ETB + Penalty: ${penaltyAmount} ETB.`,
            severity: 'CRITICAL',
            status: 'PENALTY_APPLIED',
            reportedBy: 'SYSTEM_ANPR_EXIT',
            reportedAt: capturedAt,
            imagePath: dto.imagePath || null,
            queueEntryId: activeQueue?.id || null,
            originalDispatchFee,
            penaltyAmount,
            totalAmountDue,
            evidence: `Exit Camera (${camera?.code || dto.cameraId}) detected exit without valid dispatch record.`,
          },
        });
        violationId = violation.id;
        violationRemark = `Unauthorized departure violation created. Total charge: ${totalAmountDue} ETB.`;

        // Apply financial charges to vehicle financial account
        let vehicleAccount = await this.prisma.vehicleAccount.findUnique({ where: { vehicleId: vehicle.id } });
        if (!vehicleAccount) {
          vehicleAccount = await this.prisma.vehicleAccount.create({
            data: {
              vehicleId: vehicle.id,
              plateNumber: vehicle.plateNumber,
              balance: 0.0,
              status: 'ACTIVE',
            },
          });
        }

        const activeCard = await this.prisma.transportCard.findFirst({
          where: { vehicleId: vehicle.id, status: 'ACTIVE' },
        });

        const balanceBefore = vehicleAccount.balance;
        const balanceAfterFee = Number((balanceBefore - originalDispatchFee).toFixed(2));
        const balanceAfterPenalty = Number((balanceAfterFee - penaltyAmount).toFixed(2));
        const newStatus = balanceAfterPenalty < 0 ? 'OUTSTANDING_DEBT' : vehicleAccount.status;

        // Atomic ledger entries
        await this.prisma.$transaction([
          this.prisma.vehicleAccount.update({
            where: { id: vehicleAccount.id },
            data: {
              balance: balanceAfterPenalty,
              status: newStatus,
              lastTransactionAt: capturedAt,
            },
          }),
          this.prisma.vehicleAccountTransaction.create({
            data: {
              vehicleAccountId: vehicleAccount.id,
              vehicleId: vehicle.id,
              cardId: activeCard?.id || null,
              type: 'DISPATCH_FEE',
              amount: -originalDispatchFee,
              balanceBefore,
              balanceAfter: balanceAfterFee,
              violationId: violation.id,
              description: `Unpaid dispatch fee for unauthorized departure at ${terminal?.name || terminalId}`,
              performedBy: 'SYSTEM_ANPR',
              createdAt: capturedAt,
            },
          }),
          this.prisma.vehicleAccountTransaction.create({
            data: {
              vehicleAccountId: vehicleAccount.id,
              vehicleId: vehicle.id,
              cardId: activeCard?.id || null,
              type: 'PENALTY',
              amount: -penaltyAmount,
              balanceBefore: balanceAfterFee,
              balanceAfter: balanceAfterPenalty,
              violationId: violation.id,
              description: `Penalty fine for unauthorized departure without valid dispatch`,
              performedBy: 'SYSTEM_ANPR',
              createdAt: capturedAt,
            },
          }),
        ]);

        this.eventsGateway.emitViolationCreated(violation);
        this.eventsGateway.emitAccountUpdated({
          type: 'PENALTY_APPLIED',
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          balance: balanceAfterPenalty,
          totalAmountDue,
          violationId: violation.id,
        });
      } else if (recentDispatchRecord && !recentDispatchRecord.departureConfirmed) {
        // Authorized exit departure confirmation
        await this.prisma.dispatchRecord.update({
          where: { id: recentDispatchRecord.id },
          data: { departureConfirmed: true, dispatchOutTime: capturedAt },
        });
      }

      // Update queue entry to DETECTED_AT_EXIT
      if (activeQueue) {
        await this.prisma.queueEntry.update({
          where: { id: activeQueue.id },
          data: {
            status: 'DETECTED_AT_EXIT',
            exitCameraId: camera?.id || dto.cameraId,
            exitCapturedAt: capturedAt,
            isViolation: !isAuthorizedDispatch ? true : activeQueue.isViolation,
            violationRemark: violationRemark || activeQueue.violationRemark,
          },
        });
      }

      // Update vehicle status & journey state
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { journeyState: 'ON_ROUTE', status: 'IN_TRANSIT' },
      });

      const exitEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: 'EXIT',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: isAuthorizedDispatch ? 'ACCEPTED' : 'NOT_ASSIGNED',
          vehicleId: vehicle.id,
          queueEntryId: activeQueue?.id || null,
          violationId,
          remarks: isAuthorizedDispatch
            ? 'Exit ANPR camera detected authorized vehicle departure.'
            : 'Exit ANPR detected unauthorized departure. Penalty applied.',
        },
        include: { camera: true, terminal: true },
      });

      const mapped = this.mapEvent(exitEvent);
      this.eventsGateway.emitRecognitionCaptured(mapped);
      this.eventsGateway.emitJourneyStateChanged({
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        journeyState: 'ON_ROUTE',
        terminalId,
      });
      this.eventsGateway.emitQueueUpdated({
        type: 'EXIT_DETECTED',
        queueEntry: activeQueue,
        terminalId,
      });

      return {
        success: true,
        processingResult: isAuthorizedDispatch ? 'ACCEPTED' : 'UNAUTHORIZED_DEPARTURE',
        event: mapped,
        queueEntry: activeQueue,
        violationId,
        message: isAuthorizedDispatch
          ? `Exit detection confirmed for ${normalizedPlate}. Vehicle status updated.`
          : `Unauthorized departure detected for ${normalizedPlate}. Penalty of ${violationRemark} recorded.`,
      };
    }

    // 4. ENTRY CAMERA WORKFLOW (Auto-Queue & Eligibility Validation)

    // Check duplicate check-in window (prevent rapid duplicate scans within configured seconds)
    const duplicateWindowSeconds = config?.duplicateWindowSeconds || 300;
    const windowStart = new Date(Date.now() - duplicateWindowSeconds * 1000);

    const alreadyInQueue = await this.prisma.queueEntry.findFirst({
      where: {
        vehicleId: vehicle.id,
        terminalId,
        status: { in: ['WAITING', 'LOADING', 'READY_TO_DEPART'] },
      },
    });

    const recentScan = await this.prisma.recognitionEvent.findFirst({
      where: {
        plateNumber: normalizedPlate,
        terminalId,
        capturedAt: { gte: windowStart },
        processingResult: { in: ['ACCEPTED', 'NOT_ASSIGNED'] },
      },
    });

    if (alreadyInQueue || recentScan) {
      const dupEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: 'ENTRY',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: 'DUPLICATE',
          vehicleId: vehicle.id,
          queueEntryId: alreadyInQueue?.id || null,
          remarks: 'Duplicate event: Vehicle is already waiting in queue or was scanned within duplicate protection window.',
        },
        include: { camera: true, terminal: true },
      });

      const mapped = this.mapEvent(dupEvent);
      this.eventsGateway.emitRecognitionCaptured(mapped);
      return {
        success: true,
        processingResult: 'DUPLICATE',
        event: mapped,
        message: `Vehicle ${normalizedPlate} is already in the terminal queue or scanned recently.`,
      };
    }

    // Validate Periodic Route Assignment for this terminal & vehicle group (3-month cycle)
    const now = new Date();
    const { getCurrentQuarter } = require('../common/utils/date.util');
    const currentQuarter = getCurrentQuarter();

    let activeAssignments = await this.prisma.weeklyAssignment.findMany({
      where: {
        vehicleGroupId: vehicle.groupId,
        status: { in: ['PUBLISHED', 'LOCKED'] },
        OR: [{ originTerminalId: terminalId }, { destinationTerminalId: terminalId }],
        AND: [
          {
            OR: [
              { weekNumber: currentQuarter },
              { weekStart: { lte: now }, weekEnd: { gte: now } },
            ],
          },
        ],
      },
    });

    if (activeAssignments.length === 0) {
      activeAssignments = await this.prisma.weeklyAssignment.findMany({
        where: {
          vehicleGroupId: vehicle.groupId,
          status: { in: ['PUBLISHED', 'LOCKED'] },
          OR: [{ originTerminalId: terminalId }, { destinationTerminalId: terminalId }],
        },
      });
    }

    // CASE 1: Vehicle Exists AND Correctly Assigned to current terminal's weekly roster
    if (activeAssignments.length > 0) {
      const assignment = activeAssignments[0];
      const checkOutTerminalId =
        assignment.originTerminalId === terminalId
          ? assignment.destinationTerminalId
          : assignment.originTerminalId;

      const checkOutTerminal = await this.prisma.terminal.findUnique({ where: { id: checkOutTerminalId } });

      // Count position in waiting queue
      const waitingCount = await this.prisma.queueEntry.count({
        where: { assignmentId: assignment.id, terminalId, status: 'WAITING' },
      });
      const position = waitingCount + 1;

      // Create Recognition Event
      const recEvent = await this.prisma.recognitionEvent.create({
        data: {
          cameraId: camera?.id || dto.cameraId,
          terminalId,
          cameraType: 'ENTRY',
          plateNumber: normalizedPlate,
          rawPlateNumber: rawPlate,
          confidence: dto.confidence,
          capturedAt,
          imagePath: dto.imagePath || null,
          processingResult: 'ACCEPTED',
          vehicleId: vehicle.id,
          remarks: `Valid weekly assignment verified (${assignment.name}). Automatically queued.`,
        },
        include: { camera: true, terminal: true },
      });

      // Create Queue Entry
      const queueEntry = await this.prisma.queueEntry.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vehicleGroupName: vehicle.group?.name || '',
          assignmentId: assignment.id,
          terminalId,
          terminalName: terminal?.name || '',
          destinationTerminalName: checkOutTerminal?.name || '',
          position,
          status: 'WAITING',
          entryType: 'AUTO_RECOGNIZED',
          recognitionEventId: recEvent.id,
          cameraId: camera?.id || null,
          confidence: dto.confidence,
          checkedInBy: `ANPR Gate (${camera?.name || 'Entry Camera'})`,
          isViolation: false,
        },
      });

      // Update recognition event with queueEntryId
      await this.prisma.recognitionEvent.update({
        where: { id: recEvent.id },
        data: { queueEntryId: queueEntry.id },
      });

      // Update vehicle status & journey state
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { status: 'WAITING', journeyState: 'WAITING' },
      });

      const mappedEvent = this.mapEvent(recEvent);
      this.eventsGateway.emitRecognitionCaptured(mappedEvent);
      this.eventsGateway.emitQueueUpdated({
        type: 'CHECK_IN',
        queueEntry,
        terminalId,
      });

      return {
        success: true,
        processingResult: 'ACCEPTED',
        event: mappedEvent,
        queueEntry,
        message: `Vehicle ${normalizedPlate} verified for ${assignment.name} and added to queue (Position #${position}).`,
      };
    }

    // CASE 2: Vehicle Exists BUT NOT Assigned to this terminal (WRONG TERMINAL or UNASSIGNED)
    this.logger.warn(`Vehicle ${normalizedPlate} detected at ${terminal?.name} with no valid assignment for this terminal.`);

    // Check if vehicle has an active assignment for a DIFFERENT terminal this week
    const otherAssignment = await this.prisma.weeklyAssignment.findFirst({
      where: {
        vehicleGroupId: vehicle.groupId,
        status: { in: ['PUBLISHED', 'LOCKED'] },
      },
      include: { originTerminal: true, destinationTerminal: true },
    });

    const isWrongTerminal = !!otherAssignment;
    const violationType = isWrongTerminal ? 'WRONG_TERMINAL_ENTRY' : 'UNASSIGNED_VEHICLE_ENTRY';
    const assignedTerminalName = otherAssignment
      ? `${otherAssignment.originTerminal.name} ↔ ${otherAssignment.destinationTerminal.name}`
      : 'None (Unassigned)';

    const violationDesc = isWrongTerminal
      ? `Vehicle ${vehicle.plateNumber} is assigned to [${assignedTerminalName}], but arrived at terminal [${terminal?.name || terminalId}].`
      : `Vehicle ${vehicle.plateNumber} is not assigned to any active weekly roster, but entered terminal [${terminal?.name || terminalId}].`;

    // Fallback assignment to link to queue
    let fallbackAssignment = otherAssignment || await this.prisma.weeklyAssignment.findFirst({
      where: { status: { in: ['PUBLISHED', 'LOCKED', 'DRAFT'] } },
    });

    if (!fallbackAssignment) {
      fallbackAssignment = await this.prisma.weeklyAssignment.findFirst();
    }

    const recEvent = await this.prisma.recognitionEvent.create({
      data: {
        cameraId: camera?.id || dto.cameraId,
        terminalId,
        cameraType: 'ENTRY',
        plateNumber: normalizedPlate,
        rawPlateNumber: rawPlate,
        confidence: dto.confidence,
        capturedAt,
        imagePath: dto.imagePath || null,
        processingResult: 'NOT_ASSIGNED',
        vehicleId: vehicle.id,
        remarks: violationDesc,
      },
      include: { camera: true, terminal: true },
    });

    const waitingCount = await this.prisma.queueEntry.count({
      where: { terminalId, status: 'WAITING' },
    });

    const queueEntry = await this.prisma.queueEntry.create({
      data: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleGroupName: `${vehicle.group?.name || ''} (${isWrongTerminal ? 'WRONG TERMINAL' : 'UNASSIGNED'})`,
        assignmentId: fallbackAssignment ? fallbackAssignment.id : 'unassigned',
        terminalId,
        terminalName: terminal?.name || '',
        destinationTerminalName: isWrongTerminal ? `Assigned to: ${assignedTerminalName}` : 'Unassigned Route',
        position: waitingCount + 1,
        status: 'WAITING',
        entryType: 'VIOLATION',
        recognitionEventId: recEvent.id,
        cameraId: camera?.id || null,
        confidence: dto.confidence,
        checkedInBy: `ANPR Gate (${camera?.name || 'Entry Camera'})`,
        isViolation: true,
        violationRemark: violationDesc,
      },
    });

    // Create Violation record
    const violation = await this.prisma.violation.create({
      data: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        assignmentId: fallbackAssignment?.id || null,
        terminalId,
        assignedTerminalId: otherAssignment?.originTerminalId || null,
        assignedRouteId: null,
        entryRecognitionEventId: recEvent.id,
        imagePath: dto.imagePath || null,
        type: violationType,
        description: violationDesc,
        severity: 'HIGH',
        status: 'OPEN',
        reportedBy: `ANPR System (${camera?.name || 'Entry Gate'})`,
      },
    });

    await this.prisma.recognitionEvent.update({
      where: { id: recEvent.id },
      data: { queueEntryId: queueEntry.id, violationId: violation.id },
    });

    await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'WAITING', journeyState: 'WAITING' },
    });

    const mappedEvent = this.mapEvent(recEvent);
    this.eventsGateway.emitRecognitionCaptured(mappedEvent);
    this.eventsGateway.emitQueueUpdated({
      type: 'CHECK_IN_VIOLATION',
      queueEntry,
      terminalId,
    });

    return {
      success: true,
      processingResult: 'NOT_ASSIGNED',
      event: mappedEvent,
      queueEntry,
      violation,
      message: `⚠ VIOLATION: ${violationDesc} Dispatcher review required.`,
    };
  }

  async listEvents(query: QueryParamsDto & { terminalId?: string; cameraId?: string; processingResult?: string }) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { rawPlateNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.terminalId) where.terminalId = query.terminalId;
    if (query.cameraId) where.cameraId = query.cameraId;
    if (query.processingResult) where.processingResult = query.processingResult as any;

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { capturedAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.recognitionEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: { camera: true, terminal: true, vehicle: true },
      }),
      this.prisma.recognitionEvent.count({ where }),
    ]);

    return {
      data: data.map((e) => this.mapEvent(e)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getUnknownEvents(query: QueryParamsDto) {
    return this.listEvents({ ...query, processingResult: 'UNKNOWN' });
  }

  async assignUnknownPlate(eventId: string, dto: AssignUnknownPlateDto) {
    const event = await this.prisma.recognitionEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpException('Recognition event not found.', HttpStatus.NOT_FOUND);
    if (event.processingResult !== 'UNKNOWN') throw new HttpException('Event is not an UNKNOWN vehicle event.', HttpStatus.BAD_REQUEST);

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new HttpException('Target vehicle not found in database.', HttpStatus.NOT_FOUND);

    const updatedEvent = await this.prisma.recognitionEvent.update({
      where: { id: eventId },
      data: {
        vehicleId: vehicle.id,
        processingResult: 'ACCEPTED',
        remarks: dto.remarks || `Manually assigned to vehicle ${vehicle.plateNumber} by dispatcher.`,
      },
      include: { camera: true, terminal: true },
    });

    return this.mapEvent(updatedEvent);
  }

  async getStats(terminalId?: string) {
    const where: any = terminalId ? { terminalId } : {};
    const [totalEvents, acceptedCount, unknownCount, lowConfCount, notAssignedCount] = await Promise.all([
      this.prisma.recognitionEvent.count({ where }),
      this.prisma.recognitionEvent.count({ where: { ...where, processingResult: 'ACCEPTED' } }),
      this.prisma.recognitionEvent.count({ where: { ...where, processingResult: 'UNKNOWN' } }),
      this.prisma.recognitionEvent.count({ where: { ...where, processingResult: 'LOW_CONFIDENCE' } }),
      this.prisma.recognitionEvent.count({ where: { ...where, processingResult: 'NOT_ASSIGNED' } }),
    ]);

    const accuracyRate = totalEvents > 0 ? (acceptedCount / totalEvents) * 100 : 100;

    return {
      totalEvents,
      acceptedCount,
      unknownCount,
      lowConfCount,
      notAssignedCount,
      accuracyRate: parseFloat(accuracyRate.toFixed(2)),
    };
  }

  async scanImage(file?: any, body?: { image?: string; imageBase64?: string; plateNumber?: string }) {
    let plateNumber = body?.plateNumber || '';
    let rawText = body?.plateNumber || '';
    let confidence = 0.95;

    const recognitionUrl = process.env.RECOGNITION_SERVICE_URL || 'http://recognition:8000';

    try {
      if (file || body?.image || body?.imageBase64) {
        let responseData: any = null;

        if (file && file.buffer) {
          const formData = new FormData();
          const blob = new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' });
          formData.append('file', blob, file.originalname || 'image.jpg');

          const res = await fetch(`${recognitionUrl}/scan-image`, {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            responseData = await res.json();
          }
        } else if (body?.image || body?.imageBase64) {
          const res = await fetch(`${recognitionUrl}/scan-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: body.image, imageBase64: body.imageBase64 }),
          });
          if (res.ok) {
            responseData = await res.json();
          }
        }

        if (responseData && responseData.plateNumber) {
          plateNumber = responseData.plateNumber;
          rawText = responseData.rawText || responseData.plateNumber;
          confidence = responseData.confidence ?? 0.9;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Recognition microservice scan-image call failed: ${err.message}`);
    }

    const normalizedPlate = PlateNormalizer.normalize(plateNumber);

    let vehicle: any = null;
    const cleanPlate = (normalizedPlate || rawText).replace(/[^A-Za-z0-9]/g, '');

    if (cleanPlate) {
      vehicle = await this.prisma.vehicle.findFirst({
        where: {
          OR: [
            { plateNumber: normalizedPlate },
            { plateNumber: rawText },
            { plateNumber: { contains: cleanPlate, mode: 'insensitive' } },
          ],
        },
        include: {
          group: true,
          account: true,
        },
      });
    }

    const success = Boolean(normalizedPlate || rawText || vehicle);

    return {
      success,
      plateNumber: vehicle?.plateNumber || normalizedPlate || rawText,
      confidence: vehicle ? Math.max(confidence, 0.95) : confidence,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            type: vehicle.type,
            capacity: vehicle.capacity,
            status: vehicle.status,
            journeyState: vehicle.journeyState,
            groupId: vehicle.groupId,
            groupName: vehicle.group?.name || null,
            driverName: vehicle.driverName,
            driverPhone: vehicle.driverPhone,
            balance: vehicle.account?.balance ?? 0,
          }
        : null,
      rawText: rawText || normalizedPlate,
    };
  }
}
