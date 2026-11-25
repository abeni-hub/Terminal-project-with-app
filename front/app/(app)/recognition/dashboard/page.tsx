'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import {
  Scan, Camera, CheckCircle2, AlertTriangle, ShieldAlert,
  Activity, Clock, RefreshCw, BarChart2, Video, Eye,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, QrCode,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ALPR_API_BASE } from '@/src/services/alpr-api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

interface RecognitionEvent {
  id: string;
  cameraName: string;
  terminalName: string;
  cameraType: 'ENTRY' | 'EXIT' | 'SURVEILLANCE';
  plateNumber: string;
  confidence: number;
  capturedAt: string;
  processingResult: 'ACCEPTED' | 'DUPLICATE' | 'UNKNOWN' | 'LOW_CONFIDENCE' | 'NOT_ASSIGNED' | 'SUSPENDED';
  remarks?: string;
}

export default function RecognitionDashboardPage() {
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const [unknownAlerts, setUnknownAlerts] = useState<RecognitionEvent[]>([]);
  const [stats, setStats] = useState<any>({ totalEvents: 0, accuracyRate: 100, acceptedCount: 0, unknownCount: 0 });
  const [connected, setConnected] = useState(false);
  const [streamCameraId, setStreamCameraId] = useState('CAM-PC-01');
  const [eventPage, setEventPage] = useState(1);
  const eventPageSize = 6;
  const totalEventsCount = events.length;
  const totalEventPages = Math.max(1, Math.ceil(totalEventsCount / eventPageSize));
  const paginatedEvents = events.slice((eventPage - 1) * eventPageSize, eventPage * eventPageSize);

  useEffect(() => {
    // Initial stats fetch
    fetch(`${ALPR_API_BASE}/recognition/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((e) => console.error(e));

    // Fetch initial event history
    fetch(`${ALPR_API_BASE}/recognition/events?pageSize=15`)
      .then((res) => res.json())
      .then((data) => setEvents(data.data || []))
      .catch((e) => console.error(e));

    // Connect WebSocket
    const socket = io(WS_BASE, { transports: ['websocket'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('recognition:captured', (event: RecognitionEvent) => {
      if (event.processingResult === 'DUPLICATE') return;
      setEvents((prev) => [event, ...prev.slice(0, 24)]);
      setStats((prev: any) => ({ ...prev, totalEvents: prev.totalEvents + 1 }));
    });

    socket.on('alert:unknown_vehicle', (event: RecognitionEvent) => {
      setUnknownAlerts((prev) => [event, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'ACCEPTED':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200">AUTO QUEUED</Badge>;
      case 'NOT_ASSIGNED':
        return <Badge variant="destructive">VIOLATION (UNASSIGNED)</Badge>;
      case 'UNKNOWN':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-200">UNKNOWN PLATE</Badge>;
      case 'LOW_CONFIDENCE':
        return <Badge variant="secondary">LOW CONFIDENCE</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Live ALPR Recognition Feed</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${connected ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {connected ? 'Realtime Connected' : 'Connecting WS...'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatic License Plate Recognition live processing feed, auto-queueing events, and instant alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" asChild>
            <Link href="/recognition/qr-gate">
              <QrCode className="mr-1.5 h-4 w-4" /> QR Gate Scanner
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/recognition/history">Recognition Log</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/recognition/unknown">
              <AlertTriangle className="mr-1.5 h-4 w-4 text-amber-500" /> Unknown Queue ({unknownAlerts.length})
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plate Scans</CardTitle>
            <Scan className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Captured today across gates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognition Accuracy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.accuracyRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">High confidence plate matches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Queued Vehicles</CardTitle>
            <Activity className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">{stats.acceptedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Zero-dispatcher intervention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unknown Plate Alerts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.unknownCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requiring dispatcher review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Event Stream */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Live Capture Event Feed
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {events.length} Live Items
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {paginatedEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold font-mono text-sm border border-primary/20">
                        {event.plateNumber.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base tracking-wide">{event.plateNumber}</span>
                          {getResultBadge(event.processingResult)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.cameraName} • {event.terminalName} ({event.cameraType})
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs font-semibold text-emerald-600 block">
                        {(event.confidence * 100).toFixed(0)}% Conf
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(event.capturedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}

                {totalEventsCount === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Scan className="mx-auto h-8 w-8 opacity-40 animate-pulse" />
                    <p className="mt-2 text-sm">Listening for real-time camera recognition events...</p>
                  </div>
                )}
              </div>

              {totalEventPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground bg-card">
                  <span>
                    Showing {((eventPage - 1) * eventPageSize) + 1}–{Math.min(eventPage * eventPageSize, totalEventsCount)} of {totalEventsCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEventPage(1)}
                      disabled={eventPage === 1}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                      disabled={eventPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      {eventPage} / {totalEventPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                      disabled={eventPage === totalEventPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEventPage(totalEventPages)}
                      disabled={eventPage === totalEventPages}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Camera Feed Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" /> Live ALPR Camera Stream
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Camera Source Selector Buttons */}
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setStreamCameraId('CAM-PC-01')}
                  className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-all ${
                    streamCameraId === 'CAM-PC-01'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  💻 PC Webcam (CAM-PC-01)
                </button>
                <button
                  type="button"
                  onClick={() => setStreamCameraId('CAM-DEMO-01')}
                  className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-all ${
                    streamCameraId === 'CAM-DEMO-01'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ⚡ Synthetic Mock
                </button>
              </div>

              <div className="aspect-video w-full rounded-lg bg-black/90 overflow-hidden relative flex items-center justify-center border border-border">
                <img
                  key={streamCameraId}
                  src={`/recognition-api/preview/${streamCameraId}`}
                  alt={`Live Stream ${streamCameraId}`}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute top-2 left-2 bg-black/70 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE STREAM • {streamCameraId}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Active Camera:</span>
                <Badge variant="outline" className="font-mono">
                  {streamCameraId === 'CAM-PC-01' ? 'PC/USB Webcam (0)' : 'Mock Synthetic'}
                </Badge>
              </div>

              <div className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  💡 How to use PC Camera:
                </p>
                <p>1. Hold plate or paper text up to your laptop / USB webcam.</p>
                <p>2. OpenCV draws a green bounding box & text banner on video.</p>
                <p>3. Recognized plate automatically broadcasts to NestJS & Queue.</p>
              </div>

              <Button className="w-full" size="sm" variant="outline" asChild>
                <Link href="/cameras">
                  <Camera className="mr-2 h-4 w-4" /> Manage All Cameras
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
