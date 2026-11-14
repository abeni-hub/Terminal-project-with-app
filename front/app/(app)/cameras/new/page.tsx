'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Video, Phone, PlaySquare, SlidersHorizontal, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ALPR_API_BASE } from '@/src/services/alpr-api';

export default function RegisterCameraPage() {
  const router = useRouter();
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    terminalId: '',
    gateName: '',
    cameraType: 'ENTRY',
    sourceType: 'USB',
    sourceAddress: '0',
    recognitionEnabled: true,
  });

  useEffect(() => {
    fetch(`${ALPR_API_BASE}/terminals`)
      .then((res) => res.json())
      .then((data) => setTerminals(data.data || []))
      .catch((e) => console.error(e));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${ALPR_API_BASE}/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push('/cameras');
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to register camera.');
      }
    } catch (e) {
      alert('Error registering camera.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cameras">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cameras
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Register New Camera</h1>
          <p className="text-sm text-muted-foreground">Add an entry or exit ALPR recognition camera device.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> Camera Device Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Camera Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Main Gate Entry Cam 01"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Camera Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. CAM-ENT-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="terminalId">Terminal</Label>
                <select
                  id="terminalId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={formData.terminalId}
                  onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                  required
                >
                  <option value="">Select Terminal...</option>
                  {terminals.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gateName">Gate Name</Label>
                <Input
                  id="gateName"
                  placeholder="e.g. Gate A North Entrance"
                  value={formData.gateName}
                  onChange={(e) => setFormData({ ...formData, gateName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cameraType">Camera Function Type</Label>
                <select
                  id="cameraType"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={formData.cameraType}
                  onChange={(e) => setFormData({ ...formData, cameraType: e.target.value as any })}
                >
                  <option value="ENTRY">ENTRY (Check-in & Queueing)</option>
                  <option value="EXIT">EXIT (Departure & Journey Confirm)</option>
                  <option value="SURVEILLANCE">SURVEILLANCE</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceType">Camera Source Provider</Label>
                <select
                  id="sourceType"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={formData.sourceType}
                  onChange={(e) => {
                    const st = e.target.value;
                    let defaultAddr = '0';
                    if (st === 'ANDROID_PHONE') defaultAddr = '192.168.1.50:8080';
                    if (st === 'VIDEO_FILE') defaultAddr = './test_samples/sample_traffic.mp4';
                    if (st === 'MOCK_SYNTHETIC') defaultAddr = 'MOCK';
                    if (st === 'RTSP') defaultAddr = 'rtsp://admin:password@192.168.1.100:554/stream1';
                    setFormData({ ...formData, sourceType: st, sourceAddress: defaultAddr });
                  }}
                >
                  <option value="USB">USB / PC / Laptop Camera</option>
                  <option value="ANDROID_PHONE">Android Phone (IP Webcam / HTTP Stream)</option>
                  <option value="VIDEO_FILE">Recorded Video File (Testing)</option>
                  <option value="MOCK_SYNTHETIC">Mock Synthetic Generator (Demo Mode)</option>
                  <option value="RTSP">RTSP IP Camera Stream</option>
                  <option value="ONVIF">Enterprise ONVIF ANPR Camera</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceAddress">Source Address / Connection String</Label>
              <Input
                id="sourceAddress"
                placeholder="e.g. 0 for webcam, rtsp://..., or video file path"
                value={formData.sourceAddress}
                onChange={(e) => setFormData({ ...formData, sourceAddress: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                For USB: camera index (0, 1). For Android: IP & port. For Mock: enter "MOCK".
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" type="button" asChild>
              <Link href="/cameras">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Register Camera'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
