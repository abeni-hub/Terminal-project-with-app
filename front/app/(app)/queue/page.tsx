'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { io } from 'socket.io-client';
import { api, type ApiError } from '@/src/services/api';
import type { QueueEntry, DispatchRecord } from '@/src/types/operations';
import type { Vehicle } from '@/src/types/vehicle';
import { PageHeader } from '@/src/components/PageHeader';
import { StatusBadge } from '@/src/components/StatusBadge';
import { StatCard } from '@/src/components/StatCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QUEUE_STATUS_LABELS } from '@/src/constants';
import { toast } from 'sonner';
import {
  ListOrdered, Bus, Send, CheckCircle, Filter, AlertTriangle,
  Clock, XCircle, Scan, ArrowRight, ShieldAlert,
  DollarSign, CheckCircle2, RefreshCw, Eye, Camera, LogOut, Check, History,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Car, CalendarDays, Search,
} from 'lucide-react';
import type { QueueStatus } from '@/src/types/operations';
import { useAuthStore } from '@/src/store/auth-store';
import { VehicleHistoryModal } from '@/src/features/vehicles/components/VehicleHistoryModal';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

type OperationalTab = 'PENDING_IN' | 'LOADING' | 'EXIT_GATE' | 'VIOLATIONS' | 'ALL_QUEUE' | 'DISPATCHED';

const OP_TABS: { key: OperationalTab; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'PENDING_IN',  label: 'Incoming (Pending In)', icon: Scan,          description: 'Vehicles detected by Entry ANPR waiting for Dispatch In confirmation' },
  { key: 'LOADING',     label: 'Loading Yard',          icon: Bus,           description: 'Vehicles currently inside terminal yard loading passengers' },
  { key: 'EXIT_GATE',   label: 'Exit Gate (Pending Out)', icon: LogOut,       description: 'Vehicles detected at Exit ANPR awaiting fee & Dispatch Out confirmation' },
  { key: 'VIOLATIONS',  label: 'Violations Review',     icon: ShieldAlert,   description: 'Wrong-terminal & unassigned vehicles requiring supervisor resolution' },
  { key: 'ALL_QUEUE',   label: 'Live FIFO Queue',       icon: ListOrdered,   description: 'Full active terminal queue in position order' },
  { key: 'DISPATCHED',  label: 'Completed Dispatches',  icon: CheckCircle2,  description: 'Trips successfully dispatched out today' },
];

function currentWeekNumber() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOffset = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1;
  return Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + dayOffset + 1) / 7);
}

export default function QueuePage() {
  const session = useAuthStore((s) => s.session);
  const isDispatcher = session?.role?.name === 'DISPATCHER' || session?.user?.roleId === 'role-dispatcher';
  const currWeek = currentWeekNumber();

  const [activeTab, setActiveTab] = useState<OperationalTab>('PENDING_IN');
  const [selectedPlate, setSelectedPlate] = useState<string>('all');
  const [plateSearchInput, setPlateSearchInput] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [terminalFilter, setTerminalFilter] = useState<string | undefined>(
    session?.user?.terminalId || undefined
  );
  const [assignmentFilter, setAssignmentFilter] = useState<string | undefined>();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Modal states
  const [historyPlate, setHistoryPlate] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [dispatchOutEntry, setDispatchOutEntry] = useState<QueueEntry | null>(null);
  const [dispatchInEntry, setDispatchInEntry] = useState<QueueEntry | null>(null);
  const [violationReviewEntry, setViolationReviewEntry] = useState<QueueEntry | null>(null);

  const qc = useQueryClient();
  const recentlyNotifiedRef = useRef<Map<string, number>>(new Map());

  // Real-time WebSocket connection
  useEffect(() => {
    const socket = io(WS_BASE, { transports: ['websocket'] });
    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));

    socket.on('recognition:captured', (event: any) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });

      // 1. Never show toast for DUPLICATE scans
      if (event.processingResult === 'DUPLICATE') {
        return;
      }

      // 2. Multi-layer Notification Debounce (TTL: 45s per gate + plate + result)
      const notifKey = `${event.cameraType || 'ENTRY'}:${event.plateNumber}:${event.processingResult}`;
      const now = Date.now();
      const lastShown = recentlyNotifiedRef.current.get(notifKey) || 0;
      if (now - lastShown < 45000) {
        return; // Suppress duplicate toast spam
      }
      recentlyNotifiedRef.current.set(notifKey, now);

      // Clean old cache entries
      if (recentlyNotifiedRef.current.size > 100) {
        for (const [k, t] of recentlyNotifiedRef.current.entries()) {
          if (now - t > 60000) recentlyNotifiedRef.current.delete(k);
        }
      }

      if (event.processingResult === 'NOT_ASSIGNED') {
        toast.warning(`⚠ ANPR Alert: Vehicle ${event.plateNumber} detected with VIOLATION at ${event.terminalName || 'Gate'}`);
      } else if (event.cameraType === 'EXIT') {
        toast.info(`🚗 Exit Camera: Vehicle ${event.plateNumber} detected at Exit Gate`);
      } else {
        toast.success(`📷 ANPR Scanned: Vehicle ${event.plateNumber} verified at Entry Gate`);
      }
    });

    socket.on('queue:updated', () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [qc]);

  // Query Terminals & Assignments
  const { data: terminalsData } = useQuery({
    queryKey: ['terminals-all'],
    queryFn: () => api.terminals.list({ page: 1, pageSize: 100 }),
  });
  const { data: assignmentsData } = useQuery({
    queryKey: ['assignments-active', isDispatcher, session?.user?.id],
    queryFn: () => api.assignments.list({
      page: 1,
      pageSize: 100,
      filters: {
        ...(isDispatcher ? { weekNumber: currWeek, dispatcherId: session?.user?.id } : {}),
      },
    }),
  });

  const terminals = terminalsData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];

  // Query all vehicles for plate search & green/red assignment filtering
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-all-for-queue-filter'],
    queryFn: () => api.vehicles.list({ page: 1, pageSize: 500 }),
  });
  const allVehiclesList = vehiclesData?.data ?? [];

  // Determine which vehicle groups are assigned to active routes
  const assignedGroupIds = useMemo(() => {
    if (assignmentFilter && assignmentFilter !== 'all') {
      const selected = assignments.find((a: any) => a.id === assignmentFilter);
      return selected ? [selected.vehicleGroupId] : [];
    }
    return assignments.map((a: any) => a.vehicleGroupId);
  }, [assignments, assignmentFilter]);

  // Filter vehicles for toolbar dropdown based on search input
  const filteredToolbarVehicles = useMemo(() => {
    let list = [...allVehiclesList];
    if (plateSearchInput.trim()) {
      const q = plateSearchInput.toLowerCase().trim();
      list = list.filter((v: Vehicle) =>
        v.plateNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q)
      );
    }
    list.sort((a: Vehicle, b: Vehicle) => {
      const aAssigned = assignedGroupIds.includes(a.groupId) ? 1 : 0;
      const bAssigned = assignedGroupIds.includes(b.groupId) ? 1 : 0;
      return bAssigned - aAssigned;
    });
    return list;
  }, [allVehiclesList, plateSearchInput, assignedGroupIds]);

  // Query Queue Entries
  const { data: queueData, isLoading, isError, refetch } = useQuery({
    queryKey: ['queue', { page, pageSize, selectedPlate, activeTab, terminalId: terminalFilter, assignmentId: assignmentFilter }],
    queryFn: () => {
      let statusFilter: string | undefined = undefined;
      let isViolationFilter: boolean | undefined = undefined;

      if (activeTab === 'PENDING_IN') {
        statusFilter = 'WAITING';
        isViolationFilter = false;
      } else if (activeTab === 'LOADING') {
        statusFilter = 'LOADING';
      } else if (activeTab === 'EXIT_GATE') {
        statusFilter = 'DETECTED_AT_EXIT';
      } else if (activeTab === 'VIOLATIONS') {
        statusFilter = 'VIOLATIONS';
      } else if (activeTab === 'ALL_QUEUE') {
        statusFilter = 'ACTIVE_OPERATIONAL';
      } else if (activeTab === 'DISPATCHED') {
        statusFilter = 'DISPATCHED';
      }

      return api.queue.list({
        page,
        pageSize,
        filters: {
          terminalId: terminalFilter,
          assignmentId: assignmentFilter,
          status: statusFilter,
          isViolation: isViolationFilter,
          plateNumber: selectedPlate !== 'all' ? selectedPlate : undefined,
        },
      });
    },
  });

  // Query Completed Dispatches
  const { data: dispatchesData } = useQuery({
    queryKey: ['dispatch-records-recent', terminalFilter, page, pageSize],
    queryFn: () => api.dispatchRecords.list({
      page,
      pageSize,
      filters: { originTerminalId: terminalFilter },
    }),
    enabled: activeTab === 'DISPATCHED',
  });

  const allEntries = queueData?.data ?? [];
  const totalEntries = queueData?.total ?? allEntries.length;
  const totalPages = queueData?.totalPages ?? Math.max(1, Math.ceil(totalEntries / pageSize));

  // Mutations
  const dispatchInMut = useMutation({
    mutationFn: (input: { queueEntryId: string; dispatcherId: string; remark?: string }) =>
      api.queue.dispatchIn(input),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Vehicle ${res.plateNumber} confirmed [DISPATCH IN] → Moved to Loading Yard.`);
      setDispatchInEntry(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const dispatchOutMut = useMutation({
    mutationFn: (input: { queueEntryId: string; dispatcherId: string; paymentReference?: string; feeAmount?: number; paymentStatus?: string }) =>
      api.queue.dispatchOut(input),
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Vehicle ${record.plateNumber} [DISPATCHED OUT] successfully! Fee: ${record.feeAmount} ETB`);
      setDispatchOutEntry(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const resolveViolationMut = useMutation({
    mutationFn: (input: { queueEntryId: string; action: 'DISPATCH_IN' | 'REJECT'; remark: string; dispatcherId: string }) =>
      api.queue.resolveViolation(input),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['violations'] });
      toast.success(`Violation resolved for ${res.plateNumber}`);
      setViolationReviewEntry(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const userTerminalName = session?.user?.terminalName || terminals.find((t: any) => t.id === session?.user?.terminalId)?.name || session?.user?.terminalId || 'Terminal';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Dispatcher Queue & Terminal Management"
        description={
          isDispatcher
            ? `Active Terminal Queue for ${userTerminalName} (Week #${currWeek})`
            : "FIFO loading yard queue, automated gate scans, passenger boarding, and departure settlement"
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2 font-mono">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
              {wsConnected ? 'ANPR Live' : 'Offline'}
            </div>

            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>

            <Button size="sm" onClick={() => setCheckInOpen(true)}>
              <Bus className="mr-1.5 h-3.5 w-3.5" /> Manual Check-In
            </Button>
          </div>
        }
      />

      {/* Dispatcher Notice */}
      {isDispatcher && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>
              Operating Week: <strong>Week #{currWeek}</strong> | Viewing routes assigned to <strong>{session?.user?.name}</strong>
            </span>
          </div>
          <Badge variant="outline" className="bg-background">
            Terminal: {userTerminalName}
          </Badge>
        </div>
      )}

      {/* Filter Toolbar: Dropdowns for Terminal, Assignment, and Plate */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filters:
          </span>

          {/* Terminal Selector (Locked for Dispatcher) */}
          {isDispatcher ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md bg-muted/40 text-xs font-medium">
              <span className="text-muted-foreground">Terminal:</span>
              <span>{userTerminalName}</span>
            </div>
          ) : (
            <Select
              value={terminalFilter ?? 'all'}
              onValueChange={(v) => { setTerminalFilter(v === 'all' ? undefined : v); setPage(1); }}
            >
              <SelectTrigger className="h-8 w-44 text-xs bg-background">
                <SelectValue placeholder="All Terminals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terminals</SelectItem>
                {terminals.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Weekly Assignment Filter */}
          <Select
            value={assignmentFilter ?? 'all'}
            onValueChange={(v) => { setAssignmentFilter(v === 'all' ? undefined : v); setPage(1); }}
          >
            <SelectTrigger className="h-8 w-60 text-xs bg-background">
              <SelectValue placeholder={isDispatcher ? "My Assigned Routes" : "All Weekly Assignments"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isDispatcher ? "All My Assigned Routes" : "All Weekly Assignments"}</SelectItem>
              {assignments.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Car Plate Search Input & Filtered Dropdown with Green/Red flags */}
          <div className="flex items-center gap-2">
            <div className="relative w-44">
              <Input
                placeholder="Search plate..."
                value={plateSearchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setPlateSearchInput(val);
                  setSelectedPlate(val.trim() ? val.trim() : 'all');
                  setPage(1);
                }}
                className="h-8 text-xs font-mono pr-6"
              />
              {plateSearchInput && (
                <button
                  type="button"
                  onClick={() => { setPlateSearchInput(''); setSelectedPlate('all'); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>

            <Select
              value={selectedPlate}
              onValueChange={(v) => {
                setSelectedPlate(v);
                setPlateSearchInput(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-60 text-xs bg-background font-mono">
                <SelectValue placeholder={plateSearchInput ? `Filtered (${filteredToolbarVehicles.length} plates)` : "All Vehicles..."} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all" className="font-sans text-xs">
                  {plateSearchInput ? `Show All Vehicles (${allVehiclesList.length})` : `All Vehicles (${allVehiclesList.length})`}
                </SelectItem>
                {filteredToolbarVehicles.map((v: Vehicle) => {
                  const isAssigned = assignedGroupIds.includes(v.groupId);
                  return (
                    <SelectItem key={v.id} value={v.plateNumber} className="font-mono text-xs">
                      <span className={cn(
                        'font-bold mr-1.5',
                        isAssigned ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      )}>
                        {isAssigned ? '🟢 [Assigned]' : '🔴 [Unassigned]'}
                      </span>
                      {v.plateNumber} ({v.model})
                    </SelectItem>
                  );
                })}
                {filteredToolbarVehicles.length === 0 && (
                  <div className="p-2.5 text-center text-xs text-muted-foreground">
                    No plates matching "{plateSearchInput}"
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{totalEntries}</span> active queue items
        </div>
      </div>

      {/* Operational Queue Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as OperationalTab); setPage(1); }}>
        <TabsList className="mb-4 grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-muted/80">
          {OP_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="flex items-center gap-1.5 py-2 text-xs font-medium data-[state=active]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {OP_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <tab.icon className="h-4 w-4 text-primary" /> {tab.label}
                    </CardTitle>
                    <CardDescription className="text-xs">{tab.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {/* Completed Dispatches Table */}
                {tab.key === 'DISPATCHED' ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Plate Number</TableHead>
                          <TableHead>Route / Destination</TableHead>
                          <TableHead>Dispatcher</TableHead>
                          <TableHead>Dispatch Time</TableHead>
                          <TableHead>Fee Collected</TableHead>
                          <TableHead>Receipt Ref</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dispatchesData?.data ?? []).map((r: DispatchRecord) => (
                          <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => { setHistoryPlate(r.plateNumber); setHistoryModalOpen(true); }}
                                className="font-mono text-sm font-bold text-primary hover:underline"
                              >
                                {r.plateNumber}
                              </button>
                              <span className="text-[10px] text-muted-foreground block">{r.vehicleGroupName}</span>
                            </TableCell>
                            <TableCell className="font-medium">
                              {r.originTerminalName} → {r.destinationTerminalName}
                            </TableCell>
                            <TableCell>{r.dispatcherName}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {new Date(r.dispatchTime).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-emerald-600">{r.feeAmount} ETB</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {r.paymentReference || 'PAID'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setHistoryPlate(r.plateNumber); setHistoryModalOpen(true); }}
                              >
                                <History className="h-3 w-3 mr-1" /> History
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(dispatchesData?.data ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No dispatches recorded today for this terminal.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  /* Active Operational Queue Table */
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-16">Pos</TableHead>
                          <TableHead>Vehicle & Plate</TableHead>
                          <TableHead>Assigned Route</TableHead>
                          <TableHead>Detection & Gate</TableHead>
                          <TableHead>Operational Status</TableHead>
                          <TableHead>Compliance</TableHead>
                          <TableHead className="text-right">Operational Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allEntries.map((row: QueueEntry) => {
                          const isViolation = row.isViolation;
                          return (
                            <TableRow key={row.id} className="text-xs hover:bg-muted/30">
                              <TableCell>
                                <span className="font-mono text-xs font-bold bg-muted px-2 py-1 rounded">
                                  #{row.position}
                                </span>
                              </TableCell>

                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => { setHistoryPlate(row.plateNumber); setHistoryModalOpen(true); }}
                                  className="font-mono text-sm font-bold text-primary hover:underline block"
                                >
                                  {row.plateNumber}
                                </button>
                                <span className="text-[10px] text-muted-foreground">{row.vehicleGroupName}</span>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-1 font-medium">
                                  <span>{row.terminalName}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span>{row.destinationTerminalName}</span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="space-y-0.5 text-xs">
                                  <span className="text-muted-foreground font-mono block">
                                    In: {new Date(row.checkedInAt).toLocaleTimeString()}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    By: {row.checkedInBy}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <StatusBadge label={QUEUE_STATUS_LABELS[row.status as QueueStatus] || row.status} />
                              </TableCell>

                              <TableCell>
                                {isViolation ? (
                                  <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                    <AlertTriangle className="h-3 w-3" /> Violation
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-1 w-fit">
                                    <CheckCircle className="h-3 w-3" /> Verified
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {row.status === 'WAITING' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className={cn(
                                          'h-7 text-xs px-2',
                                          isViolation
                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        )}
                                        onClick={() => setDispatchInEntry(row)}
                                      >
                                        <Bus className="mr-1 h-3 w-3" />
                                        {isViolation ? 'Dispatch In (Violation)' : 'Dispatch In'}
                                      </Button>

                                      {isViolation && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs px-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                                          onClick={() => setViolationReviewEntry(row)}
                                        >
                                          <ShieldAlert className="mr-1 h-3 w-3" /> Review
                                        </Button>
                                      )}
                                    </>
                                  )}

                                  {(row.status === 'LOADING' || row.status === 'DETECTED_AT_EXIT') && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => setDispatchOutEntry(row)}
                                    >
                                      <DollarSign className="mr-1 h-3 w-3" /> Confirm & Exit
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {allEntries.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                              No vehicles in this queue tab matching the selected filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination Controls */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t mt-4 text-xs text-muted-foreground">
                  <div>
                    Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalEntries} total entries)
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(1)}
                      disabled={page <= 1 || isLoading}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1 || isLoading}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages || isLoading}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages || isLoading}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* ─── MODAL 1: DISPATCH IN CONFIRMATION ─── */}
      <Dialog open={!!dispatchInEntry} onOpenChange={(o) => !o && setDispatchInEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" /> Confirm Dispatch In (Yard Entry)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Admit vehicle into the loading yard for passenger boarding.
            </DialogDescription>
          </DialogHeader>

          {dispatchInEntry && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plate Number:</span>
                  <span className="font-mono font-bold text-sm text-primary">{dispatchInEntry.plateNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Group:</span>
                  <span className="font-semibold">{dispatchInEntry.vehicleGroupName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-semibold">{dispatchInEntry.terminalName} → {dispatchInEntry.destinationTerminalName}</span>
                </div>
              </div>

              {dispatchInEntry.isViolation && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-xs">Violation Flag Active</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      This vehicle is unassigned or belongs to a different fleet group. Admitting it allows boarding in the LOADING yard while maintaining the violation log.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDispatchInEntry(null)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => {
                if (dispatchInEntry && session?.user.id) {
                  dispatchInMut.mutate({
                    queueEntryId: dispatchInEntry.id,
                    dispatcherId: session.user.id,
                  });
                }
              }}
              disabled={dispatchInMut.isPending}
            >
              {dispatchInMut.isPending ? 'Admitting...' : 'Confirm Dispatch In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: DISPATCH OUT & FEE COLLECTION ─── */}
      <Dialog open={!!dispatchOutEntry} onOpenChange={(o) => !o && setDispatchOutEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" /> Dispatch Out & Fee Settlement
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm departure fee payment and release vehicle gate barrier.
            </DialogDescription>
          </DialogHeader>

          {dispatchOutEntry && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Plate:</span>
                  <span className="font-mono font-bold text-sm text-foreground">{dispatchOutEntry.plateNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-semibold">{dispatchOutEntry.terminalName} → {dispatchOutEntry.destinationTerminalName}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-semibold text-sm">Applicable Fee:</span>
                  <span className="font-mono font-bold text-base text-emerald-600">25.00 ETB</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDispatchOutEntry(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (dispatchOutEntry && session?.user.id) {
                  dispatchOutMut.mutate({
                    queueEntryId: dispatchOutEntry.id,
                    dispatcherId: session.user.id,
                    feeAmount: 25.0,
                    paymentStatus: 'PAID',
                    paymentReference: `REC-${Date.now().toString().slice(-6)}`,
                  });
                }
              }}
              disabled={dispatchOutMut.isPending}
            >
              {dispatchOutMut.isPending ? 'Processing...' : 'Confirm Payment & Dispatch Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 3: VIOLATION RESOLUTION ─── */}
      <Dialog open={!!violationReviewEntry} onOpenChange={(o) => !o && setViolationReviewEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Vehicle Assignment Violation Review
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vehicle is not authorized for this terminal under the published weekly roster.
            </DialogDescription>
          </DialogHeader>

          {violationReviewEntry && (
            <ViolationReviewForm
              entry={violationReviewEntry}
              onResolve={(action, remark) => {
                if (session?.user.id) {
                  resolveViolationMut.mutate({
                    queueEntryId: violationReviewEntry.id,
                    action,
                    remark,
                    dispatcherId: session.user.id,
                  });
                }
              }}
              loading={resolveViolationMut.isPending}
              onCancel={() => setViolationReviewEntry(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 4: FULL 360 VEHICLE OPERATIONAL HISTORY ─── */}
      <VehicleHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        vehicleIdOrPlate={historyPlate}
      />

      {/* ─── MODAL 5: FALLBACK MANUAL CHECK-IN ─── */}
      <FallbackCheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        defaultTerminalId={terminalFilter}
      />
    </div>
  );
}

function ViolationReviewForm({
  entry,
  onResolve,
  loading,
  onCancel,
}: {
  entry: QueueEntry;
  onResolve: (action: 'DISPATCH_IN' | 'REJECT', remark: string) => void;
  loading: boolean;
  onCancel: () => void;
}) {
  const [remark, setRemark] = useState('');
  const [action, setAction] = useState<'DISPATCH_IN' | 'REJECT'>('DISPATCH_IN');

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Detected Plate:</span>
          <span className="font-mono font-bold text-sm text-destructive">{entry.plateNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current Terminal:</span>
          <span className="font-semibold">{entry.terminalName}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Violation Details:</span>
          <span className="font-medium text-destructive mt-0.5 block">{entry.violationRemark || 'Unassigned or wrong terminal'}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Operational Resolution Action</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant={action === 'DISPATCH_IN' ? 'default' : 'outline'}
            onClick={() => setAction('DISPATCH_IN')}
            className="text-xs"
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Approve Dispatch In
          </Button>
          <Button
            type="button"
            size="sm"
            variant={action === 'REJECT' ? 'destructive' : 'outline'}
            onClick={() => setAction('REJECT')}
            className="text-xs"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject & Exit
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">
          Supervisor / Operational Remark <span className="text-destructive">*</span>
        </Label>
        <Textarea
          placeholder={
            action === 'DISPATCH_IN'
              ? 'e.g. "Emergency passenger surge override approved by dispatch supervisor."'
              : 'e.g. "Unauthorized vehicle redirected to assigned terminal."'
          }
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={3}
          className="text-xs"
        />
        {!remark.trim() && (
          <p className="text-[11px] text-destructive">A mandatory remark is required to record the audit trail.</p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button
          size="sm"
          variant={action === 'REJECT' ? 'destructive' : 'default'}
          onClick={() => onResolve(action, remark)}
          disabled={!remark.trim() || loading}
        >
          {loading ? 'Processing...' : action === 'DISPATCH_IN' ? 'Confirm Dispatch In with Remark' : 'Confirm Rejection'}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FallbackCheckInDialog({
  open,
  onOpenChange,
  defaultTerminalId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTerminalId?: string;
}) {
  const session = useAuthStore((s) => s.session);
  const isDispatcher = session?.role?.name === 'DISPATCHER' || session?.user?.roleId === 'role-dispatcher';
  const currWeek = currentWeekNumber();

  const [assignmentId, setAssignmentId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [plateSearchFilter, setPlateSearchFilter] = useState('');
  const [remark, setRemark] = useState('');
  const qc = useQueryClient();

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments-active-checkin', isDispatcher, session?.user?.id],
    queryFn: () => api.assignments.list({
      page: 1,
      pageSize: 100,
      filters: {
        ...(isDispatcher ? { weekNumber: currWeek, dispatcherId: session?.user?.id } : {}),
      },
    }),
  });
  const publishedAssignments = assignmentsData?.data ?? [];

  // Auto-select assignment if only 1 is available or if none is selected yet
  useEffect(() => {
    if (!assignmentId && publishedAssignments.length > 0) {
      if (publishedAssignments.length === 1 || isDispatcher) {
        setAssignmentId(publishedAssignments[0].id);
      }
    }
  }, [publishedAssignments, assignmentId, isDispatcher]);

  const selectedAssignment = publishedAssignments.find((a: any) => a.id === assignmentId);

  // Query all vehicles to allow selecting both assigned and unassigned fleet vehicles
  const { data: allVehiclesData } = useQuery({
    queryKey: ['vehicles-all-fleet-fallback'],
    queryFn: () => api.vehicles.list({ page: 1, pageSize: 500 }),
  });
  const allVehicles = allVehiclesData?.data ?? [];

  // Sort vehicles so assigned group vehicles appear first, and filter by plate search
  const displayVehicles = useMemo(() => {
    let list = [...allVehicles];
    if (selectedAssignment) {
      list.sort((a: Vehicle, b: Vehicle) => {
        const aMatch = a.groupId === selectedAssignment.vehicleGroupId ? 1 : 0;
        const bMatch = b.groupId === selectedAssignment.vehicleGroupId ? 1 : 0;
        return bMatch - aMatch;
      });
    }
    if (plateSearchFilter.trim()) {
      const q = plateSearchFilter.toLowerCase();
      list = list.filter((v: Vehicle) =>
        v.plateNumber.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.groupId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allVehicles, selectedAssignment, plateSearchFilter]);

  const selectedVehicle = allVehicles.find((v: Vehicle) => v.id === vehicleId);
  const isAssignedVehicle = selectedAssignment && selectedVehicle && selectedVehicle.groupId === selectedAssignment.vehicleGroupId;
  const isGroupMismatch = selectedAssignment && selectedVehicle && selectedVehicle.groupId !== selectedAssignment.vehicleGroupId;
  const canCheckIn = Boolean(vehicleId && vehicleId !== 'none' && assignmentId);

  const checkInMut = useMutation({
    mutationFn: () => api.queue.checkIn({
      vehicleId,
      assignmentId,
      dispatcherId: session!.user.id,
      isViolation: Boolean(isGroupMismatch),
      violationRemark: isGroupMismatch
        ? (remark.trim() || `Manual Check-In: Vehicle from group "${selectedVehicle?.groupId}" admitted to route assignment for "${selectedAssignment?.vehicleGroupName}"`)
        : undefined,
    }),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ['queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (entry.isViolation) {
        toast.warning(`Vehicle ${entry.plateNumber} admitted with Violation flag.`);
      } else {
        toast.success(`Manual check-in completed for ${entry.plateNumber}`);
      }
      onOpenChange(false);
      setAssignmentId('');
      setVehicleId('');
      setPlateSearchFilter('');
      setRemark('');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Vehicle Check-In (Fallback)</DialogTitle>
          <DialogDescription className="text-xs">
            Search and admit any fleet vehicle. Assigned vehicles are flagged <strong className="text-emerald-600">Green 🟢</strong>. Unassigned vehicles are flagged <strong className="text-rose-600">Red 🔴</strong> and admitted with a violation tag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">1. Select Active Route Assignment</Label>
              {publishedAssignments.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {publishedAssignments.length} route{publishedAssignments.length > 1 ? 's' : ''} available
                </span>
              )}
            </div>
            <Select value={assignmentId} onValueChange={(v) => { setAssignmentId(v); setVehicleId(''); }}>
              <SelectTrigger className="text-xs">
                <SelectValue
                  placeholder={
                    assignmentsLoading
                      ? "Loading active route assignments..."
                      : publishedAssignments.length > 0
                      ? "Choose a route assignment"
                      : `No active assignments for Week #${currWeek}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {publishedAssignments.map((a: any) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {publishedAssignments.length === 0 && !assignmentsLoading && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                No active route assignments found for Week #{currWeek}. Please ensure assignments are published in the Rosters section.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">2. Select Vehicle Plate</Label>
              <span className="text-[10px] text-muted-foreground">
                <span className="text-emerald-600 font-bold">🟢 Assigned</span> / <span className="text-rose-600 font-bold">🔴 Unassigned</span>
              </span>
            </div>

            {/* Plate Search Input with instant clear and search icon */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={assignmentId ? "Search plate number or model (e.g. 3-A12345)..." : "Select an assignment first"}
                value={plateSearchFilter}
                onChange={(e) => setPlateSearchFilter(e.target.value)}
                className="h-8 text-xs font-mono pl-8 pr-6"
                disabled={!assignmentId}
              />
              {plateSearchFilter && (
                <button
                  type="button"
                  onClick={() => setPlateSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>

            {/* Selected Vehicle Card */}
            {selectedVehicle && (
              <div className="rounded-lg border p-2.5 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border',
                    isAssignedVehicle
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  )}>
                    <span>{isAssignedVehicle ? '🟢 [ASSIGNED]' : '🔴 [UNASSIGNED]'}</span>
                    <span>{selectedVehicle.plateNumber}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span>{selectedVehicle.model}</span>
                    <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">Group: {selectedVehicle.groupId}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setVehicleId('')}
                >
                  Change Plate
                </Button>
              </div>
            )}

            {/* Interactive Filtered Plates List */}
            {(!selectedVehicle || plateSearchFilter.trim()) && assignmentId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span className="font-medium text-foreground">
                    {plateSearchFilter.trim()
                      ? `Filtered Plates (${displayVehicles.length} vehicles matching):`
                      : `Available Fleet Plates (${displayVehicles.length} total):`}
                  </span>
                  <span>Click any plate to select</span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-md border bg-background divide-y shadow-inner">
                  {displayVehicles.map((v: Vehicle) => {
                    const isAssigned = selectedAssignment && v.groupId === selectedAssignment.vehicleGroupId;
                    const isSelected = v.id === vehicleId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehicleId(v.id)}
                        className={cn(
                          'w-full text-left p-2 transition-colors flex items-center justify-between text-xs hover:bg-muted/60',
                          isSelected && 'bg-primary/10 border-l-4 border-l-primary font-medium'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-bold border',
                            isAssigned
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          )}>
                            {isAssigned ? '🟢 [ASSIGNED]' : '🔴 [UNASSIGNED]'}
                          </span>
                          <span className="font-mono font-bold text-foreground">{v.plateNumber}</span>
                          <span className="text-muted-foreground text-[11px]">({v.model})</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                          Group: {v.groupId}
                        </span>
                      </button>
                    );
                  })}

                  {displayVehicles.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No vehicles found matching "{plateSearchFilter}".
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedAssignment && (
            <div className="rounded-md border p-2.5 text-xs bg-muted/40 flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Fleet Group:</span>
              <span className="font-semibold text-primary">{selectedAssignment.vehicleGroupName}</span>
            </div>
          )}

          {isAssignedVehicle && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Verified Active Fleet Assignment
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">🟢 Verified</Badge>
            </div>
          )}

          {isGroupMismatch && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 space-y-2 text-xs text-rose-800 dark:text-rose-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  Unassigned Vehicle Flagged (Red Violation)
                </div>
                <Badge variant="destructive" className="text-[10px]">🔴 Violation Flag</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vehicle <strong>{selectedVehicle?.plateNumber}</strong> belongs to group <em>{selectedVehicle?.groupId}</em> (assigned route expects <em>{selectedAssignment?.vehicleGroupName}</em>). It will be admitted to the queue with a <strong>Violation</strong> badge, and can proceed through Dispatch In, Yard Loading, and Departure.
              </p>
              <div>
                <Label className="text-[11px] font-medium text-foreground">Admission Note / Reason (Optional)</Label>
                <Input
                  placeholder="e.g., Authorized manual emergency admission / temporary reroute..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="text-xs h-8 bg-background mt-1"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            className={isGroupMismatch ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}
            onClick={() => checkInMut.mutate()}
            disabled={!canCheckIn || checkInMut.isPending}
          >
            {checkInMut.isPending
              ? 'Checking in...'
              : isGroupMismatch
              ? 'Admit Vehicle (Flag Violation)'
              : 'Confirm Manual Check-In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
