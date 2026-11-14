'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle2, UserCheck, RefreshCw, AlertTriangle, Car,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ALPR_API_BASE, alprFetch } from '@/src/services/alpr-api';

export default function UnknownVehicleReviewPage() {
  const [unknownEvents, setUnknownEvents] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resEvt, resVeh] = await Promise.all([
        alprFetch('/recognition/unknown'),
        alprFetch('/vehicles'),
      ]);
      if (resEvt.ok) {
        const json = await resEvt.json();
        setUnknownEvents(json.data || []);
      }
      if (resVeh.ok) {
        const json = await resVeh.json();
        setVehicles(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalUnknown = unknownEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalUnknown / pageSize));
  const paginatedUnknownEvents = unknownEvents.slice((page - 1) * pageSize, page * pageSize);

  const handleAssign = async () => {
    if (!selectedEvent || !selectedVehicleId) return;
    setSubmitting(true);
    try {
      const res = await alprFetch(`/recognition/unknown/${selectedEvent.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: selectedVehicleId }),
      });

      if (res.ok) {
        alert(`Successfully assigned plate ${selectedEvent.plateNumber} to vehicle.`);
        setSelectedEvent(null);
        setSelectedVehicleId('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Assignment failed.');
      }
    } catch (e) {
      alert('Failed to assign plate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" /> Unknown Vehicle Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review plates recognized by ALPR cameras that are not registered in the system registry.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold">
                Unregistered Recognized Plates ({totalUnknown})
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {totalUnknown} Pending
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {paginatedUnknownEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      selectedEvent?.id === evt.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedEvent(evt)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold font-mono text-sm border border-amber-200">
                        {evt.plateNumber.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-mono font-bold text-base">{evt.plateNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {evt.cameraName} • {evt.terminalName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                        UNKNOWN
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {new Date(evt.capturedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {totalUnknown === 0 && !loading && (
                  <div className="p-12 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <h3 className="mt-3 text-lg font-semibold text-foreground">No Unknown Vehicle Alerts</h3>
                    <p className="text-sm">Every recognized vehicle plate matches a registered vehicle in the system.</p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground bg-card">
                  <span>
                    Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalUnknown)} of {totalUnknown}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" /> Assign Plate Event
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {selectedEvent ? (
                <>
                  <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                    <span className="text-xs text-muted-foreground">Selected Unregistered Plate:</span>
                    <p className="font-mono font-bold text-lg text-primary">{selectedEvent.plateNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Captured at {selectedEvent.terminalName} by {selectedEvent.cameraName}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Select Registered Vehicle in DB:</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                    >
                      <option value="">Choose Vehicle...</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber} — {v.model} ({v.groupName || 'No Group'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleAssign}
                    disabled={!selectedVehicleId || submitting}
                  >
                    {submitting ? 'Assigning...' : 'Confirm Vehicle Assignment'}
                  </Button>
                </>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  <Car className="mx-auto h-8 w-8 opacity-40 mb-2" />
                  Select an unknown plate event from the queue to assign it to a vehicle.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
