'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/src/services/api';
import type {
  AccountStatsSummary,
  FastVehicleSearchResult,
  VehicleAccountTransaction,
} from '@/src/types/vehicle-account';
import { TopUpModal } from '@/src/components/vehicle-accounts/TopUpModal';
import { CardAssignModal } from '@/src/components/vehicle-accounts/CardAssignModal';
import { CardBlockModal } from '@/src/components/vehicle-accounts/CardBlockModal';
import { ReceiptPrintModal } from '@/src/components/vehicle-accounts/ReceiptPrintModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  CreditCard,
  Search,
  PlusCircle,
  AlertTriangle,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Banknote,
  Smartphone,
  Building,
  Contact2,
  Sliders,
  ExternalLink,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Ban,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';

export default function TopUpStationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FastVehicleSearchResult[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<FastVehicleSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<AccountStatsSummary | null>(null);
  const [recentTopups, setRecentTopups] = useState<VehicleAccountTransaction[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Modals state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockActionType, setBlockActionType] = useState<'BLOCK' | 'LOST'>('BLOCK');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch stats and recent topups
  const loadData = async () => {
    try {
      const [statsData, txnsData] = await Promise.all([
        api.vehicleAccounts.getStatsSummary(),
        api.vehicleAccounts.getTransactions({
          page: 1,
          pageSize: 8,
          filters: { type: 'TOPUP' },
        }),
      ]);
      setStats(statsData);
      setRecentTopups(txnsData.data || []);
    } catch (err) {
      console.error('Failed to load topup desk data', err);
    }
  };

  useEffect(() => {
    loadData();

    // Keyboard shortcut '/' to focus search
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.vehicleAccounts.search(searchQuery.trim());
        setSearchResults(results);
        if (results.length === 1 && !selectedVehicle) {
          setSelectedVehicle(results[0]);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectVehicle = (vehicle: FastVehicleSearchResult) => {
    setSelectedVehicle(vehicle);
  };

  const handleTopUpSuccess = (res: any) => {
    if (res.receiptData) {
      setActiveReceipt(res.receiptData);
      setReceiptModalOpen(true);
    }
    loadData();
    // Refresh selected vehicle balance
    if (selectedVehicle) {
      api.vehicleAccounts.search(selectedVehicle.plateNumber).then((results) => {
        if (results.length > 0) setSelectedVehicle(results[0]);
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Balance Top-Up & Card Station
              </h1>
              <p className="text-xs text-muted-foreground">
                Fast-lane vehicle lookup, RFID card assignment, and instant balance crediting
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
          <Link href="/vehicle-accounts">
            <Button variant="default" size="sm" className="gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              <span>All Vehicle Accounts</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Today's Top-Ups Total
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {(stats?.todayTopupsAmount ?? 0).toLocaleString()} <span className="text-xs font-semibold">ETB</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stats?.todayTopupsCount ?? 0} transactions today
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Banknote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active Transport Cards
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-primary">
                {stats?.activeCardsCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">RFID credentials active</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Contact2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Accounts with Debt
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-rose-500">
                {stats?.debtAccountsCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Outstanding balances</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Building className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Station Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Live Search & Search Results (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <span>Instant Vehicle / Card Search</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Type plate (e.g. <span className="font-mono text-primary">2-A12345</span>), RFID UID, or card number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  placeholder="Search plate, card number, UID... (Press / to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-9 pr-12 text-sm font-semibold tracking-wide"
                />
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <kbd className="pointer-events-none absolute right-3 top-3 inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  /
                </kbd>
              </div>

              {/* Live search results list */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {searching && (
                  <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                    Searching fleet accounts...
                  </p>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border p-4">
                    <p className="font-semibold">No vehicles found matching "{searchQuery}"</p>
                    <p className="mt-1 text-[11px]">Check plate spelling or card UID formatting</p>
                  </div>
                )}

                {searchResults.map((v) => {
                  const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
                  return (
                    <div
                      key={v.vehicleId}
                      onClick={() => handleSelectVehicle(v)}
                      className={`group cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-border bg-card/50 hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{v.plateNumber}</span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                              {v.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {v.model} · {v.groupName}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-mono font-bold text-sm ${
                              v.balance >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {v.balance.toFixed(2)} ETB
                          </span>
                          {v.hasDebt && (
                            <Badge variant="destructive" className="block text-[9px] mt-0.5 py-0 px-1">
                              DEBT
                            </Badge>
                          )}
                        </div>
                      </div>

                      {v.activeCard && (
                        <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3 text-primary" />
                            {v.activeCard.cardNumber}
                          </span>
                          <span className="text-[10px] uppercase text-emerald-500">Active</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!searchQuery && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <Sparkles className="h-5 w-5 mx-auto mb-1.5 text-primary/60" />
                    <p>Enter vehicle plate or scan RFID card to begin top-up</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Selected Vehicle Desk & Fast Top-Up Station (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {selectedVehicle ? (
            <Card className="border-border shadow-md bg-card/90 overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-primary via-emerald-500 to-sky-500" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Active Top-Up Terminal
                    </span>
                    <h2 className="text-2xl font-black text-foreground mt-0.5">
                      {selectedVehicle.plateNumber}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedVehicle.model} · {selectedVehicle.groupName} · Capacity: {selectedVehicle.capacity} seats
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Account Balance
                    </span>
                    <div className="mt-1">
                      <span
                        className={`font-mono text-3xl font-black tracking-tight ${
                          selectedVehicle.balance >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {selectedVehicle.balance.toFixed(2)}{' '}
                        <span className="text-sm font-bold">ETB</span>
                      </span>
                    </div>
                    {selectedVehicle.hasDebt && (
                      <Badge variant="destructive" className="mt-1 text-[10px] font-bold">
                        OUTSTANDING DEBT: {selectedVehicle.outstandingDebt.toFixed(2)} ETB
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* RFID Card Status Card */}
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Contact2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {selectedVehicle.activeCard ? selectedVehicle.activeCard.cardNumber : 'No RFID Card Linked'}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {selectedVehicle.activeCard
                          ? `UID: ${selectedVehicle.activeCard.cardUid}`
                          : 'Vehicle currently operating without linked RFID credential'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedVehicle.activeCard ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignModalOpen(true)}
                          className="h-8 text-xs font-semibold"
                        >
                          Replace Card
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBlockActionType('BLOCK');
                            setBlockModalOpen(true);
                          }}
                          className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Block
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAssignModalOpen(true)}
                        className="h-8 text-xs font-semibold text-primary border-primary/30"
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        Link Card
                      </Button>
                    )}
                  </div>
                </div>

                {/* Driver Info & Open Violations Alert */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-border p-3 bg-card">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Driver Info</span>
                    <span className="font-semibold text-foreground mt-1 block">
                      {selectedVehicle.driverName || 'Not Assigned'}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedVehicle.driverPhone || 'No Phone Registered'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border p-3 bg-card flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Violations</span>
                      <span className="font-semibold text-foreground mt-1 block">
                        {selectedVehicle.openViolationsCount > 0
                          ? `${selectedVehicle.openViolationsCount} Active Incident(s)`
                          : 'Clear / No Penalties'}
                      </span>
                    </div>
                    {selectedVehicle.openViolationsCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        Review
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Big Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={() => setTopUpModalOpen(true)}
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20"
                  >
                    <PlusCircle className="h-5 w-5" />
                    <span>Top-Up Balance</span>
                  </Button>

                  <Link href={`/vehicle-accounts/${selectedVehicle.vehicleId}`} className="flex-1">
                    <Button variant="outline" size="lg" className="w-full gap-2 font-semibold">
                      <span>View Account Hub</span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border border-dashed p-10 text-center flex flex-col items-center justify-center min-h-[320px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                <CreditCard className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-foreground">No Vehicle Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Select a vehicle from the search panel on the left to process balance top-ups, link RFID cards, or inspect account history.
              </p>
            </Card>
          )}

          {/* Recent Top-Up Transactions Feed */}
          <Card className="border-border shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Recent Desk Top-Ups</span>
                </CardTitle>
              </div>
              <Link href="/vehicle-accounts" className="text-[11px] font-semibold text-primary hover:underline">
                View Ledger
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentTopups.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">No top-ups recorded today yet</p>
                )}
                {recentTopups.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 px-4 flex items-center justify-between hover:bg-muted/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
                        +
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{t.plateNumber || 'Fleet Vehicle'}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {t.paymentMethod || 'CASH'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(t.createdAt), 'hh:mm a')} · By {t.performedBy}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +{t.amount.toFixed(2)} ETB
                      </span>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Bal: {t.balanceAfter.toFixed(2)} ETB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Dialogs */}
      {selectedVehicle && (
        <>
          <TopUpModal
            open={topUpModalOpen}
            onOpenChange={setTopUpModalOpen}
            vehicleId={selectedVehicle.vehicleId}
            plateNumber={selectedVehicle.plateNumber}
            currentBalance={selectedVehicle.balance}
            vehicleModel={selectedVehicle.model}
            activeCardNumber={selectedVehicle.activeCard?.cardNumber}
            onSuccess={handleTopUpSuccess}
          />

          <CardAssignModal
            open={assignModalOpen}
            onOpenChange={setAssignModalOpen}
            vehicleId={selectedVehicle.vehicleId}
            plateNumber={selectedVehicle.plateNumber}
            currentActiveCard={selectedVehicle.activeCard}
            onSuccess={() => {
              loadData();
              api.vehicleAccounts.search(selectedVehicle.plateNumber).then((results) => {
                if (results.length > 0) setSelectedVehicle(results[0]);
              });
            }}
          />

          {selectedVehicle.activeCard && (
            <CardBlockModal
              open={blockModalOpen}
              onOpenChange={setBlockModalOpen}
              cardId={selectedVehicle.activeCard.id}
              cardNumber={selectedVehicle.activeCard.cardNumber}
              cardUid={selectedVehicle.activeCard.cardUid}
              plateNumber={selectedVehicle.plateNumber}
              actionType={blockActionType}
              onSuccess={() => {
                loadData();
                api.vehicleAccounts.search(selectedVehicle.plateNumber).then((results) => {
                  if (results.length > 0) setSelectedVehicle(results[0]);
                });
              }}
            />
          )}
        </>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptPrintModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        receipt={activeReceipt}
      />
    </div>
  );
}
