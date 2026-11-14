'use client';

import { useState, useEffect } from 'react';
import {
  History, Search, Filter, RefreshCw, Eye, CheckCircle2,
  AlertTriangle, ShieldAlert, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ALPR_API_BASE } from '@/src/services/alpr-api';

interface EventItem {
  id: string;
  cameraId: string;
  cameraName: string;
  terminalName: string;
  cameraType: string;
  plateNumber: string;
  rawPlateNumber: string;
  confidence: number;
  capturedAt: string;
  processingResult: string;
  remarks?: string;
}

export default function RecognitionHistoryPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const url = new URL(`${ALPR_API_BASE}/recognition/events`);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('pageSize', '12');
      if (search) url.searchParams.set('search', search);
      if (resultFilter) url.searchParams.set('processingResult', resultFilter);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, resultFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'ACCEPTED': return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200">ACCEPTED</Badge>;
      case 'NOT_ASSIGNED': return <Badge variant="destructive">NOT ASSIGNED</Badge>;
      case 'UNKNOWN': return <Badge className="bg-amber-500/15 text-amber-600 border-amber-200">UNKNOWN</Badge>;
      case 'LOW_CONFIDENCE': return <Badge variant="secondary">LOW CONFIDENCE</Badge>;
      default: return <Badge variant="outline">{result}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ALPR Recognition History</h1>
          <p className="text-sm text-muted-foreground">
            Complete audit trail of captured vehicle license plates across terminal cameras.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by plate number..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Processing Results</option>
                <option value="ACCEPTED">ACCEPTED (Auto-Queued)</option>
                <option value="NOT_ASSIGNED">NOT ASSIGNED (Violation)</option>
                <option value="UNKNOWN">UNKNOWN (Unregistered)</option>
                <option value="LOW_CONFIDENCE">LOW CONFIDENCE</option>
                <option value="DUPLICATE">DUPLICATE</option>
              </select>
            </div>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Plate Number</th>
                  <th className="px-4 py-3">Camera / Terminal</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Captured At</th>
                  <th className="px-4 py-3 text-right">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      {e.plateNumber}
                      {e.rawPlateNumber && e.rawPlateNumber !== e.plateNumber && (
                        <span className="block text-[10px] text-muted-foreground font-normal">Raw: {e.rawPlateNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{e.cameraName}</p>
                      <p className="text-xs text-muted-foreground">{e.terminalName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {e.cameraType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                      {(e.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">{getResultBadge(e.processingResult)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(e.capturedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground truncate max-w-[200px]">
                      {e.remarks || '—'}
                    </td>
                  </tr>
                ))}

                {events.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No recognition events found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Total {total} recognition log entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs font-medium">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={events.length < 12}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
