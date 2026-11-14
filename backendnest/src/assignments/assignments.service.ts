import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto/create-assignment.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { getCurrentWeekNumber, getWeekDateRange } from '../common/utils/date.util';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async mapAssignment(a: any) {
    const group = await this.prisma.vehicleGroup.findUnique({ where: { id: a.vehicleGroupId } });
    const origin = await this.prisma.terminal.findUnique({ where: { id: a.originTerminalId } });
    const dest = await this.prisma.terminal.findUnique({ where: { id: a.destinationTerminalId } });
    const dispatchers = await this.prisma.user.findMany({ where: { id: { in: a.dispatcherIds || [] } } });

    return {
      id: a.id,
      name: a.name,
      weekNumber: a.weekNumber,
      weekStart: a.weekStart instanceof Date ? a.weekStart.toISOString().split('T')[0] : a.weekStart,
      weekEnd: a.weekEnd instanceof Date ? a.weekEnd.toISOString().split('T')[0] : a.weekEnd,
      vehicleGroupId: a.vehicleGroupId,
      vehicleGroupName: group?.name || '',
      originTerminalId: a.originTerminalId,
      originTerminalName: origin?.name || '',
      destinationTerminalId: a.destinationTerminalId,
      destinationTerminalName: dest?.name || '',
      dispatcherIds: a.dispatcherIds || [],
      dispatcherNames: dispatchers.map((d) => d.name),
      status: a.status,
      reviewedAt: a.reviewedAt?.toISOString() || null,
      reviewedBy: a.reviewedBy || null,
      lockedAt: a.lockedAt?.toISOString() || null,
      lockedBy: a.lockedBy || null,
      conflictCount: 0,
      conflicts: [],
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private async detectConflicts(vehicleGroupId: string, weekNumber: number, excludeId?: string) {
    const conflicts: any[] = [];
    const where: any = { vehicleGroupId, weekNumber };
    if (excludeId) where.id = { not: excludeId };

    const existing = await this.prisma.weeklyAssignment.findFirst({ where });
    if (existing) {
      const origin = await this.prisma.terminal.findUnique({ where: { id: existing.originTerminalId } });
      const dest = await this.prisma.terminal.findUnique({ where: { id: existing.destinationTerminalId } });
      conflicts.push({
        type: 'GROUP_ALREADY_ASSIGNED',
        message: `Vehicle group is already assigned to ${origin?.name} - ${dest?.name} for this week.`,
        conflictingAssignmentId: existing.id,
      });
    }
    return conflicts;
  }

  /**
   * Validate dispatcher assignment rules:
   * 1. Every dispatcher must have exactly one assigned terminal (terminalId on User).
   * 2. That terminal must be either the origin or destination terminal of the assignment.
   * 3. Multiple dispatchers from the same terminal CANNOT be assigned to the same route.
   *    (Each dispatcher at a terminal must handle distinct routes).
   */
  private async validateDispatchers(
    dispatcherIds: string[],
    originTerminalId: string,
    destinationTerminalId: string,
  ) {
    const uniqueIds = [...new Set(dispatcherIds)];
    const terminalCounts: Record<string, { terminalName: string; dispatcherNames: string[] }> = {};

    for (const dispatcherId of uniqueIds) {
      const dispatcher = await this.prisma.user.findUnique({
        where: { id: dispatcherId },
        include: { terminal: true, role: true },
      });
      if (!dispatcher) {
        throw new HttpException(`Dispatcher with ID "${dispatcherId}" not found.`, HttpStatus.NOT_FOUND);
      }
      if (!dispatcher.terminalId) {
        throw new HttpException(
          `Dispatcher "${dispatcher.name}" does not have a terminal assigned. A dispatcher must be assigned to exactly one terminal.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const validTerminals = [originTerminalId, destinationTerminalId];
      if (!validTerminals.includes(dispatcher.terminalId)) {
        const origin = await this.prisma.terminal.findUnique({ where: { id: originTerminalId } });
        const dest = await this.prisma.terminal.findUnique({ where: { id: destinationTerminalId } });
        throw new HttpException(
          `Dispatcher "${dispatcher.name}" belongs to terminal "${dispatcher.terminal?.name}". Only dispatchers from origin ("${origin?.name}") or destination ("${dest?.name}") can be assigned to this route.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Track terminal counts to ensure only one dispatcher per terminal is assigned to this route
      if (!terminalCounts[dispatcher.terminalId]) {
        terminalCounts[dispatcher.terminalId] = {
          terminalName: dispatcher.terminal?.name || dispatcher.terminalId,
          dispatcherNames: [],
        };
      }
      terminalCounts[dispatcher.terminalId].dispatcherNames.push(dispatcher.name);

      if (terminalCounts[dispatcher.terminalId].dispatcherNames.length > 1) {
        const tName = terminalCounts[dispatcher.terminalId].terminalName;
        const dNames = terminalCounts[dispatcher.terminalId].dispatcherNames.join(', ');
        throw new HttpException(
          `Multiple dispatchers from the same terminal ("${tName}") cannot be assigned to the same route (${dNames}). Each dispatcher from a terminal must be assigned to different routes.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async list(
    query: QueryParamsDto & {
      status?: string;
      weekNumber?: number | string;
      terminalId?: string;
      dispatcherId?: string;
    },
    currentUser?: any,
  ) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir, status } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    const isDispatcher = currentUser?.role?.name === 'DISPATCHER' || currentUser?.roleId === 'role-dispatcher';

    if (isDispatcher && currentUser) {
      // Dispatcher View: ONLY active week, ONLY routes assigned to logged-in dispatcher, published/locked only
      const currentWeek = getCurrentWeekNumber();
      where.weekNumber = currentWeek;
      where.status = { in: ['PUBLISHED', 'LOCKED'] };
      where.dispatcherIds = { has: currentUser.id };
      if (currentUser.terminalId) {
        where.OR = [
          { originTerminalId: currentUser.terminalId },
          { destinationTerminalId: currentUser.terminalId },
        ];
      }
    } else {
      // Admin / Planner View
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status && status !== 'ALL') {
        where.status = status as any;
      }
      if (query.weekNumber) {
        where.weekNumber = Number(query.weekNumber);
      }
      if (query.dispatcherId && query.dispatcherId !== 'all') {
        where.dispatcherIds = { has: query.dispatcherId };
      }
      if (query.terminalId && query.terminalId !== 'all') {
        where.OR = [
          { originTerminalId: query.terminalId },
          { destinationTerminalId: query.terminalId },
        ];
      }
    }

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { createdAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.weeklyAssignment.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.weeklyAssignment.count({ where }),
    ]);

    const mapped = await Promise.all(data.map((a) => this.mapAssignment(a)));
    return {
      data: mapped,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateAssignmentDto) {
    const group = await this.prisma.vehicleGroup.findUnique({ where: { id: dto.vehicleGroupId } });
    if (!group) throw new HttpException('Vehicle group not found.', HttpStatus.NOT_FOUND);
    const origin = await this.prisma.terminal.findUnique({ where: { id: dto.originTerminalId } });
    if (!origin) throw new HttpException('Origin terminal not found.', HttpStatus.NOT_FOUND);
    const dest = await this.prisma.terminal.findUnique({ where: { id: dto.destinationTerminalId } });
    if (!dest) throw new HttpException('Destination terminal not found.', HttpStatus.NOT_FOUND);

    const cleanDispatcherIds = [...new Set(dto.dispatcherIds || [])];

    if (cleanDispatcherIds.length > 0) {
      await this.validateDispatchers(cleanDispatcherIds, dto.originTerminalId, dto.destinationTerminalId);
    }

    const conflicts = await this.detectConflicts(dto.vehicleGroupId, dto.weekNumber);

    const a = await this.prisma.weeklyAssignment.create({
      data: {
        name: dto.name,
        weekNumber: dto.weekNumber,
        weekStart: new Date(dto.weekStart),
        weekEnd: new Date(dto.weekEnd),
        vehicleGroupId: dto.vehicleGroupId,
        originTerminalId: dto.originTerminalId,
        destinationTerminalId: dto.destinationTerminalId,
        dispatcherIds: cleanDispatcherIds,
        status: 'DRAFT',
      },
    });
    const mapped = await this.mapAssignment(a);
    return { ...mapped, conflictCount: conflicts.length, conflicts };
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);

    if (assignment.status === 'LOCKED') {
      throw new HttpException(
        'This weekly assignment is LOCKED. Modifications require supervisor authorization and audit logging.',
        HttpStatus.FORBIDDEN,
      );
    }

    const effectiveOrigin = assignment.originTerminalId;
    const effectiveDest = dto.destinationTerminalId ?? assignment.destinationTerminalId;
    const cleanDispatcherIds = dto.dispatcherIds ? [...new Set(dto.dispatcherIds)] : assignment.dispatcherIds;

    if (cleanDispatcherIds.length > 0) {
      await this.validateDispatchers(cleanDispatcherIds, effectiveOrigin, effectiveDest);
    }

    const a = await this.prisma.weeklyAssignment.update({
      where: { id },
      data: {
        name: dto.name ?? assignment.name,
        dispatcherIds: cleanDispatcherIds,
        destinationTerminalId: effectiveDest,
      },
    });
    return this.mapAssignment(a);
  }

  async review(id: string, userId?: string) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);
    if (assignment.status !== 'DRAFT') throw new HttpException('Only DRAFT assignments can be moved to REVIEWED.', HttpStatus.BAD_REQUEST);

    const a = await this.prisma.weeklyAssignment.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        reviewedAt: new Date(),
        reviewedBy: userId || 'Transport Officer',
      },
    });
    return this.mapAssignment(a);
  }

  async publish(id: string) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);
    if (!['DRAFT', 'REVIEWED'].includes(assignment.status)) {
      throw new HttpException('Only DRAFT or REVIEWED assignments can be published.', HttpStatus.BAD_REQUEST);
    }

    const conflicts = await this.detectConflicts(assignment.vehicleGroupId, assignment.weekNumber, id);
    if (conflicts.length > 0) throw new HttpException('Cannot publish assignment with unresolved conflicts.', HttpStatus.BAD_REQUEST);

    const a = await this.prisma.weeklyAssignment.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return this.mapAssignment(a);
  }

  async lock(id: string, userId?: string) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);
    if (assignment.status !== 'PUBLISHED') {
      throw new HttpException('Only PUBLISHED assignments can be locked.', HttpStatus.BAD_REQUEST);
    }

    const a = await this.prisma.weeklyAssignment.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: userId || 'System Admin',
      },
    });
    return this.mapAssignment(a);
  }

  async archive(id: string) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);

    const a = await this.prisma.weeklyAssignment.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return this.mapAssignment(a);
  }

  async delete(id: string) {
    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new HttpException('Assignment not found.', HttpStatus.NOT_FOUND);
    if (['PUBLISHED', 'LOCKED'].includes(assignment.status)) {
      throw new HttpException('Published or Locked assignments cannot be deleted. Archive instead.', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.weeklyAssignment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Generate a preview of weekly schedule assignments for a given week.
   * - Pairs each vehicle group with a route round-robin.
   * - Auto-assigns distinct dispatchers from origin and destination terminals round-robin
   *   (enforcing: multiple dispatchers at a terminal handle different routes).
   */
  async generatePreview(weekNumber: number) {
    const { weekStart: weekStartStr, weekEnd: weekEndStr } = getWeekDateRange(weekNumber);

    // Fetch active routes, vehicle groups, and active dispatchers
    const [routes, groups, dispatchers] = await Promise.all([
      this.prisma.route.findMany({ where: { status: 'ACTIVE' } }),
      this.prisma.vehicleGroup.findMany(),
      this.prisma.user.findMany({
        where: { status: 'ACTIVE', role: { name: 'DISPATCHER' } },
      }),
    ]);

    if (routes.length === 0) throw new HttpException('No active routes found to generate schedule.', HttpStatus.BAD_REQUEST);
    if (groups.length === 0) throw new HttpException('No vehicle groups found to generate schedule.', HttpStatus.BAD_REQUEST);

    // Fetch terminal info for routes
    const terminalIds = [...new Set([...routes.map(r => r.originTerminalId), ...routes.map(r => r.destinationTerminalId)])];
    const terminals = await this.prisma.terminal.findMany({ where: { id: { in: terminalIds } } });
    const terminalMap: Record<string, string> = {};
    for (const t of terminals) terminalMap[t.id] = t.name;

    // Group dispatchers by terminal for round-robin distinct route distribution
    const dispatchersByTerminal: Record<string, any[]> = {};
    for (const d of dispatchers) {
      if (d.terminalId) {
        if (!dispatchersByTerminal[d.terminalId]) dispatchersByTerminal[d.terminalId] = [];
        dispatchersByTerminal[d.terminalId].push(d);
      }
    }

    // Keep round-robin pointers per terminal
    const terminalUsageCount: Record<string, number> = {};
    const preview: any[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const route = routes[i % routes.length];

      // Check if this group is already assigned for this week
      const existing = await this.prisma.weeklyAssignment.findFirst({
        where: { vehicleGroupId: group.id, weekNumber },
      });

      const assignedDispatchers: any[] = [];

      // Pick at most 1 dispatcher from origin terminal
      const originList = dispatchersByTerminal[route.originTerminalId] || [];
      if (originList.length > 0) {
        const originIndex = (terminalUsageCount[route.originTerminalId] || 0) % originList.length;
        assignedDispatchers.push(originList[originIndex]);
        terminalUsageCount[route.originTerminalId] = (terminalUsageCount[route.originTerminalId] || 0) + 1;
      }

      // Pick at most 1 dispatcher from destination terminal
      const destList = dispatchersByTerminal[route.destinationTerminalId] || [];
      if (destList.length > 0 && route.destinationTerminalId !== route.originTerminalId) {
        const destIndex = (terminalUsageCount[route.destinationTerminalId] || 0) % destList.length;
        assignedDispatchers.push(destList[destIndex]);
        terminalUsageCount[route.destinationTerminalId] = (terminalUsageCount[route.destinationTerminalId] || 0) + 1;
      }

      preview.push({
        name: `Week ${weekNumber} - ${group.name} - ${terminalMap[route.originTerminalId] || route.originTerminalId} to ${terminalMap[route.destinationTerminalId] || route.destinationTerminalId}`,
        weekNumber,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        vehicleGroupId: group.id,
        vehicleGroupName: group.name,
        originTerminalId: route.originTerminalId,
        originTerminalName: terminalMap[route.originTerminalId] || '',
        destinationTerminalId: route.destinationTerminalId,
        destinationTerminalName: terminalMap[route.destinationTerminalId] || '',
        dispatcherIds: assignedDispatchers.map(d => d.id),
        dispatcherNames: assignedDispatchers.map(d => d.name),
        hasConflict: !!existing,
        conflictAssignmentId: existing?.id || null,
      });
    }

    return { weekNumber, weekStart: weekStartStr, weekEnd: weekEndStr, assignments: preview };
  }

  /**
   * Bulk save auto-generated assignments to the database (as DRAFT status).
   * Skips groups that already have a conflict for the same week.
   */
  async bulkSave(assignments: CreateAssignmentDto[]) {
    const saved: any[] = [];
    const skipped: any[] = [];

    for (const dto of assignments) {
      try {
        // Skip if already has a conflict (group already assigned for week)
        const existing = await this.prisma.weeklyAssignment.findFirst({
          where: { vehicleGroupId: dto.vehicleGroupId, weekNumber: dto.weekNumber },
        });
        if (existing) {
          skipped.push({ name: dto.name, reason: 'Vehicle group already assigned for this week.' });
          continue;
        }

        const validDispatcherIds: string[] = [];
        const seenTerminals = new Set<string>();

        for (const dispId of (dto.dispatcherIds || [])) {
          const d = await this.prisma.user.findUnique({ where: { id: dispId } });
          if (d && d.terminalId && [dto.originTerminalId, dto.destinationTerminalId].includes(d.terminalId)) {
            if (!seenTerminals.has(d.terminalId)) {
              validDispatcherIds.push(dispId);
              seenTerminals.add(d.terminalId);
            }
          }
        }

        const a = await this.prisma.weeklyAssignment.create({
          data: {
            name: dto.name,
            weekNumber: dto.weekNumber,
            weekStart: new Date(dto.weekStart),
            weekEnd: new Date(dto.weekEnd),
            vehicleGroupId: dto.vehicleGroupId,
            originTerminalId: dto.originTerminalId,
            destinationTerminalId: dto.destinationTerminalId,
            dispatcherIds: validDispatcherIds,
            status: 'DRAFT',
          },
        });
        saved.push(await this.mapAssignment(a));
      } catch (e: any) {
        skipped.push({ name: dto.name, reason: e?.message || 'Unknown error' });
      }
    }

    return { saved, skipped, savedCount: saved.length, skippedCount: skipped.length };
  }
}
