import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import {
  TopUpDto,
  LinkCardDto,
  ReplaceCardDto,
  AdjustBalanceDto,
  UpdateAccountStatusDto,
  UpdatePenaltyConfigDto,
} from './dto/vehicle-account.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class VehicleAccountsService {
  private readonly logger = new Logger(VehicleAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper: Ensure vehicle has an account created
   */
  async ensureVehicleAccount(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    let account = await this.prisma.vehicleAccount.findUnique({
      where: { vehicleId },
      include: { vehicle: true },
    });

    if (!account) {
      account = await this.prisma.vehicleAccount.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          balance: 0.0,
          status: 'ACTIVE',
        },
        include: { vehicle: true },
      });
    }

    return account;
  }

  /**
   * List all vehicle accounts with pagination, filters, and computed metrics
   */
  async listAccounts(
    query: QueryParamsDto & {
      status?: string;
      hasDebt?: boolean;
      groupId?: string;
      plateNumber?: string;
    },
  ) {
    // 1. Auto-provision accounts for any vehicles that were registered without one
    const vehiclesWithoutAccount = await this.prisma.vehicle.findMany({
      where: { account: null },
      select: { id: true, plateNumber: true },
    });

    if (vehiclesWithoutAccount.length > 0) {
      await Promise.all(
        vehiclesWithoutAccount.map((v) =>
          this.prisma.vehicleAccount.upsert({
            where: { vehicleId: v.id },
            update: {},
            create: {
              vehicleId: v.id,
              plateNumber: v.plateNumber,
              balance: 0.0,
              status: 'ACTIVE',
            },
          }),
        ),
      );
    }

    const { search, sortBy, sortDir } = query;
    const pageNum = Math.max(1, Number(query.page) || 1);
    const pageSizeNum = Math.max(1, Number(query.pageSize) || 10);
    const skip = (pageNum - 1) * pageSizeNum;
    const where: any = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }

    const hasDebtBool = query.hasDebt === true || query.hasDebt === ('true' as any) || query.hasDebt === ('1' as any);
    if (hasDebtBool) {
      where.OR = [
        { status: 'OUTSTANDING_DEBT' },
        { balance: { lt: 0 } },
      ];
    }

    if (query.plateNumber) {
      where.plateNumber = { contains: query.plateNumber, mode: 'insensitive' };
    } else if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { plateNumber: { contains: term, mode: 'insensitive' } },
        { vehicle: { model: { contains: term, mode: 'insensitive' } } },
        { vehicle: { driverName: { contains: term, mode: 'insensitive' } } },
        { vehicle: { group: { name: { contains: term, mode: 'insensitive' } } } },
        { vehicle: { cards: { some: { OR: [{ cardUid: { contains: term, mode: 'insensitive' } }, { cardNumber: { contains: term, mode: 'insensitive' } }] } } } },
      ];
    }

    if (query.groupId && query.groupId !== 'all') {
      where.vehicle = { ...where.vehicle, groupId: query.groupId };
    }

    const orderBy: any = sortBy
      ? { [sortBy]: sortDir || 'asc' }
      : { updatedAt: 'desc' };

    const [accounts, total] = await Promise.all([
      this.prisma.vehicleAccount.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy,
        include: {
          vehicle: {
            include: {
              group: true,
              cards: {
                where: { status: 'ACTIVE' },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.vehicleAccount.count({ where }),
    ]);

    const formatted = accounts.map((acc) => {
      const activeCard = acc.vehicle?.cards?.[0] || null;
      return {
        id: acc.id,
        vehicleId: acc.vehicleId,
        plateNumber: acc.plateNumber,
        balance: acc.balance,
        status: acc.status,
        lastTransactionAt: acc.lastTransactionAt?.toISOString() || null,
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
        vehicleModel: acc.vehicle?.model,
        vehicleType: acc.vehicle?.type,
        vehicleCapacity: acc.vehicle?.capacity,
        groupId: acc.vehicle?.groupId,
        groupName: acc.vehicle?.group?.name,
        driverName: acc.vehicle?.driverName,
        driverPhone: acc.vehicle?.driverPhone,
        hasDebt: acc.balance < 0 || acc.status === 'OUTSTANDING_DEBT',
        outstandingDebt: acc.balance < 0 ? Math.abs(acc.balance) : 0,
        activeCard: activeCard
          ? {
              id: activeCard.id,
              cardUid: activeCard.cardUid,
              cardNumber: activeCard.cardNumber,
              status: activeCard.status,
              issuedAt: activeCard.issuedAt.toISOString(),
            }
          : null,
      };
    });

    return {
      data: formatted,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.max(1, Math.ceil(total / pageSizeNum)),
    };
  }

  /**
   * Fast search for Top-Up Officer (Search by plate, card UID, or card number)
   */
  async search(searchTerm: string) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = searchTerm.trim();

    // Find vehicles matching plate or having card matching UID/cardNumber
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        OR: [
          { plateNumber: { contains: term, mode: 'insensitive' } },
          { cards: { some: { cardUid: { contains: term, mode: 'insensitive' } } } },
          { cards: { some: { cardNumber: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      take: 10,
      include: {
        group: true,
        account: true,
        cards: {
          orderBy: { createdAt: 'desc' },
        },
        violations: {
          where: { status: { in: ['OPEN', 'PENALTY_APPLIED', 'UNDER_REVIEW'] } },
        },
      },
    });

    return vehicles.map((v) => {
      const activeCard = v.cards.find((c) => c.status === 'ACTIVE') || null;
      const balance = v.account?.balance ?? 0.0;
      const outstandingDebt = balance < 0 ? Math.abs(balance) : 0;
      const openViolationsCount = v.violations.length;

      return {
        vehicleId: v.id,
        plateNumber: v.plateNumber,
        model: v.model,
        type: v.type,
        capacity: v.capacity,
        groupId: v.groupId,
        groupName: v.group?.name || v.groupId,
        driverName: v.driverName,
        driverPhone: v.driverPhone,
        accountId: v.account?.id || null,
        balance,
        accountStatus: v.account?.status || 'ACTIVE',
        hasDebt: balance < 0 || v.account?.status === 'OUTSTANDING_DEBT',
        outstandingDebt,
        openViolationsCount,
        activeCard: activeCard
          ? {
              id: activeCard.id,
              cardUid: activeCard.cardUid,
              cardNumber: activeCard.cardNumber,
              status: activeCard.status,
              issuedAt: activeCard.issuedAt.toISOString(),
            }
          : null,
      };
    });
  }

  /**
   * Get single vehicle account detailed hub
   */
  async getAccountByIdOrVehicleId(idOrVehicleId: string) {
    let account = await this.prisma.vehicleAccount.findFirst({
      where: {
        OR: [{ id: idOrVehicleId }, { vehicleId: idOrVehicleId }, { plateNumber: idOrVehicleId }],
      },
      include: {
        vehicle: {
          include: {
            group: true,
            cards: { orderBy: { createdAt: 'desc' } },
            violations: { orderBy: { reportedAt: 'desc' }, take: 10 },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { card: true },
        },
      },
    });

    if (!account) {
      // Check if vehicle exists without account yet, create one
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          OR: [{ id: idOrVehicleId }, { plateNumber: idOrVehicleId }],
        },
        include: {
          group: true,
          cards: { orderBy: { createdAt: 'desc' } },
          violations: { orderBy: { reportedAt: 'desc' }, take: 10 },
        },
      });

      if (!vehicle) {
        throw new HttpException('Vehicle or Vehicle Account not found.', HttpStatus.NOT_FOUND);
      }

      account = await this.prisma.vehicleAccount.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          balance: 0.0,
          status: 'ACTIVE',
        },
        include: {
          vehicle: {
            include: {
              group: true,
              cards: { orderBy: { createdAt: 'desc' } },
              violations: { orderBy: { reportedAt: 'desc' }, take: 10 },
            },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 25,
            include: { card: true },
          },
        },
      });
    }

    // Aggregate statistics
    const [topupSum, feeSum, penaltySum] = await Promise.all([
      this.prisma.vehicleAccountTransaction.aggregate({
        where: { vehicleAccountId: account.id, type: 'TOPUP' },
        _sum: { amount: true },
      }),
      this.prisma.vehicleAccountTransaction.aggregate({
        where: { vehicleAccountId: account.id, type: 'DISPATCH_FEE' },
        _sum: { amount: true },
      }),
      this.prisma.vehicleAccountTransaction.aggregate({
        where: { vehicleAccountId: account.id, type: 'PENALTY' },
        _sum: { amount: true },
      }),
    ]);

    const totalTopups = topupSum._sum.amount || 0;
    const totalDispatchFees = Math.abs(feeSum._sum.amount || 0);
    const totalPenalties = Math.abs(penaltySum._sum.amount || 0);
    const outstandingDebt = account.balance < 0 ? Math.abs(account.balance) : 0;

    const activeCard = account.vehicle?.cards?.find((c) => c.status === 'ACTIVE') || null;

    return {
      account: {
        id: account.id,
        vehicleId: account.vehicleId,
        plateNumber: account.plateNumber,
        balance: account.balance,
        status: account.status,
        lastTransactionAt: account.lastTransactionAt?.toISOString() || null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
      vehicle: {
        id: account.vehicle.id,
        plateNumber: account.vehicle.plateNumber,
        model: account.vehicle.model,
        type: account.vehicle.type,
        capacity: account.vehicle.capacity,
        status: account.vehicle.status,
        journeyState: account.vehicle.journeyState,
        groupId: account.vehicle.groupId,
        groupName: account.vehicle.group?.name,
        driverName: account.vehicle.driverName,
        driverPhone: account.vehicle.driverPhone,
      },
      stats: {
        currentBalance: account.balance,
        totalTopups,
        totalDispatchFees,
        totalPenalties,
        outstandingDebt,
        hasDebt: account.balance < 0 || account.status === 'OUTSTANDING_DEBT',
      },
      activeCard: activeCard
        ? {
            id: activeCard.id,
            cardUid: activeCard.cardUid,
            cardNumber: activeCard.cardNumber,
            status: activeCard.status,
            issuedAt: activeCard.issuedAt.toISOString(),
            expiresAt: activeCard.expiresAt?.toISOString() || null,
            createdBy: activeCard.createdBy,
          }
        : null,
      cards: (account.vehicle.cards || []).map((c) => ({
        id: c.id,
        cardUid: c.cardUid,
        cardNumber: c.cardNumber,
        status: c.status,
        issuedAt: c.issuedAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() || null,
        blockedAt: c.blockedAt?.toISOString() || null,
        blockedReason: c.blockedReason || null,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
      })),
      recentTransactions: (account.transactions || []).map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        paymentMethod: t.paymentMethod,
        paymentReference: t.paymentReference,
        dispatchRecordId: t.dispatchRecordId,
        violationId: t.violationId,
        description: t.description,
        performedBy: t.performedBy,
        createdAt: t.createdAt.toISOString(),
        cardUid: t.card?.cardUid,
        cardNumber: t.card?.cardNumber,
      })),
      violations: (account.vehicle.violations || []).map((v) => ({
        id: v.id,
        type: v.type,
        description: v.description,
        severity: v.severity,
        status: v.status,
        reportedBy: v.reportedBy,
        reportedAt: v.reportedAt.toISOString(),
        resolvedAt: v.resolvedAt?.toISOString() || null,
        originalDispatchFee: v.originalDispatchFee,
        penaltyAmount: v.penaltyAmount,
        totalAmountDue: v.totalAmountDue,
      })),
    };
  }

  /**
   * Top-Up Vehicle Account
   * Creates an immutable ledger transaction and updates balance
   */
  async topUp(dto: TopUpDto, officerUser: any, ipAddress?: string) {
    if (!dto.amount || dto.amount <= 0) {
      throw new HttpException('Top-up amount must be greater than 0 ETB.', HttpStatus.BAD_REQUEST);
    }

    // Resolve vehicle
    let vehicle = null;
    if (dto.vehicleId) {
      vehicle = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
        include: { cards: true },
      });
    } else if (dto.plateNumber) {
      vehicle = await this.prisma.vehicle.findUnique({
        where: { plateNumber: dto.plateNumber.trim() },
        include: { cards: true },
      });
    } else if (dto.cardUid || dto.cardNumber) {
      const card = await this.prisma.transportCard.findFirst({
        where: {
          OR: [
            ...(dto.cardUid ? [{ cardUid: dto.cardUid.trim() }] : []),
            ...(dto.cardNumber ? [{ cardNumber: dto.cardNumber.trim() }] : []),
          ],
        },
        include: { vehicle: { include: { cards: true } } },
      });
      if (card) vehicle = card.vehicle;
    }

    if (!vehicle) {
      throw new HttpException('Vehicle could not be identified from the provided identifiers.', HttpStatus.NOT_FOUND);
    }

    // Ensure account exists
    let account = await this.prisma.vehicleAccount.findUnique({ where: { vehicleId: vehicle.id } });
    if (!account) {
      account = await this.prisma.vehicleAccount.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          balance: 0.0,
          status: 'ACTIVE',
        },
      });
    }

    const balanceBefore = account.balance;
    const balanceAfter = Number((balanceBefore + dto.amount).toFixed(2));
    const now = new Date();

    // Determine active card
    const activeCard = vehicle.cards?.find((c) => c.status === 'ACTIVE') || null;

    // Resolve new status if account had debt
    let newStatus = account.status;
    if (account.status === 'OUTSTANDING_DEBT' && balanceAfter >= 0) {
      newStatus = 'ACTIVE';
    }

    const paymentRef = dto.paymentReference || `TOP-${Date.now()}`;
    const performer = officerUser?.name || officerUser?.email || 'Officer';

    // Execute atomic transaction
    const [updatedAccount, transaction] = await this.prisma.$transaction([
      this.prisma.vehicleAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          status: newStatus,
          lastTransactionAt: now,
        },
      }),
      this.prisma.vehicleAccountTransaction.create({
        data: {
          vehicleAccountId: account.id,
          vehicleId: vehicle.id,
          cardId: activeCard?.id || null,
          type: 'TOPUP',
          amount: dto.amount,
          balanceBefore,
          balanceAfter,
          paymentMethod: dto.paymentMethod as any,
          paymentReference: paymentRef,
          description: dto.notes || `Balance top-up via ${dto.paymentMethod}`,
          performedBy: performer,
          createdAt: now,
        },
      }),
    ]);

    // Audit Log
    await this.auditService.log(
      performer,
      'TOPUP_PROCESSED',
      'VehicleAccount',
      account.id,
      `Top-up of ${dto.amount} ETB for vehicle ${vehicle.plateNumber}. Balance: ${balanceBefore} -> ${balanceAfter} ETB. Method: ${dto.paymentMethod}. Ref: ${paymentRef}`,
      ipAddress,
    );

    // Emit live websocket update
    this.eventsGateway.emitAccountUpdated({
      type: 'TOPUP',
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      balance: balanceAfter,
      amount: dto.amount,
      transactionId: transaction.id,
    });

    return {
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        paymentMethod: transaction.paymentMethod,
        paymentReference: transaction.paymentReference,
        description: transaction.description,
        performedBy: transaction.performedBy,
        createdAt: transaction.createdAt.toISOString(),
      },
      account: {
        id: updatedAccount.id,
        vehicleId: updatedAccount.vehicleId,
        plateNumber: updatedAccount.plateNumber,
        balance: updatedAccount.balance,
        status: updatedAccount.status,
        lastTransactionAt: updatedAccount.lastTransactionAt?.toISOString(),
      },
    };
  }

  /**
   * Link RFID Card to Vehicle
   */
  async linkCard(dto: LinkCardDto, officerUser: any, ipAddress?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: { cards: true },
    });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    const cardUid = dto.cardUid.trim().toUpperCase();
    const cardNumber = dto.cardNumber.trim();

    // Check if card UID or card number is active on another vehicle
    const existingActive = await this.prisma.transportCard.findFirst({
      where: {
        OR: [{ cardUid }, { cardNumber }],
        status: 'ACTIVE',
      },
    });

    if (existingActive) {
      throw new HttpException(
        `Card with UID ${cardUid} or number ${cardNumber} is already assigned and ACTIVE on another vehicle.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const performer = officerUser?.name || 'Officer';
    const now = new Date();

    // Deactivate previous active card on this vehicle if any
    const previousActive = vehicle.cards.find((c) => c.status === 'ACTIVE');
    if (previousActive) {
      await this.prisma.transportCard.update({
        where: { id: previousActive.id },
        data: {
          status: 'REPLACED',
          blockedAt: now,
          blockedReason: 'Card replaced by new assignment',
        },
      });
    }

    const newCard = await this.prisma.transportCard.create({
      data: {
        cardUid,
        cardNumber,
        vehicleId: vehicle.id,
        status: 'ACTIVE',
        issuedAt: now,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: performer,
      },
    });

    await this.auditService.log(
      performer,
      'CARD_ASSIGNED',
      'TransportCard',
      newCard.id,
      `Assigned RFID card ${cardNumber} (UID: ${cardUid}) to vehicle ${vehicle.plateNumber}.${previousActive ? ` (Replaced previous card ${previousActive.cardNumber})` : ''}`,
      ipAddress,
    );

    this.eventsGateway.emitCardUpdated({
      type: 'CARD_ASSIGNED',
      vehicleId: vehicle.id,
      cardId: newCard.id,
      cardUid: newCard.cardUid,
      cardNumber: newCard.cardNumber,
    });

    return newCard;
  }

  /**
   * Block a Card
   */
  async blockCard(cardId: string, reason: string, user: any, ipAddress?: string) {
    const card = await this.prisma.transportCard.findUnique({
      where: { id: cardId },
      include: { vehicle: true },
    });
    if (!card) throw new HttpException('Card not found.', HttpStatus.NOT_FOUND);

    const performer = user?.name || 'Staff';
    const now = new Date();

    const updated = await this.prisma.transportCard.update({
      where: { id: cardId },
      data: {
        status: 'BLOCKED',
        blockedAt: now,
        blockedReason: reason || 'Blocked by officer request',
      },
    });

    await this.auditService.log(
      performer,
      'CARD_BLOCKED',
      'TransportCard',
      card.id,
      `Blocked card ${card.cardNumber} (UID: ${card.cardUid}) for vehicle ${card.vehicle.plateNumber}. Reason: ${reason}`,
      ipAddress,
    );

    this.eventsGateway.emitCardUpdated({
      type: 'CARD_BLOCKED',
      vehicleId: card.vehicleId,
      cardId: card.id,
      reason,
    });

    return updated;
  }

  /**
   * Mark Card Lost
   */
  async markCardLost(cardId: string, reason: string, user: any, ipAddress?: string) {
    const card = await this.prisma.transportCard.findUnique({
      where: { id: cardId },
      include: { vehicle: true },
    });
    if (!card) throw new HttpException('Card not found.', HttpStatus.NOT_FOUND);

    const performer = user?.name || 'Staff';
    const now = new Date();

    const updated = await this.prisma.transportCard.update({
      where: { id: cardId },
      data: {
        status: 'LOST',
        blockedAt: now,
        blockedReason: reason || 'Reported lost by driver/owner',
      },
    });

    await this.auditService.log(
      performer,
      'CARD_MARKED_LOST',
      'TransportCard',
      card.id,
      `Marked card ${card.cardNumber} as LOST for vehicle ${card.vehicle.plateNumber}. Reason: ${reason}`,
      ipAddress,
    );

    this.eventsGateway.emitCardUpdated({
      type: 'CARD_LOST',
      vehicleId: card.vehicleId,
      cardId: card.id,
    });

    return updated;
  }

  /**
   * Replace Card with a New Card (and optionally charge replacement fee)
   */
  async replaceCard(dto: ReplaceCardDto, user: any, ipAddress?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: { account: true, cards: true },
    });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    const oldCard = await this.prisma.transportCard.findUnique({ where: { id: dto.oldCardId } });
    if (!oldCard) throw new HttpException('Previous card not found.', HttpStatus.NOT_FOUND);

    const newUid = dto.newCardUid.trim().toUpperCase();
    const newNumber = dto.newCardNumber.trim();

    const existingNew = await this.prisma.transportCard.findFirst({
      where: {
        OR: [{ cardUid: newUid }, { cardNumber: newNumber }],
        status: 'ACTIVE',
      },
    });
    if (existingNew) {
      throw new HttpException('New card UID or Number is already in use by an active card.', HttpStatus.BAD_REQUEST);
    }

    const performer = user?.name || 'Staff';
    const now = new Date();

    // Mark old card as REPLACED
    await this.prisma.transportCard.update({
      where: { id: oldCard.id },
      data: {
        status: 'REPLACED',
        blockedAt: now,
        blockedReason: dto.reason || `Replaced with card ${newNumber}`,
      },
    });

    // Create new card
    const newCard = await this.prisma.transportCard.create({
      data: {
        cardUid: newUid,
        cardNumber: newNumber,
        vehicleId: vehicle.id,
        status: 'ACTIVE',
        issuedAt: now,
        createdBy: performer,
      },
    });

    // Handle replacement fee if requested
    if (dto.feeCharged && dto.feeAmount && dto.feeAmount > 0) {
      const account = await this.ensureVehicleAccount(vehicle.id);
      const balanceBefore = account.balance;
      const balanceAfter = Number((balanceBefore - dto.feeAmount).toFixed(2));
      const newStatus = balanceAfter < 0 ? 'OUTSTANDING_DEBT' : account.status;

      await this.prisma.$transaction([
        this.prisma.vehicleAccount.update({
          where: { id: account.id },
          data: {
            balance: balanceAfter,
            status: newStatus,
            lastTransactionAt: now,
          },
        }),
        this.prisma.vehicleAccountTransaction.create({
          data: {
            vehicleAccountId: account.id,
            vehicleId: vehicle.id,
            cardId: newCard.id,
            type: 'CARD_REPLACEMENT_FEE',
            amount: -dto.feeAmount,
            balanceBefore,
            balanceAfter,
            description: `Card replacement fee for ${oldCard.cardNumber} -> ${newNumber}`,
            performedBy: performer,
            createdAt: now,
          },
        }),
      ]);
    }

    await this.auditService.log(
      performer,
      'CARD_REPLACED',
      'TransportCard',
      newCard.id,
      `Replaced card ${oldCard.cardNumber} with ${newNumber} (UID: ${newUid}) for ${vehicle.plateNumber}.${dto.feeCharged ? ` Fee charged: ${dto.feeAmount} ETB` : ''}`,
      ipAddress,
    );

    this.eventsGateway.emitCardUpdated({
      type: 'CARD_REPLACED',
      vehicleId: vehicle.id,
      oldCardId: oldCard.id,
      newCardId: newCard.id,
    });

    return newCard;
  }

  /**
   * Manual Balance Adjustment (Super Admin / Supervisor only)
   */
  async adjustBalance(vehicleId: string, dto: AdjustBalanceDto, user: any, ipAddress?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    const account = await this.ensureVehicleAccount(vehicle.id);
    const balanceBefore = account.balance;
    const balanceAfter = Number((balanceBefore + dto.amount).toFixed(2));
    const now = new Date();
    const performer = user?.name || 'Supervisor';

    const type = dto.amount >= 0 ? 'ADJUSTMENT' : 'PENALTY';
    const newStatus = balanceAfter < 0 ? 'OUTSTANDING_DEBT' : 'ACTIVE';

    const [updatedAccount, txn] = await this.prisma.$transaction([
      this.prisma.vehicleAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          status: newStatus,
          lastTransactionAt: now,
        },
      }),
      this.prisma.vehicleAccountTransaction.create({
        data: {
          vehicleAccountId: account.id,
          vehicleId: vehicle.id,
          type: type as any,
          amount: dto.amount,
          balanceBefore,
          balanceAfter,
          paymentReference: dto.reference || `ADJ-${Date.now()}`,
          description: `Manual adjustment: ${dto.reason}`,
          performedBy: performer,
          createdAt: now,
        },
      }),
    ]);

    await this.auditService.log(
      performer,
      'BALANCE_ADJUSTMENT',
      'VehicleAccount',
      account.id,
      `Adjusted balance for ${vehicle.plateNumber} by ${dto.amount} ETB (${balanceBefore} -> ${balanceAfter}). Reason: ${dto.reason}`,
      ipAddress,
    );

    this.eventsGateway.emitAccountUpdated({
      type: 'BALANCE_ADJUSTED',
      vehicleId: vehicle.id,
      balance: balanceAfter,
    });

    return { account: updatedAccount, transaction: txn };
  }

  /**
   * Update Account Status
   */
  async updateAccountStatus(vehicleId: string, dto: UpdateAccountStatusDto, user: any, ipAddress?: string) {
    const account = await this.ensureVehicleAccount(vehicleId);
    const performer = user?.name || 'Supervisor';

    const updated = await this.prisma.vehicleAccount.update({
      where: { id: account.id },
      data: { status: dto.status as any },
    });

    await this.auditService.log(
      performer,
      'ACCOUNT_STATUS_CHANGED',
      'VehicleAccount',
      account.id,
      `Changed account status for ${account.plateNumber} from ${account.status} to ${dto.status}.${dto.reason ? ` Reason: ${dto.reason}` : ''}`,
      ipAddress,
    );

    this.eventsGateway.emitAccountUpdated({
      type: 'STATUS_CHANGED',
      vehicleId: account.vehicleId,
      status: dto.status,
    });

    return updated;
  }

  /**
   * Global Financial Transactions Ledger
   */
  async getTransactions(
    query: QueryParamsDto & {
      vehicleId?: string;
      plateNumber?: string;
      type?: string;
      paymentMethod?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const { search, sortBy, sortDir } = query;
    const pageNum = Math.max(1, Number(query.page) || 1);
    const pageSizeNum = Math.max(1, Number(query.pageSize) || 15);
    const skip = (pageNum - 1) * pageSizeNum;
    const where: any = {};

    if (query.vehicleId && query.vehicleId !== 'all') {
      where.vehicleId = query.vehicleId;
    }
    if (query.plateNumber) {
      where.vehicle = { plateNumber: { contains: query.plateNumber, mode: 'insensitive' } };
    }
    if (query.type && query.type !== 'ALL') {
      where.type = query.type as any;
    }
    if (query.paymentMethod && query.paymentMethod !== 'ALL') {
      where.paymentMethod = query.paymentMethod as any;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { description: { contains: term, mode: 'insensitive' } },
        { paymentReference: { contains: term, mode: 'insensitive' } },
        { performedBy: { contains: term, mode: 'insensitive' } },
        { vehicle: { plateNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orderBy: any = sortBy
      ? { [sortBy]: sortDir || 'desc' }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.vehicleAccountTransaction.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy,
        include: {
          vehicle: { select: { plateNumber: true, model: true } },
          card: { select: { cardUid: true, cardNumber: true } },
        },
      }),
      this.prisma.vehicleAccountTransaction.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        id: t.id,
        vehicleAccountId: t.vehicleAccountId,
        vehicleId: t.vehicleId,
        plateNumber: t.vehicle?.plateNumber,
        vehicleModel: t.vehicle?.model,
        cardId: t.cardId,
        cardUid: t.card?.cardUid,
        cardNumber: t.card?.cardNumber,
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        paymentMethod: t.paymentMethod,
        paymentReference: t.paymentReference,
        dispatchRecordId: t.dispatchRecordId,
        violationId: t.violationId,
        description: t.description,
        performedBy: t.performedBy,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.max(1, Math.ceil(total / pageSizeNum)),
    };
  }

  /**
   * Get all Cards
   */
  async getCards(query: QueryParamsDto & { vehicleId?: string; status?: string }) {
    const { search, sortBy, sortDir } = query;
    const pageNum = Math.max(1, Number(query.page) || 1);
    const pageSizeNum = Math.max(1, Number(query.pageSize) || 15);
    const skip = (pageNum - 1) * pageSizeNum;
    const where: any = {};

    if (query.vehicleId && query.vehicleId !== 'all') {
      where.vehicleId = query.vehicleId;
    }
    if (query.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }
    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { cardUid: { contains: term, mode: 'insensitive' } },
        { cardNumber: { contains: term, mode: 'insensitive' } },
        { vehicle: { plateNumber: { contains: term, mode: 'insensitive' } } },
        { createdBy: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'desc' } : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.transportCard.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy,
        include: {
          vehicle: { select: { id: true, plateNumber: true, model: true } },
        },
      }),
      this.prisma.transportCard.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        id: c.id,
        cardUid: c.cardUid,
        cardNumber: c.cardNumber,
        vehicleId: c.vehicleId,
        plateNumber: c.vehicle?.plateNumber,
        vehicleModel: c.vehicle?.model,
        status: c.status,
        issuedAt: c.issuedAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() || null,
        blockedAt: c.blockedAt?.toISOString() || null,
        blockedReason: c.blockedReason || null,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.max(1, Math.ceil(total / pageSizeNum)),
    };
  }

  /**
   * Get / Update Penalty Configuration
   */
  async getPenaltyConfig() {
    let config = await this.prisma.penaltyConfiguration.findUnique({
      where: { id: 'default-penalty-config' },
    });
    if (!config) {
      config = await this.prisma.penaltyConfiguration.create({
        data: {
          id: 'default-penalty-config',
          name: 'Standard Unauthorized Departure Penalty',
          ruleType: 'FIXED_AMOUNT',
          amount: 50.0,
          description: 'Standard penalty for unauthorized departure without terminal dispatch',
          active: true,
        },
      });
    }
    return config;
  }

  async updatePenaltyConfig(dto: UpdatePenaltyConfigDto, user: any, ipAddress?: string) {
    const config = await this.prisma.penaltyConfiguration.upsert({
      where: { id: 'default-penalty-config' },
      update: {
        ruleType: dto.ruleType as any,
        amount: dto.amount,
        description: dto.description,
        active: dto.active !== undefined ? dto.active : true,
        updatedBy: user?.name || 'Admin',
      },
      create: {
        id: 'default-penalty-config',
        name: 'Standard Unauthorized Departure Penalty',
        ruleType: dto.ruleType as any,
        amount: dto.amount,
        description: dto.description || 'Standard penalty for unauthorized departure',
        active: dto.active !== undefined ? dto.active : true,
        updatedBy: user?.name || 'Admin',
      },
    });

    await this.auditService.log(
      user?.name || 'Admin',
      'PENALTY_CONFIG_UPDATED',
      'PenaltyConfiguration',
      config.id,
      `Updated penalty rule: ${dto.ruleType} with value ${dto.amount} ETB`,
      ipAddress,
    );

    return config;
  }

  /**
   * System-wide financial dashboard summary stats
   */
  async getStatsSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalAccounts,
      activeCardsCount,
      debtAccountsCount,
      todayTopupsAgg,
      totalTopupsAgg,
      todayTransactionsCount,
      totalBalanceAgg,
    ] = await Promise.all([
      this.prisma.vehicleAccount.count(),
      this.prisma.transportCard.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vehicleAccount.count({
        where: {
          OR: [{ status: 'OUTSTANDING_DEBT' }, { balance: { lt: 0 } }],
        },
      }),
      this.prisma.vehicleAccountTransaction.aggregate({
        where: { type: 'TOPUP', createdAt: { gte: today } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.vehicleAccountTransaction.aggregate({
        where: { type: 'TOPUP' },
        _sum: { amount: true },
      }),
      this.prisma.vehicleAccountTransaction.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.vehicleAccount.aggregate({
        _sum: { balance: true },
      }),
    ]);

    return {
      totalAccounts,
      activeCardsCount,
      debtAccountsCount,
      todayTopupsAmount: todayTopupsAgg._sum.amount || 0,
      todayTopupsCount: todayTopupsAgg._count.id || 0,
      totalTopupsVolume: totalTopupsAgg._sum.amount || 0,
      todayTransactionsCount,
      totalBalance: totalBalanceAgg._sum.balance || 0,
    };
  }
}
