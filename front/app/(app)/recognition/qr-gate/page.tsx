'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  QrCode, Scan, ShieldCheck, CheckCircle2, XCircle, AlertCircle,
  DoorOpen, Camera, FileText, RefreshCw, Upload, ArrowRight,
  ShieldAlert, Clock, Check, AlertTriangle, Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface GateDecisionResponse {
  action: 'OPEN' | 'HOLD' | 'REJECT';
  match_status: 'MATCHED' | 'PLATE_MISMATCH' | 'QR_ONLY' | 'PLATE_ONLY' | 'REJECTED';
  needs_review: boolean;
  reason: string;
  plate_number?: string;
  ocr_confidence?: number;
  ticket_id?: string;
  pass_type?: string;
  direction?: 'ENTRY' | 'EXIT';
  fee_deducted?: number;
  remaining_balance?: number;
  timestamp?: string;
  audit_id?: number;
  details?: Record<string, any>;
}

interface AuditLogItem {
  id: number;
  timestamp: string;
  action: string;
  match_status: string;
  plate_number: string;
  ticket_id: string;
  pass_type: string;
  direction: string;
  needs_review: number | boolean;
  reason: string;
}

export default function QRGateScannerPage() {
  const [plateNumber, setPlateNumber] = useState('AA67890');
  const [ocrConfidence, setOcrConfidence] = useState('0.92');
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [qrPayload, setQrPayload] = useState(
    JSON.stringify(
      {
        ticket_id: 'TKT-SUB-101',
        plate_number: 'AA67890',
        pass_type: 'SUBSCRIBER',
        expires_at: '2028-12-31T23:59:59Z',
      },
      null,
      2
    )
  );

  const [loading, setLoading] = useState(false);
  const [lastDecision, setLastDecision] = useState<GateDecisionResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Fetch recent SQLite audit logs from recognition service
  const fetchAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/recognition-api/gate-audit-logs?limit=10');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load gate audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Quick Preset Handlers
  const handlePreset = (type: 'VALID' | 'MISMATCH' | 'EXPIRED' | 'VISITOR') => {
    if (type === 'VALID') {
      setPlateNumber('AA67890');
      setOcrConfidence('0.95');
      setQrPayload(
        JSON.stringify(
          {
            ticket_id: 'TKT-SUB-101',
            plate_number: 'AA67890',
            pass_type: 'SUBSCRIBER',
            expires_at: '2028-12-31T23:59:59Z',
          },
          null,
          2
        )
      );
    } else if (type === 'MISMATCH') {
      setPlateNumber('AA99999');
      setOcrConfidence('0.92');
      setQrPayload(
        JSON.stringify(
          {
            ticket_id: 'TKT-ALERT-303',
            plate_number: 'AA67890',
            pass_type: 'SUBSCRIBER',
            expires_at: '2028-12-31T23:59:59Z',
          },
          null,
          2
        )
      );
    } else if (type === 'EXPIRED') {
      setPlateNumber('AA67890');
      setOcrConfidence('0.88');
      setQrPayload(
        JSON.stringify(
          {
            ticket_id: 'TKT-EXP-01',
            plate_number: 'AA67890',
            pass_type: 'VISITOR',
            expires_at: '2024-01-01T00:00:00Z',
          },
          null,
          2
        )
      );
    } else if (type === 'VISITOR') {
      setPlateNumber('');
      setOcrConfidence('0.0');
      setQrPayload(
        JSON.stringify(
          {
            ticket_id: 'VISITOR-DAY-09',
            plate_number: null,
            pass_type: 'VISITOR',
            expires_at: '2028-12-31T23:59:59Z',
          },
          null,
          2
        )
      );
    }
  };

  // Submit Gate Decision Evaluation
  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/recognition-api/gate-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: plateNumber.trim() || undefined,
          confidence: plateNumber.trim() ? parseFloat(ocrConfidence) || 0.9 : 0.0,
          qrCode: qrPayload.trim(),
          direction: direction,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to evaluate gate decision');
      }

      const decision: GateDecisionResponse = await res.json();
      setLastDecision(decision);
      fetchAuditLogs();
    } catch (err: any) {
      alert(`Error evaluating gate decision: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Upload and scan QR image file directly
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Scanning uploaded image for QR code...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/recognition-api/scan-qr', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'No QR code found in uploaded image');
      }

      const data = await res.json();
      if (data.success && data.result) {
        setUploadStatus(`Decoded: ${data.result.raw_data}`);
        setQrPayload(data.result.raw_data);
        if (data.result.payload?.plate_number) {
          setPlateNumber(data.result.payload.plate_number);
        }
      } else {
        setUploadStatus('No QR code detected in image.');
      }
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <QrCode className="h-6 w-6 text-primary" /> QR Pass & Gate Clearance
            </h1>
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200">
              Live Gateway Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Reconcile digital transit QR passes with ALPR camera OCR plates and execute automated barrier gate clearance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/recognition/dashboard">
              <Scan className="mr-1.5 h-4 w-4 text-primary" /> ALPR Live Feed
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={logsLoading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh Logs
          </Button>
        </div>
      </div>

      {/* Main Grid: Gate Visualizer & Form */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Barrier Gate Display (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="overflow-hidden border-2 transition-all">
            <CardHeader className="bg-muted/40 pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5 text-primary" /> Barrier Gate Status
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {direction} GATE
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 text-center space-y-6">
              {/* Animated Barrier Indicator */}
              <div
                className={`mx-auto w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300 shadow-lg ${
                  lastDecision?.action === 'OPEN'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 shadow-emerald-500/20'
                    : lastDecision?.action === 'HOLD'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 shadow-amber-500/20'
                    : lastDecision?.action === 'REJECT'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-600 shadow-rose-500/20'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {lastDecision?.action === 'OPEN' ? (
                  <>
                    <CheckCircle2 className="h-14 w-14 animate-bounce" />
                    <span className="font-bold text-sm tracking-widest mt-1">OPEN</span>
                  </>
                ) : lastDecision?.action === 'HOLD' ? (
                  <>
                    <AlertTriangle className="h-14 w-14 animate-pulse" />
                    <span className="font-bold text-sm tracking-widest mt-1">HOLD</span>
                  </>
                ) : lastDecision?.action === 'REJECT' ? (
                  <>
                    <XCircle className="h-14 w-14" />
                    <span className="font-bold text-sm tracking-widest mt-1">REJECTED</span>
                  </>
                ) : (
                  <>
                    <DoorOpen className="h-14 w-14" />
                    <span className="font-bold text-xs tracking-wider mt-1">READY</span>
                  </>
                )}
              </div>

              {/* Status Outcome Banner */}
              {lastDecision ? (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-lg text-sm font-medium border ${
                      lastDecision.action === 'OPEN'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : lastDecision.action === 'HOLD'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {lastDecision.reason}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-left">
                    <div className="p-2.5 rounded bg-muted/50 border border-border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Match Status</span>
                      <span className="font-mono font-bold text-foreground">{lastDecision.match_status}</span>
                    </div>
                    <div className="p-2.5 rounded bg-muted/50 border border-border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Pass Type</span>
                      <span className="font-mono font-bold text-foreground">{lastDecision.pass_type || 'N/A'}</span>
                    </div>
                    <div className="p-2.5 rounded bg-muted/50 border border-border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Ticket ID</span>
                      <span className="font-mono font-bold text-foreground">{lastDecision.ticket_id || 'N/A'}</span>
                    </div>
                    <div className="p-2.5 rounded bg-muted/50 border border-border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Audit Reference</span>
                      <span className="font-mono font-bold text-emerald-600">#{lastDecision.audit_id || 'PENDING'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                  Awaiting QR ticket or plate scan to evaluate gate clearance policy.
                </div>
              )}

              {/* Quick Image Scanner Upload */}
              <div className="pt-2 border-t border-border">
                <label className="text-xs font-semibold text-muted-foreground block mb-2 text-left">
                  Upload QR Code Image (File Scanner):
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs cursor-pointer file:cursor-pointer"
                  />
                </div>
                {uploadStatus && (
                  <p className="text-[11px] text-muted-foreground mt-1 text-left font-mono truncate">
                    {uploadStatus}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Test Form & Preset Scenarios (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" /> One-Click Presentation Presets
                </span>
                <span className="text-xs font-normal text-muted-foreground">Pre-configured test passes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset('VALID')}
                  className="h-auto py-2 flex flex-col items-start text-left border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <span className="font-semibold text-xs flex items-center gap-1 text-emerald-600">
                    🟢 Valid Match
                  </span>
                  <span className="text-[10px] text-muted-foreground">Plate + QR Match (OPEN)</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset('MISMATCH')}
                  className="h-auto py-2 flex flex-col items-start text-left border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                >
                  <span className="font-semibold text-xs flex items-center gap-1 text-amber-600">
                    🟡 Mismatch
                  </span>
                  <span className="text-[10px] text-muted-foreground">Fraud Alert (HOLD)</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset('EXPIRED')}
                  className="h-auto py-2 flex flex-col items-start text-left border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <span className="font-semibold text-xs flex items-center gap-1 text-rose-600">
                    🔴 Expired
                  </span>
                  <span className="text-[10px] text-muted-foreground">Outdated Pass (REJECT)</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset('VISITOR')}
                  className="h-auto py-2 flex flex-col items-start text-left border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  <span className="font-semibold text-xs flex items-center gap-1 text-sky-600">
                    🔵 Visitor
                  </span>
                  <span className="text-[10px] text-muted-foreground">QR-Only Access (OPEN)</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Evaluation Form */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Scan className="h-5 w-5 text-primary" /> Live Gate Decision Simulator
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Plate OCR input */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Camera OCR Plate:
                  </label>
                  <Input
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AA67890 (or empty)"
                    className="font-mono text-sm font-bold uppercase"
                  />
                </div>

                {/* OCR Confidence */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    OCR Confidence (0..1):
                  </label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={ocrConfidence}
                    onChange={(e) => setOcrConfidence(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Gate Direction */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Gate Direction:
                  </label>
                  <div className="flex rounded-md border border-input p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setDirection('ENTRY')}
                      className={`flex-1 py-1 rounded text-xs font-semibold transition-all ${
                        direction === 'ENTRY' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      ENTRY
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('EXIT')}
                      className={`flex-1 py-1 rounded text-xs font-semibold transition-all ${
                        direction === 'EXIT' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      EXIT
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Payload Textarea */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Decoded QR Pass Payload (JSON / Token / String):
                </label>
                <textarea
                  value={qrPayload}
                  onChange={(e) => setQrPayload(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleEvaluate}
                disabled={loading}
                className="w-full font-bold shadow-md"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Evaluating Decision...
                  </>
                ) : (
                  <>
                    <DoorOpen className="mr-2 h-4 w-4" /> Trigger Gate Decision Evaluation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: SQLite Gate Audit Trail */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Live Gate Clearance Audit Trail (SQLite)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tamper-resistant audit log automatically recording every entry/exit event and clearance outcome.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {auditLogs.length} Recent Records
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Match Status</th>
                  <th className="px-4 py-2.5">Plate Number</th>
                  <th className="px-4 py-2.5">Ticket ID</th>
                  <th className="px-4 py-2.5">Pass Type</th>
                  <th className="px-4 py-2.5">Direction</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-foreground">#{log.id}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.timestamp.slice(0, 19).replace('T', ' ')}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          className={
                            log.action === 'OPEN'
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200'
                              : log.action === 'HOLD'
                              ? 'bg-amber-500/15 text-amber-600 border-amber-200'
                              : 'bg-rose-500/15 text-rose-600 border-rose-200'
                          }
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-foreground font-semibold">{log.match_status}</td>
                      <td className="px-4 py-2.5 font-bold text-foreground">{log.plate_number || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.ticket_id || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.pass_type || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-primary">{log.direction}</span>
                      </td>
                      <td className="px-4 py-2.5 font-sans text-muted-foreground max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground font-sans">
                      No gate clearance events recorded yet. Trigger an evaluation above to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
