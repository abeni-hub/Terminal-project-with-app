'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  QrCode, Scan, ShieldCheck, CheckCircle2, XCircle, AlertCircle,
  DoorOpen, Camera, FileText, RefreshCw, Upload, ArrowRight,
  ShieldAlert, Clock, Check, AlertTriangle, Sparkles, PlusCircle,
  Search, Download, RotateCcw, Ban, KeyRound, ExternalLink, ListFilter,
  Video, VideoOff, Zap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/src/store/auth-store';

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
  queue_dispatch?: {
    success?: boolean;
    error?: string;
    data?: {
      processingResult?: string;
      message?: string;
      queueEntry?: any;
    };
  };
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

interface QRPassItem {
  pass_id: string;
  plate_number: string;
  pass_type: string;
  holder_name: string;
  account_id?: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  max_uses: number;
  use_count: number;
  issued_at: string;
  valid_from: string;
  expires_at: string;
  revocation_reason?: string;
}

export default function QRGateScannerPage() {
  const session = useAuthStore((s) => s.session);
  const [activeTab, setActiveTab] = useState<'gate' | 'generator' | 'logs'>('gate');

  // Gate clearance states
  const [plateNumber, setPlateNumber] = useState('AA67890');
  const [ocrConfidence, setOcrConfidence] = useState('0.92');
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [qrPayload, setQrPayload] = useState(
    JSON.stringify(
      {
        pass_id: 'PASS-SUB-101',
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

  // Directly Connected Live Camera Opener/Closer & Auto-Scanner states
  const [cameraMode, setCameraMode] = useState<'browser' | 'host'>('browser');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [autoOpenCamera, setAutoOpenCamera] = useState(false);
  const [autoEvaluateOnScan, setAutoEvaluateOnScan] = useState(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hostCameras, setHostCameras] = useState<Array<{ deviceIndex: number; name: string; available: boolean }>>([]);
  const [selectedHostIdx, setSelectedHostIdx] = useState<string>('0');
  const [isHostCameraOpen, setIsHostCameraOpen] = useState(false);
  const [hostCamLoading, setHostCamLoading] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningFrame, setIsScanningFrame] = useState(false);
  const [lastLiveQrDetected, setLastLiveQrDetected] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanInFlightRef = useRef<boolean>(false);
  const recentScannedRef = useRef<Map<string, number>>(new Map());

  // QR Generator & Pass Management states
  const [passes, setPasses] = useState<QRPassItem[]>([]);
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('ALL');
  const [passesLoading, setPassesLoading] = useState(false);

  // Issue modal / form state
  const [newPlate, setNewPlate] = useState('');
  const [newPassType, setNewPassType] = useState('SUBSCRIBER');
  const [newHolder, setNewHolder] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('90');
  const [newMaxUses, setNewMaxUses] = useState('0');
  const [issueLoading, setIssueLoading] = useState(false);
  const [issuedPassResult, setIssuedPassResult] = useState<any | null>(null);

  // Action Dialogs
  const [selectedPass, setSelectedPass] = useState<QRPassItem | null>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewDays, setRenewDays] = useState('30');
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignPlateText, setReassignPlateText] = useState('');
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false);
  const [viewImageDataUri, setViewImageDataUri] = useState<string | null>(null);

  // Fetch gate audit logs
  const fetchAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/recognition-api/gate-audit-logs?limit=15');
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

  // Fetch QR passes list
  const fetchPasses = async () => {
    setPassesLoading(true);
    try {
      const params = new URLSearchParams();
      if (passSearch) params.set('search', passSearch);
      if (passStatusFilter !== 'ALL') params.set('status', passStatusFilter);
      params.set('limit', '50');

      const res = await fetch(`/recognition-api/qr-passes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPasses(data.passes || []);
      }
    } catch (err) {
      console.error('Failed to fetch QR passes:', err);
    } finally {
      setPassesLoading(false);
    }
  };

  // Enumerate directly connected browser cameras & host USB cameras
  const detectAllCameras = useCallback(async () => {
    setCameraError(null);
    // 1. Browser MediaDevices
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(cams);
        if (cams.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(cams[0].deviceId);
        }
      } catch (e) {
        console.warn('Could not enumerate browser cameras:', e);
      }
    }

    // 2. Host Server USB Cameras
    try {
      const res = await fetch('/recognition-api/detect-pc-cameras');
      if (res.ok) {
        const data = await res.json();
        setHostCameras(data.pc_cameras || []);
      }
    } catch (e) {
      console.warn('Could not probe host PC cameras:', e);
    }

    // 3. Check if host CAM-PC-01 is already running
    try {
      const res = await fetch('/recognition-api/cameras');
      if (res.ok) {
        const list = await res.json();
        const pcRunning = Array.isArray(list) && list.some((c: any) => c.cameraId === 'CAM-PC-01' && c.is_running);
        setIsHostCameraOpen(pcRunning);
      }
    } catch {
      // ignore
    }
  }, [selectedDeviceId]);

  // Shared Gate Evaluation helper
  const evaluateGateWithArgs = useCallback(
    async (qrTextOverride?: string, plateOverride?: string) => {
      const targetQr = (qrTextOverride ?? qrPayload).trim();
      const targetPlate = (plateOverride ?? plateNumber).trim();
      setLoading(true);
      try {
        const res = await fetch('/recognition-api/gate-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plateNumber: targetPlate || undefined,
            confidence: targetPlate ? parseFloat(ocrConfidence) || 0.92 : 0.0,
            qrCode: targetQr,
            direction: direction,
            terminalId: session?.user?.terminalId || undefined,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.detail || `Server returned error (${res.status}: ${res.statusText || 'Internal Error'})`);
        }

        const decision: GateDecisionResponse = await res.json();
        setLastDecision(decision);
        fetchAuditLogs();
        fetchPasses();
      } catch (err: any) {
        alert(`Error evaluating gate decision: ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [qrPayload, plateNumber, ocrConfidence, direction, session?.user?.terminalId]
  );

  // Handle a newly decoded QR string from live camera or image upload
  const handleDecodedQrInput = useCallback(
    async (rawText: string, detectedPlate?: string | null) => {
      if (!rawText) return;
      const now = Date.now();
      const lastSeen = recentScannedRef.current.get(rawText) || 0;
      if (now - lastSeen < 5000) {
        return; // 5-second live scan debounce to avoid repeated gate calls on same QR
      }
      recentScannedRef.current.set(rawText, now);

      setLastLiveQrDetected(rawText);
      setQrPayload(rawText);

      // Extract exact raw plate as encoded in QR JSON first (preserving formatting like AA-00215)
      let extractedPlate = '';
      try {
        const parsed = JSON.parse(rawText);
        if (parsed.plate_number || parsed.plateNumber) {
          extractedPlate = String(parsed.plate_number || parsed.plateNumber);
        }
      } catch {
        // ignore non-JSON
      }
      if (!extractedPlate && detectedPlate) {
        extractedPlate = detectedPlate;
      }
      if (extractedPlate) {
        setPlateNumber(extractedPlate);
      }

      setUploadStatus(`QR Read: ${rawText.slice(0, 60)}${rawText.length > 60 ? '...' : ''}`);
      if (autoEvaluateOnScan) {
        await evaluateGateWithArgs(rawText, extractedPlate || plateNumber);
      }
    },
    [autoEvaluateOnScan, evaluateGateWithArgs, plateNumber]
  );

  // Stop & Release Directly Connected Browser Camera
  const closeBrowserCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsScanningFrame(false);
    setCameraStatusMsg('Camera closed.');
  }, []);

  // Open Directly Connected Browser / USB Camera & Start Automatic QR Reading Loop
  const openBrowserCamera = useCallback(
    async (deviceIdOverride?: string) => {
      setCameraError(null);
      setCameraStatusMsg('Opening directly connected camera...');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        const isInsecureHttp = typeof window !== 'undefined' && !window.isSecureContext;
        setCameraError(
          isInsecureHttp
            ? `Browser blocked direct webcam on insecure HTTP (${window.location.origin}). To enable in Chrome: open chrome://flags/#unsafely-treat-insecure-origin-as-secure, add "${window.location.origin}", enable & relaunch — OR use "Host USB Camera" / "Device Camera Snapshot" below.`
            : 'Camera API (getUserMedia) is unavailable in this browser.'
        );
        setCameraStatusMsg(null);
        return;
      }

      // Stop any active stream before opening new one
      closeBrowserCamera();

      try {
        const devId = deviceIdOverride || selectedDeviceId;
        const constraints: MediaStreamConstraints = {
          video: devId
            ? { deviceId: { exact: devId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Attach stream to video element
        setIsCameraOpen(true);
        setCameraStatusMsg('Camera open! Point a QR pass at the lens to auto-scan.');

        // Wait a tick for videoRef to mount if hidden
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 50);

        // Refresh device labels now that permission was granted
        detectAllCameras();

        // Start automatic continuous QR frame scanner (every 650ms)
        const BarcodeDetectorCls = (window as any).BarcodeDetector;
        const detector = BarcodeDetectorCls ? new BarcodeDetectorCls({ formats: ['qr_code'] }) : null;

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || scanInFlightRef.current) return;
          scanInFlightRef.current = true;
          setIsScanningFrame(true);

          try {
            // 1. Fast native BarcodeDetector if supported by Chromium/Edge
            if (detector) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  await handleDecodedQrInput(barcodes[0].rawValue);
                  scanInFlightRef.current = false;
                  setIsScanningFrame(false);
                  return;
                }
              } catch {
                // fallback to backend OpenCV/pyzbar scanner
              }
            }

            // 2. Capture video frame to hidden canvas and send to Python QRScanner
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const res = await fetch('/recognition-api/scan-qr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    image: dataUrl,
                    plateNumber: plateNumber.trim() || undefined,
                    direction,
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.found && data.rawText) {
                    await handleDecodedQrInput(
                      data.rawText,
                      data.validation?.payload?.plate_number || null
                    );
                  }
                }
              }
            }
          } catch (scanErr) {
            console.warn('Frame QR scan error:', scanErr);
          } finally {
            scanInFlightRef.current = false;
            setIsScanningFrame(false);
          }
        }, 700);
      } catch (err: any) {
        setIsCameraOpen(false);
        setCameraStatusMsg(null);
        setCameraError(
          `Could not open camera: ${err?.message || err}. Ensure camera permissions are allowed and no other app is locking the webcam.`
        );
      }
    },
    [selectedDeviceId, closeBrowserCamera, detectAllCameras, handleDecodedQrInput, plateNumber, direction]
  );

  // Open / Close Host Server Directly-Connected USB Camera (CAM-PC-01)
  const openHostCamera = async () => {
    setHostCamLoading(true);
    setCameraError(null);
    try {
      const res = await fetch('/recognition-api/cameras/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: 'CAM-PC-01',
          terminalId: 'terminal-demo',
          cameraType: direction,
          sourceType: 'USB',
          sourceAddress: selectedHostIdx || '0',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to open host USB camera');
      }
      setIsHostCameraOpen(true);
      setCameraStatusMsg(`Host USB camera (Device #${selectedHostIdx}) opened on CAM-PC-01.`);
    } catch (err: any) {
      setCameraError(err.message);
    } finally {
      setHostCamLoading(false);
    }
  };

  const closeHostCamera = async () => {
    setHostCamLoading(true);
    try {
      await fetch('/recognition-api/cameras/stop/CAM-PC-01', { method: 'POST' });
      setIsHostCameraOpen(false);
      setCameraStatusMsg('Host USB camera closed.');
    } catch (err: any) {
      setCameraError(err.message);
    } finally {
      setHostCamLoading(false);
    }
  };

  // Toggle Auto-Open Camera preference
  const toggleAutoOpenCamera = () => {
    const next = !autoOpenCamera;
    setAutoOpenCamera(next);
    try {
      localStorage.setItem('qr_auto_open_camera', next ? '1' : '0');
    } catch {}
    if (next && !isCameraOpen && cameraMode === 'browser') {
      openBrowserCamera();
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchPasses();
    detectAllCameras();

    // Auto-open camera if user enabled Auto-Open
    let shouldAutoOpen = false;
    try {
      shouldAutoOpen = localStorage.getItem('qr_auto_open_camera') === '1';
      setAutoOpenCamera(shouldAutoOpen);
    } catch {}
    if (shouldAutoOpen) {
      openBrowserCamera();
    }

    return () => {
      // Automatically close camera hardware when leaving page
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Poll host camera live QR detections when Host USB camera mode is open
  useEffect(() => {
    if (!isHostCameraOpen || cameraMode !== 'host') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/recognition-api/cameras');
        if (!res.ok) return;
        const cams = await res.json();
        const pcCam = Array.isArray(cams) ? cams.find((c: any) => c.cameraId === 'CAM-PC-01') : null;
        if (pcCam?.latest_qr?.rawText) {
          handleDecodedQrInput(pcCam.latest_qr.rawText, pcCam.latest_qr.plateNumber);
        }
        if (pcCam?.latest_decision) {
          setLastDecision(pcCam.latest_decision);
        }
      } catch {}
    }, 1200);
    return () => clearInterval(timer);
  }, [isHostCameraOpen, cameraMode, handleDecodedQrInput]);

  // Preset Handlers for presentation
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
  const handleEvaluate = () => evaluateGateWithArgs();

  // Upload and scan QR image file or mobile camera snapshot directly
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Scanning image for QR code...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/recognition-api/scan-qr', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      if (data.found && data.rawText) {
        const decodedPlate = data.validation?.payload?.plate_number || null;
        await handleDecodedQrInput(data.rawText, decodedPlate);
      } else {
        setUploadStatus('No QR code detected in image. Ensure QR is clear and well-lit.');
      }
    } catch (err: any) {
      setUploadStatus(`Scan failed: ${err.message}`);
    }
  };

  // Issue New QR Pass
  const handleIssuePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueLoading(true);
    try {
      const res = await fetch('/recognition-api/qr-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateNumber: newPlate.trim(),
          passType: newPassType,
          holderName: newHolder.trim() || 'Fleet Vehicle',
          durationDays: parseInt(newDurationDays) || 90,
          maxUses: parseInt(newMaxUses) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to issue QR pass');
      }

      const data = await res.json();
      setIssuedPassResult(data.pass);
      setNewPlate('');
      setNewHolder('');
      fetchPasses();
    } catch (err: any) {
      alert(`Error issuing pass: ${err.message}`);
    } finally {
      setIssueLoading(false);
    }
  };

  // View QR Pass Image
  const handleViewQR = async (pass: QRPassItem) => {
    try {
      const res = await fetch(`/recognition-api/qr-passes/${pass.pass_id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPass(pass);
        setViewImageDataUri(data.qr_image_data_uri);
        setViewImageDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Renew Pass
  const handleRenew = async () => {
    if (!selectedPass) return;
    try {
      const res = await fetch(`/recognition-api/qr-passes/${selectedPass.pass_id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysToAdd: parseInt(renewDays) || 30 }),
      });
      if (res.ok) {
        setRenewDialogOpen(false);
        fetchPasses();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reassign Plate
  const handleReassign = async () => {
    if (!selectedPass || !reassignPlateText.trim()) return;
    try {
      const res = await fetch(`/recognition-api/qr-passes/${selectedPass.pass_id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlate: reassignPlateText.trim() }),
      });
      if (res.ok) {
        setReassignDialogOpen(false);
        setReassignPlateText('');
        fetchPasses();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Change Status (Suspend / Reactivate / Revoke)
  const handleStatusChange = async (pass: QRPassItem, newStatus: string) => {
    const reason = prompt(`Enter reason for setting status to ${newStatus}:`, 'Policy update');
    if (reason === null) return;
    try {
      const res = await fetch(`/recognition-api/qr-passes/${pass.pass_id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      if (res.ok) {
        fetchPasses();
      }
    } catch (err: any) {
      alert(err.message);
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
            Issue cryptographically signed vehicle passes, reconcile camera QR scans with ALPR plates, and auto-route to Incoming Pending queue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" asChild>
            <Link href="/queue">
              <DoorOpen className="mr-1.5 h-4 w-4" /> Incoming Pending Queue
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/recognition/dashboard">
              <Scan className="mr-1.5 h-4 w-4 text-primary" /> ALPR Live Feed
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid grid-cols-3 w-full sm:w-[500px]">
          <TabsTrigger value="gate" className="flex items-center gap-1.5">
            <DoorOpen className="h-4 w-4" /> Gate Clearance
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-1.5">
            <QrCode className="h-4 w-4" /> Pass Generator & Registry
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Gate Clearance Audit
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GATE CLEARANCE SIMULATOR */}
        <TabsContent value="gate" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: Barrier Gate Display (5 Cols) */}
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
                          <span className="font-mono font-bold text-emerald-600">#{lastDecision.audit_id || 'OK'}</span>
                        </div>
                      </div>

                      {lastDecision.action === 'OPEN' && (
                        <div
                          className={`p-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border ${
                            lastDecision.queue_dispatch?.success === false
                              ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                              : 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {lastDecision.queue_dispatch?.success === false ? (
                            <>
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>
                                Queue Dispatch Notice: {lastDecision.queue_dispatch?.error || 'Could not contact dispatch backend'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 shrink-0" />
                              <span>
                                {lastDecision.queue_dispatch?.data?.message || 'Auto-routed to Incoming Pending Tab in Queue'}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                      Awaiting QR ticket or plate scan to evaluate gate clearance policy.
                    </div>
                  )}

                  {/* Quick Image Scanner Upload & Camera Capture */}
                  <div className="pt-2 border-t border-border">
                    <label className="text-xs font-semibold text-muted-foreground block mb-2 text-left">
                      Scan QR Pass (File Upload or Mobile Camera Snapshot):
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        className="text-xs cursor-pointer file:cursor-pointer"
                      />
                    </div>
                    {uploadStatus && (
                      <p className="text-[11px] text-emerald-600 mt-1.5 text-left font-mono truncate">
                        {uploadStatus}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Directly Connected Camera Opener & Closer + Auto QR Reader */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" /> Direct Camera QR Scanner
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleAutoOpenCamera}
                      title="Automatically open directly connected camera when visiting this page"
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                        autoOpenCamera
                          ? 'bg-amber-500/15 text-amber-600 border-amber-300'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      Auto-Open: {autoOpenCamera ? 'ON' : 'OFF'}
                    </button>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        (cameraMode === 'browser' ? isCameraOpen : isHostCameraOpen)
                          ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                          : ''
                      }`}
                    >
                      {(cameraMode === 'browser' ? isCameraOpen : isHostCameraOpen) ? 'CAMERA OPEN' : 'CLOSED'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Source Mode Toggle: Client Browser Camera vs Host USB Camera */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setCameraMode('browser')}
                      className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                        cameraMode === 'browser'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      💻 Client Webcam
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraMode('host')}
                      className={`py-1.5 px-2 rounded-md font-medium transition-all ${
                        cameraMode === 'host'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      🔌 Server USB (CAM-PC-01)
                    </button>
                  </div>

                  {/* Camera Device Selector + Opener & Closer Button */}
                  {cameraMode === 'browser' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value);
                            if (isCameraOpen) openBrowserCamera(e.target.value);
                          }}
                          className="flex-1 h-9 rounded-md border border-input bg-background px-2.5 text-xs"
                        >
                          {videoDevices.length === 0 ? (
                            <option value="">Default Connected Camera</option>
                          ) : (
                            videoDevices.map((dev, idx) => (
                              <option key={dev.deviceId || idx} value={dev.deviceId}>
                                {dev.label || `Connected Camera #${idx + 1}`}
                              </option>
                            ))
                          )}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={detectAllCameras}
                          title="Detect connected cameras"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCameraOpen ? (
                          <Button
                            type="button"
                            onClick={() => openBrowserCamera()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            size="sm"
                          >
                            <Video className="mr-2 h-4 w-4" /> Open Camera
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={closeBrowserCamera}
                            className="flex-1 font-semibold"
                            size="sm"
                          >
                            <VideoOff className="mr-2 h-4 w-4" /> Close Camera
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => setAutoEvaluateOnScan((v) => !v)}
                          className={`px-2.5 h-9 rounded-md border text-[11px] font-medium transition-colors ${
                            autoEvaluateOnScan
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}
                          title="Automatically evaluate gate clearance as soon as QR is read"
                        >
                          {autoEvaluateOnScan ? '⚡ Auto-Gate ON' : 'Manual Gate'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedHostIdx}
                          onChange={(e) => setSelectedHostIdx(e.target.value)}
                          className="flex-1 h-9 rounded-md border border-input bg-background px-2.5 text-xs"
                        >
                          {hostCameras.length === 0 ? (
                            <option value="0">Server USB Device #0</option>
                          ) : (
                            hostCameras.map((hc) => (
                              <option key={hc.deviceIndex} value={String(hc.deviceIndex)}>
                                {hc.name} {hc.available ? '(Ready)' : '(Not Found)'}
                              </option>
                            ))
                          )}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={detectAllCameras}
                          title="Probe server USB cameras"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {!isHostCameraOpen ? (
                        <Button
                          type="button"
                          onClick={openHostCamera}
                          disabled={hostCamLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          size="sm"
                        >
                          <Video className="mr-2 h-4 w-4" />
                          {hostCamLoading ? 'Opening Host Camera...' : 'Open Server USB Camera'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={closeHostCamera}
                          disabled={hostCamLoading}
                          className="w-full font-semibold"
                          size="sm"
                        >
                          <VideoOff className="mr-2 h-4 w-4" />
                          {hostCamLoading ? 'Closing...' : 'Close Server USB Camera'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Error / Helper Notice */}
                  {cameraError && (
                    <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-300 text-amber-800 dark:text-amber-300 text-[11px] text-left leading-relaxed">
                      <span className="font-semibold block mb-0.5">Camera Notice:</span>
                      {cameraError}
                    </div>
                  )}
                  {cameraStatusMsg && !cameraError && (
                    <p className="text-[11px] text-muted-foreground text-left">{cameraStatusMsg}</p>
                  )}

                  {/* Live Camera Viewport */}
                  <div className="aspect-video w-full rounded-lg bg-black/95 border border-border overflow-hidden relative flex items-center justify-center">
                    {cameraMode === 'browser' ? (
                      <>
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          autoPlay
                          className={`w-full h-full object-cover ${isCameraOpen ? 'block' : 'hidden'}`}
                        />
                        {!isCameraOpen && (
                          <div className="text-center p-4 text-xs text-muted-foreground space-y-1.5">
                            <VideoOff className="h-8 w-8 mx-auto opacity-40" />
                            <p>Camera is closed.</p>
                            <p className="text-[11px] opacity-75">
                              Click <strong>Open Camera</strong> above to start live QR scanning.
                            </p>
                          </div>
                        )}
                        {isCameraOpen && (
                          <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              <div className="w-40 h-40 border-2 border-emerald-400/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                            </div>
                            <div className="absolute top-2 left-2 bg-black/75 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${isScanningFrame ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                              AUTO-SCAN ACTIVE
                            </div>
                          </>
                        )}
                      </>
                    ) : isHostCameraOpen ? (
                      <>
                        <img
                          src="/recognition-api/preview/CAM-PC-01"
                          alt="Host Camera Stream"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-2 left-2 bg-black/75 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          SERVER USB • CAM-PC-01
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 text-xs text-muted-foreground space-y-1.5">
                        <VideoOff className="h-8 w-8 mx-auto opacity-40" />
                        <p>Server USB Camera is closed.</p>
                        <p className="text-[11px] opacity-75">
                          Click <strong>Open Server USB Camera</strong> to stream directly connected host hardware.
                        </p>
                      </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  {lastLiveQrDetected && (
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono text-left truncate">
                      ✓ Last QR Read: {lastLiveQrDetected}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Presets & Form (7 Cols) */}
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

              {/* Form Simulator */}
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Scan className="h-5 w-5 text-primary" /> Live Gate Decision Simulator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        </TabsContent>

        {/* TAB 2: QR PASS GENERATOR & REGISTRY */}
        <TabsContent value="generator" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left: Issue Pass Form */}
            <div className="lg:col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-primary" /> Issue Vehicle QR Pass
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate tamper-resistant cryptographically signed digital passes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleIssuePass} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Vehicle Plate Number:
                      </label>
                      <Input
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                        placeholder="e.g. AA12345 (or leave empty for visitor)"
                        className="font-mono text-xs font-bold uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Pass Type:
                      </label>
                      <Select value={newPassType} onValueChange={setNewPassType}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SUBSCRIBER">SUBSCRIBER (Fleet / Monthly)</SelectItem>
                          <SelectItem value="VISITOR">VISITOR (Guest Access)</SelectItem>
                          <SelectItem value="PREPAID">PREPAID (Balance Pass)</SelectItem>
                          <SelectItem value="STAFF">STAFF (Terminal Operator)</SelectItem>
                          <SelectItem value="VIP">VIP (Priority Clearance)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Holder Name / Fleet Account:
                      </label>
                      <Input
                        value={newHolder}
                        onChange={(e) => setNewHolder(e.target.value)}
                        placeholder="e.g. Addis Express Association"
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">
                          Validity (Days):
                        </label>
                        <Input
                          type="number"
                          value={newDurationDays}
                          onChange={(e) => setNewDurationDays(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">
                          Max Uses (0 = unltd):
                        </label>
                        <Input
                          type="number"
                          value={newMaxUses}
                          onChange={(e) => setNewMaxUses(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={issueLoading} className="w-full text-xs font-bold mt-2">
                      {issueLoading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-4 w-4" /> Issue & Sign Pass
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Render newly issued pass preview */}
                  {issuedPassResult && (
                    <div className="mt-4 p-4 rounded-lg border bg-muted/30 text-center space-y-3">
                      <div className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Pass Issued: {issuedPassResult.pass_id}
                      </div>
                      <img
                        src={issuedPassResult.qr_image_data_uri}
                        alt="Generated QR Pass"
                        className="mx-auto w-36 h-36 rounded border bg-white p-2 shadow-sm"
                      />
                      <div className="text-[11px] font-mono text-muted-foreground break-all text-left bg-muted p-2 rounded">
                        Plate: <span className="font-bold text-foreground">{issuedPassResult.plate_number || 'N/A'}</span>
                        <br />
                        Expires: {issuedPassResult.expires_at}
                      </div>
                      <a
                        href={issuedPassResult.qr_image_data_uri}
                        download={`${issuedPassResult.pass_id}.png`}
                        className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download QR Image (PNG)
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Pass Registry Table */}
            <div className="lg:col-span-8 space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Active Digital Pass Registry
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Persistent SQLite pass registry with HMAC-SHA256 verification.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="/recognition-api/qr-passes-export" download="qr_passes.csv">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchPasses} disabled={passesLoading}>
                      <RefreshCw className={`h-3.5 w-3.5 ${passesLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search by Pass ID, Plate, or Holder..."
                        value={passSearch}
                        onChange={(e) => setPassSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchPasses()}
                        className="pl-8 text-xs"
                      />
                    </div>
                    <Select value={passStatusFilter} onValueChange={(v) => { setPassStatusFilter(v); }}>
                      <SelectTrigger className="w-[140px] text-xs">
                        <SelectValue placeholder="Status Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        <SelectItem value="REVOKED">REVOKED</SelectItem>
                        <SelectItem value="USED">USED</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="secondary" onClick={fetchPasses} className="text-xs">
                      Search
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                          <th className="px-3 py-2">Pass ID</th>
                          <th className="px-3 py-2">Plate</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Holder</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Uses</th>
                          <th className="px-3 py-2">Expires</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {passes.length > 0 ? (
                          passes.map((p) => (
                            <tr key={p.pass_id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 font-bold text-foreground">
                                <button
                                  type="button"
                                  onClick={() => handleViewQR(p)}
                                  className="text-primary hover:underline font-bold"
                                >
                                  {p.pass_id}
                                </button>
                              </td>
                              <td className="px-3 py-2 font-bold text-foreground">{p.plate_number || '—'}</td>
                              <td className="px-3 py-2 text-muted-foreground">{p.pass_type}</td>
                              <td className="px-3 py-2 font-sans text-muted-foreground max-w-[120px] truncate">
                                {p.holder_name}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={
                                    p.status === 'ACTIVE'
                                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200'
                                      : p.status === 'SUSPENDED'
                                      ? 'bg-amber-500/15 text-amber-600 border-amber-200'
                                      : 'bg-rose-500/15 text-rose-600 border-rose-200'
                                  }
                                >
                                  {p.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {p.use_count} / {p.max_uses === 0 ? '∞' : p.max_uses}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {p.expires_at.slice(0, 10)}
                              </td>
                              <td className="px-3 py-2 text-right space-x-1 font-sans">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px]"
                                  onClick={() => handleViewQR(p)}
                                  title="View QR Code"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px]"
                                  onClick={() => {
                                    setSelectedPass(p);
                                    setRenewDialogOpen(true);
                                  }}
                                  title="Renew Pass"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px]"
                                  onClick={() => {
                                    setSelectedPass(p);
                                    setReassignPlateText(p.plate_number);
                                    setReassignDialogOpen(true);
                                  }}
                                  title="Reassign Plate"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                                </Button>
                                {p.status === 'ACTIVE' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[11px]"
                                    onClick={() => handleStatusChange(p, 'SUSPENDED')}
                                    title="Suspend"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[11px]"
                                    onClick={() => handleStatusChange(p, 'ACTIVE')}
                                    title="Reactivate"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground font-sans">
                              No passes registered. Use the form on the left to issue one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: AUDIT LOGS */}
        <TabsContent value="logs" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Live Gate Clearance Audit Trail (SQLite)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tamper-resistant audit log automatically recording every entry/exit event, pass reconciliation, and clearance outcome.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={logsLoading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
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
                          <td className="px-4 py-2.5 font-semibold text-primary">{log.direction}</td>
                          <td className="px-4 py-2.5 font-sans text-muted-foreground max-w-xs truncate" title={log.reason}>
                            {log.reason}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground font-sans">
                          No gate clearance events recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: View QR Code Image */}
      <Dialog open={viewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> Vehicle QR Pass
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cryptographically signed pass ID: {selectedPass?.pass_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {viewImageDataUri && (
              <img
                src={viewImageDataUri}
                alt="QR Code"
                className="mx-auto w-48 h-48 rounded border bg-white p-3 shadow-md"
              />
            )}
            <div className="text-xs font-mono text-left bg-muted p-3 rounded space-y-1">
              <div>Plate: <span className="font-bold text-foreground">{selectedPass?.plate_number || 'VISITOR (No Plate)'}</span></div>
              <div>Type: <span className="font-semibold text-primary">{selectedPass?.pass_type}</span></div>
              <div>Holder: <span className="text-foreground">{selectedPass?.holder_name}</span></div>
              <div>Expires: <span className="text-muted-foreground">{selectedPass?.expires_at}</span></div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setViewImageDialogOpen(false)}>
              Close
            </Button>
            {viewImageDataUri && (
              <Button size="sm" asChild>
                <a href={viewImageDataUri} download={`${selectedPass?.pass_id}.png`}>
                  <Download className="mr-1.5 h-4 w-4" /> Download PNG
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Renew Pass */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" /> Renew Pass: {selectedPass?.pass_id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Extend the expiration date of this pass.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Days to Add:
              </label>
              <Input
                type="number"
                value={renewDays}
                onChange={(e) => setRenewDays(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenewDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRenew}>
              Confirm Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Reassign Plate */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-sky-600" /> Reassign Vehicle Plate
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update the vehicle license plate registered to pass {selectedPass?.pass_id}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                New License Plate:
              </label>
              <Input
                value={reassignPlateText}
                onChange={(e) => setReassignPlateText(e.target.value.toUpperCase())}
                placeholder="e.g. AA99887"
                className="font-mono text-xs font-bold uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleReassign} disabled={!reassignPlateText.trim()}>
              Save Reassignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
