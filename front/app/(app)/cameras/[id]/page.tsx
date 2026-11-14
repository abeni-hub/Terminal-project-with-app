'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, RefreshCw, Power, Activity, Video, Radio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ALPR_API_BASE } from '@/src/services/alpr-api';

export default function CameraDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [camera, setCamera] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streamActive, setStreamActive] = useState(true);

  useEffect(() => {
    fetch(`${ALPR_API_BASE}/cameras/${id}`)
      .then((res) => res.json())
      .then((data) => setCamera(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading camera details...</div>;
  }

  if (!camera) {
    return <div className="p-8 text-center text-destructive">Camera not found.</div>;
  }

  const pythonStreamUrl = `http://localhost:8000/preview/${camera.code || camera.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cameras">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cameras
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{camera.name}</h1>
            <p className="text-sm text-muted-foreground">
              {camera.terminalName} • Gate: {camera.gateName} ({camera.code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={camera.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {camera.status}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setStreamActive(!streamActive)}>
            <Radio className="mr-2 h-4 w-4 text-emerald-500 animate-pulse" />
            {streamActive ? 'Stop Stream' : 'Start Stream'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Video className="h-5 w-5 text-primary" /> Live ALPR Stream Feed
              </CardTitle>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> LIVE 1080p
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative aspect-video w-full overflow-hidden bg-black/90 flex items-center justify-center">
                {streamActive ? (
                  <img
                    src={pythonStreamUrl}
                    alt="Live ALPR Stream"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      // Fallback synthetic container graphic if python server stream is idle
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12 opacity-40" />
                    <p className="mt-2 text-sm">Stream Paused</p>
                  </div>
                )}
                {/* Visual Bounding Box Overlay Simulation */}
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                  <div className="flex justify-between text-xs font-mono text-emerald-400 bg-black/40 px-3 py-1 rounded backdrop-blur-sm self-start">
                    <span>STATUS: ACTIVE | OCR: PADDLE_OCR</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Terminal:</span>
                <p className="font-medium">{camera.terminalName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Gate Name:</span>
                <p className="font-medium">{camera.gateName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Camera Type:</span>
                <Badge variant="outline">{camera.cameraType}</Badge>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Source Provider:</span>
                <p className="font-mono font-medium">{camera.sourceType}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Source Connection Address:</span>
                <p className="font-mono text-xs bg-muted/40 p-2 rounded truncate">{camera.sourceAddress}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Last Heartbeat:</span>
                <p className="font-mono text-xs">{camera.lastHeartbeat ? new Date(camera.lastHeartbeat).toLocaleString() : 'No heartbeat recorded'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
