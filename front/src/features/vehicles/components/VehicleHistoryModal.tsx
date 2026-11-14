'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/services/api';
import type { VehicleHistoryResponse } from '@/src/types/operations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bus, Calendar, Clock, DollarSign, AlertTriangle,
  Camera, ShieldCheck, User, Phone, CheckCircle2,
  Route as RouteIcon, Send, History, Check
} from 'lucide-react';

interface VehicleHistoryModalProps {
  vehicleIdOrPlate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleHistoryModal({ vehicleIdOrPlate, open, onOpenChange }: VehicleHistoryModalProps) {
  const { data, isLoading, isError } = useQuery<VehicleHistoryResponse>({
    queryKey: ['vehicle-history', vehicleIdOrPlate],
    queryFn: () => api.vehicles.getHistory(vehicleIdOrPlate!),
    enabled: !!vehicleIdOrPlate && open,
  });

  if (!open) return null;

  const v = data?.vehicle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 font-mono">
                <Bus className="h-5 w-5 text-primary" /> {v?.plateNumber || vehicleIdOrPlate}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Complete 360° Transport Office Operational, Roster, Entry, Dispatch, Fee & Violation History
              </DialogDescription>
            </div>
            {v && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">Group: {v.groupName}</Badge>
                <Badge className={
                  v.status === 'WAITING' ? 'bg-sky-500/15 text-sky-600 border-sky-200' :
                  v.status === 'DISPATCHED' || v.status === 'IN_TRANSIT' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200' :
                  v.status === 'MAINTENANCE' ? 'bg-amber-500/15 text-amber-600 border-amber-200' :
                  'bg-slate-500/15 text-slate-600'
                }>
                  {v.status}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <History className="h-5 w-5 animate-spin text-primary" /> Loading full operational history...
          </div>
        )}

        {isError && (
          <div className="p-8 text-center text-destructive text-sm">
            Failed to load operational history for vehicle.
          </div>
        )}

        {data && (
          <div className="space-y-4 pt-2">
            {/* Specs Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border text-xs">
              <div>
                <span className="text-muted-foreground block">Model & Type:</span>
                <span className="font-semibold">{v?.model} ({v?.type})</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Capacity:</span>
                <span className="font-semibold">{v?.capacity} Passenger Seats</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Assigned Driver:</span>
                <span className="font-semibold flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" /> {v?.driverName || 'None assigned'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Driver Phone:</span>
                <span className="font-semibold font-mono flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" /> {v?.driverPhone || '-'}
                </span>
              </div>
            </div>

            {/* History Tabs */}
            <Tabs defaultValue="trips" className="w-full">
              <TabsList className="grid grid-cols-5 w-full text-xs">
                <TabsTrigger value="trips" className="text-xs gap-1">
                  <Send className="h-3.5 w-3.5" /> Dispatches ({data.dispatchRecords.length})
                </TabsTrigger>
                <TabsTrigger value="roster" className="text-xs gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Assignments ({data.assignments.length})
                </TabsTrigger>
                <TabsTrigger value="entries" className="text-xs gap-1">
                  <Clock className="h-3.5 w-3.5" /> Terminal Entries ({data.queueEntries.length})
                </TabsTrigger>
                <TabsTrigger value="violations" className="text-xs gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Violations ({data.violations.length})
                </TabsTrigger>
                <TabsTrigger value="anpr" className="text-xs gap-1">
                  <Camera className="h-3.5 w-3.5" /> ANPR Scans ({data.recognitionEvents.length})
                </TabsTrigger>
              </TabsList>

              {/* 1. DISPATCHES & TRIPS */}
              <TabsContent value="trips" className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Route / Terminals</TableHead>
                      <TableHead>Dispatch Time</TableHead>
                      <TableHead>Dispatcher</TableHead>
                      <TableHead>Fee Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Departure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dispatchRecords.map((d: any) => (
                      <TableRow key={d.id} className="text-xs">
                        <TableCell className="font-medium">
                          {d.originTerminalName} → {d.destinationTerminalName}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {new Date(d.dispatchTime).toLocaleString()}
                        </TableCell>
                        <TableCell>{d.dispatcherName}</TableCell>
                        <TableCell className="font-mono font-semibold">{d.feeAmount} ETB</TableCell>
                        <TableCell>
                          <Badge variant={d.paymentStatus === 'PAID' ? 'default' : 'outline'} className={
                            d.paymentStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200' :
                            d.paymentStatus === 'WAIVED' ? 'bg-sky-500/15 text-sky-600' : 'text-amber-600'
                          }>
                            {d.paymentStatus} {d.paymentReference ? `(${d.paymentReference})` : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.departureConfirmed ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Confirmed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">In Progress</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.dispatchRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No completed dispatch records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* 2. WEEKLY ROSTER ASSIGNMENTS */}
              <TabsContent value="roster" className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Week & Assignment</TableHead>
                      <TableHead>Assigned Route</TableHead>
                      <TableHead>Validity Period</TableHead>
                      <TableHead>Roster Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignments.map((a: any) => (
                      <TableRow key={a.id} className="text-xs">
                        <TableCell className="font-medium">
                          <div>Week #{a.weekNumber}</div>
                          <span className="text-[11px] text-muted-foreground">{a.name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium flex items-center gap-1">
                            <RouteIcon className="h-3 w-3 text-primary" /> {a.route}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {a.weekStart} to {a.weekEnd}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            a.status === 'LOCKED' ? 'border-primary bg-primary/10 text-primary font-bold' :
                            a.status === 'PUBLISHED' ? 'border-emerald-300 text-emerald-600 bg-emerald-50/50' :
                            'text-muted-foreground'
                          }>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.assignments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No weekly roster assignments found for this vehicle's group.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* 3. TERMINAL ENTRIES */}
              <TabsContent value="entries" className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Terminal</TableHead>
                      <TableHead>Entry Time</TableHead>
                      <TableHead>Method / Checked In By</TableHead>
                      <TableHead>Dispatched In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.queueEntries.map((q: any) => (
                      <TableRow key={q.id} className="text-xs">
                        <TableCell className="font-medium">{q.terminalName}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {new Date(q.checkedInAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {q.entryType === 'AUTO_RECOGNIZED' ? (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] gap-1">
                              <Camera className="h-3 w-3" /> ANPR {q.confidence ? `(${(q.confidence * 100).toFixed(0)}%)` : ''}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{q.checkedInBy}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {q.dispatchInTime ? new Date(q.dispatchInTime).toLocaleTimeString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{q.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {q.isViolation ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Violation
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-[10px]">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.queueEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No terminal entry records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* 4. VIOLATIONS */}
              <TabsContent value="violations" className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Type</TableHead>
                      <TableHead>Description & Remark</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Reported Time</TableHead>
                      <TableHead>Status & Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.violations.map((vln: any) => (
                      <TableRow key={vln.id} className="text-xs">
                        <TableCell className="font-semibold text-destructive">{vln.type}</TableCell>
                        <TableCell>
                          <p>{vln.description}</p>
                          {vln.remark && <p className="text-[11px] text-muted-foreground mt-0.5 font-medium italic">Remark: "{vln.remark}"</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={vln.severity === 'HIGH' || vln.severity === 'CRITICAL' ? 'border-destructive text-destructive' : ''}>
                            {vln.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {new Date(vln.reportedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={vln.status === 'RESOLVED' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-destructive/15 text-destructive'}>
                            {vln.status} {vln.resolutionAction ? `(${vln.resolutionAction})` : ''}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.violations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          Clean record! No violations recorded for this vehicle.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* 5. ANPR CAMERA SCANS */}
              <TabsContent value="anpr" className="space-y-3 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Gate / Camera</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Captured At</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recognitionEvents.map((r: any) => (
                      <TableRow key={r.id} className="text-xs">
                        <TableCell className="font-medium">{r.cameraName || r.terminalName}</TableCell>
                        <TableCell><Badge variant="outline">{r.cameraType}</Badge></TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {new Date(r.capturedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-emerald-600">
                          {(r.confidence * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            r.processingResult === 'ACCEPTED' ? 'bg-emerald-500/15 text-emerald-600' :
                            r.processingResult === 'NOT_ASSIGNED' ? 'bg-destructive/15 text-destructive' :
                            'bg-amber-500/15 text-amber-600'
                          }>
                            {r.processingResult}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px] max-w-xs truncate">
                          {r.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recognitionEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No ANPR recognition captures recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
