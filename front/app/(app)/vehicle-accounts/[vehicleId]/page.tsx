'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/src/services/api';
import type { VehicleAccountDetail, VehicleAccountTransaction, TransportCard } from '@/src/types/vehicle-account';
import { TopUpModal } from '@/src/components/vehicle-accounts/TopUpModal';
import { CardAssignModal } from '@/src/components/vehicle-accounts/CardAssignModal';
import { CardBlockModal } from '@/src/components/vehicle-accounts/CardBlockModal';
import { AdjustBalanceModal } from '@/src/components/vehicle-accounts/AdjustBalanceModal';
import { ReceiptPrintModal } from '@/src/components/vehicle-accounts/ReceiptPrintModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  WalletCards,
  CreditCard,
  PlusCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Contact2,
  Receipt,
  History,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Ban,
  Printer,
  Download,
  Phone,
  User,
  ExternalLink,
  Loader2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';

export default function VehicleAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.vehicleId as string;

  const [detail, setDetail] = useState<VehicleAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [blockActionType, setBlockActionType] = useState<'BLOCK' | 'LOST'>('BLOCK');
  const [selectedCardForAction, setSelectedCardForAction] = useState<TransportCard | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);

  // Tab filter states
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
  const [transactionSearch, setTransactionSearch] = useState('');

  const loadAccountDetail = async () => {
    setLoading(true);
    try {
      const data = await api.vehicleAccounts.getById(vehicleId);
      setDetail(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load vehicle account details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      loadAccountDetail();
    }
  }, [vehicleId]);

  const handleTopUpSuccess = (res: any) => {
    if (res.receiptData) {
      setActiveReceipt(res.receiptData);
      setReceiptModalOpen(true);
    }
    loadAccountDetail();
  };

  const handleWaiveViolation = async (violationId: string) => {
    if (!confirm('Are you sure you want to waive this violation penalty? If charged, funds will be refunded to the vehicle account.')) {
      return;
    }
    try {
      await api.violations.resolve(violationId, {
        resolution: 'Waived by administrative review',
        resolutionAction: 'WAIVE',
        status: 'WAIVED',
      });
      toast.success('Violation penalty waived and balance refunded.');
      loadAccountDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to waive violation.');
    }
  };

  const handleExportCSV = () => {
    if (!detail || !detail.recentTransactions) return;
    const headers = ['ID', 'Date', 'Type', 'Amount (ETB)', 'Balance Before', 'Balance After', 'Method', 'Reference', 'Officer/Source', 'Description'];
    const rows = detail.recentTransactions.map((t) => [
      t.id,
      t.createdAt,
      t.type,
      t.amount,
      t.balanceBefore,
      t.balanceAfter,
      t.paymentMethod || '',
      t.paymentReference || '',
      t.performedBy,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_${detail.vehicle.plateNumber}_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading vehicle financial account...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
        <h3 className="text-base font-bold text-foreground">Vehicle Account Not Found</h3>
        <p className="text-xs text-muted-foreground mt-1">
          The requested vehicle identifier does not exist in the system.
        </p>
        <Link href="/vehicle-accounts" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Back to Vehicle Accounts
          </Button>
        </Link>
      </div>
    );
  }

  const { account, vehicle, stats, activeCard, cards, recentTransactions, violations } = detail;
  const isNegative = account.balance < 0;

  // Filtered transactions for the ledger tab
  const filteredTransactions = recentTransactions.filter((t) => {
    if (transactionTypeFilter !== 'ALL' && t.type !== transactionTypeFilter) return false;
    if (transactionSearch.trim()) {
      const q = transactionSearch.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const refMatch = (t.paymentReference || '').toLowerCase().includes(q);
      const officerMatch = (t.performedBy || '').toLowerCase().includes(q);
      if (!descMatch && !refMatch && !officerMatch) return false;
    }
    return true;
  });

  const topupHistory = recentTransactions.filter((t) => t.type === 'TOPUP');

  return (
    <div className="space-y-6 pb-12">
      {/* Back button & Breadcrumb header */}
      <div className="flex items-center justify-between">
        <Link
          href="/vehicle-accounts"
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Accounts</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAccountDetail}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Account Banner Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-md p-6">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {vehicle.plateNumber}
              </span>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-bold uppercase">
                {vehicle.type}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-bold ${
                  account.status === 'ACTIVE'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : account.status === 'OUTSTANDING_DEBT'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {account.status}
              </Badge>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {vehicle.model} · {vehicle.groupName || vehicle.groupId} · Capacity: {vehicle.capacity} seats · Status: {vehicle.status}
            </p>

            {activeCard ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-mono">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" />
                  {activeCard.cardNumber}
                </span>
                <span className="text-muted-foreground">· UID: {activeCard.cardUid}</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold text-emerald-500">
                  Active RFID
                </Badge>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>No active RFID card assigned to this vehicle</span>
              </div>
            )}
          </div>

          {/* Big Balance Display & Quick Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:text-right">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Available Balance
              </span>
              <div className="mt-0.5">
                <span
                  className={`font-mono text-4xl font-black tracking-tight ${
                    isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {account.balance.toFixed(2)}{' '}
                  <span className="text-lg font-bold">ETB</span>
                </span>
              </div>
              {isNegative && (
                <Badge variant="destructive" className="mt-1 text-[10px] font-bold">
                  DEBT: {Math.abs(account.balance).toFixed(2)} ETB
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
              <Button
                size="sm"
                onClick={() => setTopUpModalOpen(true)}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Top Up</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModalOpen(true)}
                className="gap-1.5 font-semibold"
              >
                <Contact2 className="h-4 w-4 text-primary" />
                <span>{activeCard ? 'Replace Card' : 'Link Card'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalOpen(true)}
                className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Adjust</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border bg-card/60">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Top-Ups Credited
            </span>
            <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              +{stats.totalTopups.toFixed(2)} ETB
            </span>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Dispatch Fees Paid
            </span>
            <span className="text-lg font-black font-mono text-foreground mt-0.5 block">
              -{stats.totalDispatchFees.toFixed(2)} ETB
            </span>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Penalties Incurred
            </span>
            <span className="text-lg font-black font-mono text-rose-500 mt-0.5 block">
              -{stats.totalPenalties.toFixed(2)} ETB
            </span>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Outstanding Debt
            </span>
            <span className={`text-lg font-black font-mono mt-0.5 block ${stats.hasDebt ? 'text-rose-500' : 'text-foreground'}`}>
              {stats.outstandingDebt.toFixed(2)} ETB
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 5 Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/80 p-1">
          <TabsTrigger value="overview" className="text-xs font-semibold gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs font-semibold gap-1.5">
            <History className="h-3.5 w-3.5" />
            <span>Transactions ({recentTransactions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="topups" className="text-xs font-semibold gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            <span>Top-Ups ({topupHistory.length})</span>
          </TabsTrigger>
          <TabsTrigger value="cards" className="text-xs font-semibold gap-1.5">
            <Contact2 className="h-3.5 w-3.5" />
            <span>Card History ({cards.length})</span>
          </TabsTrigger>
          <TabsTrigger value="violations" className="text-xs font-semibold gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Violations ({violations.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Driver & Account Details (4 cols) */}
            <div className="space-y-4 lg:col-span-4">
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Driver & Fleet Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Driver Name</span>
                      <span className="font-semibold text-foreground">{vehicle.driverName || 'Not Assigned'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Driver Phone</span>
                      <span className="font-mono font-medium text-foreground">{vehicle.driverPhone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-2.5 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fleet Group:</span>
                      <span className="font-semibold text-foreground">{vehicle.groupName || vehicle.groupId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Passenger Capacity:</span>
                      <span className="text-foreground">{vehicle.capacity} seats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Created:</span>
                      <span className="text-foreground">{format(new Date(account.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* RFID Card Details Widget */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Active RFID Credential</span>
                    {activeCard && <span className="text-emerald-500 font-bold">CONNECTED</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs">
                  {activeCard ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-border bg-muted/40 p-3 font-mono space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-sans">Card Number:</span>
                          <span className="font-bold text-foreground">{activeCard.cardNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-sans">Card UID:</span>
                          <span className="text-foreground">{activeCard.cardUid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-sans">Issued:</span>
                          <span className="text-muted-foreground">{format(new Date(activeCard.issuedAt), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignModalOpen(true)}
                          className="flex-1 text-xs"
                        >
                          Replace Card
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCardForAction(activeCard);
                            setBlockActionType('BLOCK');
                            setBlockModalOpen(true);
                          }}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Block
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-xs">No active card assigned</p>
                      <Button
                        size="sm"
                        onClick={() => setAssignModalOpen(true)}
                        className="mt-2 text-xs gap-1.5"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Link New Card</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Recent Ledger & Activity Feed (8 cols) */}
            <div className="space-y-4 lg:col-span-8">
              <Card className="border-border shadow-sm">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-primary" />
                    <span>Recent Financial Ledger</span>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleExportCSV} className="h-7 text-xs gap-1">
                    <Download className="h-3 w-3" />
                    <span>Export CSV</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {recentTransactions.length === 0 && (
                      <p className="py-8 text-center text-xs text-muted-foreground">No financial activity recorded yet</p>
                    )}
                    {recentTransactions.slice(0, 6).map((t) => {
                      const isCredit = t.amount > 0;
                      return (
                        <div
                          key={t.id}
                          className="p-3.5 px-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : t.type === 'PENALTY'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-primary/10 text-primary'
                              }`}
                            >
                              {isCredit ? '+' : '-'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{t.description}</span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                                  {t.type}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {format(new Date(t.createdAt), 'MMM dd, yyyy · hh:mm a')} · By {t.performedBy}
                                {t.paymentReference ? ` · Ref: ${t.paymentReference}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span
                              className={`font-bold text-sm ${
                                isCredit
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isCredit ? '+' : ''}{t.amount.toFixed(2)} ETB
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              Bal: {t.balanceAfter.toFixed(2)} ETB
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 2. Transactions Ledger Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-3 px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Input
                    placeholder="Search transaction description, ref, or officer..."
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Filter Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="TOPUP">TOPUP (+)</SelectItem>
                      <SelectItem value="DISPATCH_FEE">DISPATCH_FEE (-)</SelectItem>
                      <SelectItem value="PENALTY">PENALTY (-)</SelectItem>
                      <SelectItem value="REFUND">REFUND (+)</SelectItem>
                      <SelectItem value="ADJUSTMENT">ADJUSTMENT</SelectItem>
                      <SelectItem value="CARD_REPLACEMENT_FEE">REPLACEMENT_FEE (-)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description & Reference</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                        No transactions found matching filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((t) => {
                      const isCredit = t.amount > 0;
                      return (
                        <TableRow key={t.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {format(new Date(t.createdAt), 'MMM dd, yyyy · hh:mm a')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 px-1.5 font-mono font-semibold ${
                                t.type === 'TOPUP'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : t.type === 'PENALTY'
                                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'border-primary/30 bg-primary/10 text-primary'
                              }`}
                            >
                              {t.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground block">{t.description}</span>
                            {t.paymentReference && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Ref: {t.paymentReference} {t.paymentMethod ? `(${t.paymentMethod})` : ''}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.performedBy}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            <span
                              className={
                                isCredit
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {isCredit ? '+' : ''}{t.amount.toFixed(2)} ETB
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground font-semibold">
                            {t.balanceAfter.toFixed(2)} ETB
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Top-Ups Receipts Tab */}
        <TabsContent value="topups" className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Official Balance Top-Up Receipts
                </CardTitle>
                <CardDescription className="text-xs">
                  All credits and deposit transactions with payment references
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setTopUpModalOpen(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Top-Up</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt / Reference</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Collecting Officer</TableHead>
                    <TableHead className="text-right">Amount Credited</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topupHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                        No top-ups recorded for this vehicle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    topupHistory.map((t) => (
                      <TableRow key={t.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {format(new Date(t.createdAt), 'MMM dd, yyyy · hh:mm a')}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground">
                          {t.paymentReference || t.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {t.paymentMethod || 'CASH'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.performedBy}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{t.amount.toFixed(2)} ETB
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setActiveReceipt({
                                transactionId: t.id,
                                plateNumber: vehicle.plateNumber,
                                vehicleModel: vehicle.model,
                                amount: t.amount,
                                balanceBefore: t.balanceBefore,
                                balanceAfter: t.balanceAfter,
                                paymentMethod: t.paymentMethod || 'CASH',
                                paymentReference: t.paymentReference || t.id,
                                performedBy: t.performedBy,
                                createdAt: t.createdAt,
                                description: t.description,
                              });
                              setReceiptModalOpen(true);
                            }}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Receipt</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Card History Tab */}
        <TabsContent value="cards" className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Transport RFID Card Credential Lifecycle
                </CardTitle>
                <CardDescription className="text-xs">
                  History of all cards registered, replaced, or blocked for this vehicle
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAssignModalOpen(true)} className="gap-1.5 text-xs font-semibold">
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Assign New Card</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TableHead>Card Number</TableHead>
                    <TableHead>Hardware UID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued Date</TableHead>
                    <TableHead>Blocked / Replaced Date & Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                        No cards registered in history.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cards.map((c) => (
                      <TableRow key={c.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-bold text-foreground">
                          {c.cardNumber}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {c.cardUid}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-1.5 font-semibold ${
                              c.status === 'ACTIVE'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : c.status === 'BLOCKED'
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'border-muted text-muted-foreground'
                            }`}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {format(new Date(c.issuedAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {c.blockedAt ? (
                            <div>
                              <span>{format(new Date(c.blockedAt), 'MMM dd, yyyy')}</span>
                              {c.blockedReason && (
                                <span className="block text-[10px] italic text-rose-500">
                                  {c.blockedReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            'Active Credential'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === 'ACTIVE' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-amber-500 hover:bg-amber-500/10"
                                onClick={() => {
                                  setSelectedCardForAction(c);
                                  setBlockActionType('LOST');
                                  setBlockModalOpen(true);
                                }}
                              >
                                Lost
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-rose-500 hover:bg-rose-500/10"
                                onClick={() => {
                                  setSelectedCardForAction(c);
                                  setBlockActionType('BLOCK');
                                  setBlockModalOpen(true);
                                }}
                              >
                                Block
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Violations & Penalties Tab */}
        <TabsContent value="violations" className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dispatch Violations & Penalty Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Unauthorized departures, dispatch without payment, and regulatory infractions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <TableHead>Reported Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Fee & Penalty Breakdown</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Supervisor Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                        No violations recorded for this vehicle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    violations.map((v) => (
                      <TableRow key={v.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {format(new Date(v.reportedAt), 'MMM dd, yyyy · hh:mm a')}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-500/30">
                            {v.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md text-foreground">{v.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {v.totalAmountDue && v.totalAmountDue > 0 ? (
                            <div>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {v.totalAmountDue.toFixed(2)} ETB
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                Fee: {(v.originalDispatchFee || 0).toFixed(2)} + Fine: {(v.penaltyAmount || 0).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No financial fine</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-2 font-semibold ${
                              v.status === 'PAID' || v.status === 'RESOLVED'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : v.status === 'WAIVED'
                                ? 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {v.status === 'PENALTY_APPLIED' || v.status === 'OPEN' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-sky-600 hover:bg-sky-500/10"
                              onClick={() => handleWaiveViolation(v.id)}
                            >
                              Waive Penalty
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">{v.status}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Dialogs */}
      <TopUpModal
        open={topUpModalOpen}
        onOpenChange={setTopUpModalOpen}
        vehicleId={vehicle.id}
        plateNumber={vehicle.plateNumber}
        currentBalance={account.balance}
        vehicleModel={vehicle.model}
        activeCardNumber={activeCard?.cardNumber}
        onSuccess={handleTopUpSuccess}
      />

      <CardAssignModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        vehicleId={vehicle.id}
        plateNumber={vehicle.plateNumber}
        currentActiveCard={activeCard}
        onSuccess={loadAccountDetail}
      />

      {selectedCardForAction && (
        <CardBlockModal
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
          cardId={selectedCardForAction.id}
          cardNumber={selectedCardForAction.cardNumber}
          cardUid={selectedCardForAction.cardUid}
          plateNumber={vehicle.plateNumber}
          actionType={blockActionType}
          onSuccess={loadAccountDetail}
        />
      )}

      <AdjustBalanceModal
        open={adjustModalOpen}
        onOpenChange={setAdjustModalOpen}
        vehicleId={vehicle.id}
        plateNumber={vehicle.plateNumber}
        currentBalance={account.balance}
        onSuccess={loadAccountDetail}
      />

      <ReceiptPrintModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        receipt={activeReceipt}
      />
    </div>
  );
}
