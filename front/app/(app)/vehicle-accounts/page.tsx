'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/src/services/api';
import type { VehicleAccount, AccountStatsSummary } from '@/src/types/vehicle-account';
import { TopUpModal } from '@/src/components/vehicle-accounts/TopUpModal';
import { CardAssignModal } from '@/src/components/vehicle-accounts/CardAssignModal';
import { PenaltyConfigModal } from '@/src/components/vehicle-accounts/PenaltyConfigModal';
import { ReceiptPrintModal } from '@/src/components/vehicle-accounts/ReceiptPrintModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  WalletCards,
  Search,
  PlusCircle,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Contact2,
  ShieldAlert,
  Loader2,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function VehicleAccountsPage() {
  const [accounts, setAccounts] = useState<VehicleAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [debtFilter, setDebtFilter] = useState(false);

  // Stats
  const [stats, setStats] = useState<AccountStatsSummary | null>(null);

  // Modals state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedVehicleForTopUp, setSelectedVehicleForTopUp] = useState<VehicleAccount | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedVehicleForAssign, setSelectedVehicleForAssign] = useState<VehicleAccount | null>(null);

  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, statsData] = await Promise.all([
        api.vehicleAccounts.list({
          page,
          pageSize,
          search: search.trim() || undefined,
          filters: {
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            hasDebt: debtFilter ? true : undefined,
          },
        }),
        api.vehicleAccounts.getStatsSummary(),
      ]);

      setAccounts(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load vehicle accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, statusFilter, debtFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleTopUpSuccess = (res: any) => {
    if (res.receiptData) {
      setActiveReceipt(res.receiptData);
      setReceiptModalOpen(true);
    }
    loadData();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <WalletCards className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Vehicle Financial Accounts
            </h1>
            <p className="text-xs text-muted-foreground">
              Vehicle-linked balances, RFID cards, financial ledger, and outstanding debt monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPenaltyModalOpen(true)}
            className="gap-1.5 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Penalty Rules</span>
          </Button>

          <Link href="/topup">
            <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Fast Top-Up Station</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Fleet Accounts
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
                {stats?.totalAccounts ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Registered vehicle wallets</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <WalletCards className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active RFID Cards
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-primary">
                {stats?.activeCardsCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Cards actively linked</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Contact2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Today's Top-Up Volume
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {(stats?.todayTopupsAmount ?? 0).toLocaleString()} <span className="text-xs font-semibold">ETB</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{stats?.todayTopupsCount ?? 0} processed today</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Outstanding Debt
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-rose-500">
                {stats?.debtAccountsCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Vehicles with negative balance</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plate, model, card UID, or card number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
                Search
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Account Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="OUTSTANDING_DEBT">Outstanding Debt</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={debtFilter ? 'destructive' : 'outline'}
                size="sm"
                className="h-9 text-xs gap-1.5"
                onClick={() => {
                  setDebtFilter(!debtFilter);
                  setPage(1);
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Debt Only</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setDebtFilter(false);
                  setPage(1);
                  loadData();
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <TableHead>Vehicle & Plate</TableHead>
                <TableHead>Group & Type</TableHead>
                <TableHead>Linked RFID Card</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
                <TableHead className="text-center">Account Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading vehicle accounts...</span>
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                    No vehicle financial accounts found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => {
                  const isNegative = acc.balance < 0;
                  return (
                    <TableRow key={acc.id} className="hover:bg-muted/30 transition-colors text-xs">
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">
                          <Link
                            href={`/vehicle-accounts/${acc.vehicleId}`}
                            className="hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{acc.plateNumber}</span>
                          </Link>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {acc.vehicleModel || 'Fleet Vehicle'} {acc.driverName ? `· Driver: ${acc.driverName}` : ''}
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{acc.groupName || acc.groupId || 'N/A'}</span>
                          {acc.vehicleType && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-semibold">
                              {acc.vehicleType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {acc.activeCard ? (
                          <div className="font-mono text-xs">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <Contact2 className="h-3.5 w-3.5 text-primary" />
                              {acc.activeCard.cardNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground">UID: {acc.activeCard.cardUid}</span>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedVehicleForAssign(acc);
                              setAssignModalOpen(true);
                            }}
                            className="h-7 text-[11px] text-muted-foreground hover:text-primary p-0"
                          >
                            + Link Card
                          </Button>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-mono">
                        <span
                          className={`font-bold text-sm ${
                            isNegative
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {acc.balance.toFixed(2)} ETB
                        </span>
                        {isNegative && (
                          <span className="block text-[10px] text-rose-500 font-semibold">
                            Debt: {Math.abs(acc.balance).toFixed(2)} ETB
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0.5 px-2 font-semibold ${
                            acc.status === 'ACTIVE'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : acc.status === 'OUTSTANDING_DEBT'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {acc.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-[11px]">
                        {acc.lastTransactionAt
                          ? format(new Date(acc.lastTransactionAt), 'MMM dd, hh:mm a')
                          : 'No activity'}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => {
                              setSelectedVehicleForTopUp(acc);
                              setTopUpModalOpen(true);
                            }}
                          >
                            <PlusCircle className="h-3 w-3" />
                            <span>Top-Up</span>
                          </Button>

                          <Link href={`/vehicle-accounts/${acc.vehicleId}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>
              Showing <span className="font-semibold text-foreground">{accounts.length}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> accounts
            </p>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px]">Rows:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {selectedVehicleForTopUp && (
        <TopUpModal
          open={topUpModalOpen}
          onOpenChange={setTopUpModalOpen}
          vehicleId={selectedVehicleForTopUp.vehicleId}
          plateNumber={selectedVehicleForTopUp.plateNumber}
          currentBalance={selectedVehicleForTopUp.balance}
          vehicleModel={selectedVehicleForTopUp.vehicleModel}
          activeCardNumber={selectedVehicleForTopUp.activeCard?.cardNumber}
          onSuccess={handleTopUpSuccess}
        />
      )}

      {selectedVehicleForAssign && (
        <CardAssignModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          vehicleId={selectedVehicleForAssign.vehicleId}
          plateNumber={selectedVehicleForAssign.plateNumber}
          currentActiveCard={selectedVehicleForAssign.activeCard}
          onSuccess={loadData}
        />
      )}

      <PenaltyConfigModal
        open={penaltyModalOpen}
        onOpenChange={setPenaltyModalOpen}
        onSuccess={loadData}
      />

      <ReceiptPrintModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        receipt={activeReceipt}
      />
    </div>
  );
}
