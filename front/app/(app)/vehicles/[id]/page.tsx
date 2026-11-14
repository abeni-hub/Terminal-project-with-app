'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/services/api';
import type { VehicleHistoryResponse } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bus, Calendar, Clock, DollarSign, AlertTriangle,
  Camera, ShieldCheck, User, Phone, CheckCircle2,
  Route as RouteIcon, Send, History, ArrowLeft
} from 'lucide-react';

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const vehicleId = resolvedParams.id;

  const { data, isLoading, isError, refetch } = useQuery<VehicleHistoryResponse>({
    queryKey: ['vehicle-history', vehicleId],
    queryFn: () => api.vehicles.getHistory(vehicleId),
  });

  const v = data?.vehicle;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vehicles" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Vehicles
          </Link>
        </Button>
      </div>

      <PageHeader
        title={v ? `Vehicle: ${v.plateNumber}` : `Vehicle History`}
        description="Comprehensive 360° operational history, weekly roster assignments, entry/exit logs, and violations"
        actions={
          v && (
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
          )
        }
      />

      {isLoading && (
        <div className="p-16 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <History className="h-6 w-6 animate-spin text-primary" /> Loading vehicle operational records...
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">Failed to load vehicle operational history</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {data && v && (
        <div className="space-y-6">
          {/* Specifications Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bus className="h-5 w-5 text-primary" /> Fleet Vehicle Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">Make / Model</span>
                  <span className="font-semibold text-base">{v.model}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">Type: {v.type}</span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">Passenger Capacity</span>
                  <span className="font-semibold text-base">{v.capacity} Seats</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">Standard Public Transport</span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">Assigned Driver</span>
                  <span className="font-semibold text-base flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" /> {v.driverName || 'None'}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">{v.driverPhone || 'No phone'}</span>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground block">Vehicle Group</span>
                  <span className="font-semibold text-base">{v.groupName}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">ID: {v.groupId}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operational Timeline Tabs */}
          <Tabs defaultValue="trips" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="trips" className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Dispatches ({data.dispatchRecords.length})
              </TabsTrigger>
              <TabsTrigger value="roster" className="gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" /> Weekly Roster ({data.assignments.length})
              </TabsTrigger>
              <TabsTrigger value="entries" className="gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" /> Terminal Entries ({data.queueEntries.length})
              </TabsTrigger>
              <TabsTrigger value="violations" className="gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" /> Violations ({data.violations.length})
              </TabsTrigger>
              <TabsTrigger value="anpr" className="gap-1.5 text-xs">
                <Camera className="h-3.5 w-3.5" /> ANPR Scans ({data.recognitionEvents.length})
              </TabsTrigger>
            </TabsList>

            {/* 1. DISPATCHES */}
            <TabsContent value="trips">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Trip & Dispatch Logs</CardTitle>
                  <CardDescription>All departures confirmed by terminal dispatchers</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route / Direction</TableHead>
                        <TableHead>Dispatch Time</TableHead>
                        <TableHead>Dispatcher</TableHead>
                        <TableHead>Fee Amount</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>Exit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.dispatchRecords.map((d: any) => (
                        <TableRow key={d.id} className="text-xs">
                          <TableCell className="font-semibold">
                            {d.originTerminalName} → {d.destinationTerminalName}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {new Date(d.dispatchTime).toLocaleString()}
                          </TableCell>
                          <TableCell>{d.dispatcherName}</TableCell>
                          <TableCell className="font-mono font-bold">{d.feeAmount} ETB</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              d.paymentStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200' :
                              d.paymentStatus === 'WAIVED' ? 'bg-sky-500/15 text-sky-600' : 'text-amber-600'
                            }>
                              {d.paymentStatus} {d.paymentReference ? `(${d.paymentReference})` : ''}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {d.departureConfirmed ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Exit Confirmed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">In Yard</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.dispatchRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No dispatch history recorded for this vehicle.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. WEEKLY ROSTER */}
            <TabsContent value="roster">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weekly Assignment History</CardTitle>
                  <CardDescription>Roster assignments defining authorized terminal & route</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Assignment Name</TableHead>
                        <TableHead>Assigned Route</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.assignments.map((a: any) => (
                        <TableRow key={a.id} className="text-xs">
                          <TableCell className="font-mono font-bold">Week #{a.weekNumber}</TableCell>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="font-medium text-primary">
                            {a.originTerminalName} ↔ {a.destinationTerminalName}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">{a.weekStart} to {a.weekEnd}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              a.status === 'LOCKED' ? 'border-primary bg-primary/10 text-primary font-bold' :
                              a.status === 'PUBLISHED' ? 'border-emerald-300 text-emerald-600' : ''
                            }>
                              {a.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.assignments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No assignments found for this vehicle's group.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. TERMINAL ENTRIES */}
            <TabsContent value="entries">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Terminal Entry Logs</CardTitle>
                  <CardDescription>Gate entries recorded by ANPR cameras or manual fallback</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Terminal</TableHead>
                        <TableHead>Entry Time</TableHead>
                        <TableHead>Method / Checked In By</TableHead>
                        <TableHead>Dispatched In</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Compliance</TableHead>
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
                          <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                          <TableCell>
                            {q.isViolation ? (
                              <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Violation
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 text-[10px]">Valid</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.queueEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No terminal entry events found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. VIOLATIONS */}
            <TabsContent value="violations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Operational Violations & Audit</CardTitle>
                  <CardDescription>Unauthorized terminal entries, schedule mismatches, or alerts</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Violation Type</TableHead>
                        <TableHead>Description & Details</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Reported Time</TableHead>
                        <TableHead>Resolution</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.violations.map((vln: any) => (
                        <TableRow key={vln.id} className="text-xs">
                          <TableCell className="font-semibold text-destructive">{vln.type}</TableCell>
                          <TableCell>
                            <p>{vln.description}</p>
                            {vln.remark && <p className="text-[11px] text-muted-foreground mt-0.5 italic">Remark: "{vln.remark}"</p>}
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
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Clean operational record. No violations recorded.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. ANPR */}
            <TabsContent value="anpr">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ANPR Camera Recognition History</CardTitle>
                  <CardDescription>Live scans and OCR optical captures for this license plate</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Camera Gate</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>OCR Confidence</TableHead>
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
                          <TableCell className="font-mono font-bold text-emerald-600">
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
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No camera scans logged.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
