'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/src/services/api';
import type { TransportCard } from '@/src/types/vehicle-account';
import { CardBlockModal } from '@/src/components/vehicle-accounts/CardBlockModal';
import { CardAssignModal } from '@/src/components/vehicle-accounts/CardAssignModal';
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
  Contact2,
  Search,
  PlusCircle,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function TransportCardsPage() {
  const [cards, setCards] = useState<TransportCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockActionType, setBlockActionType] = useState<'BLOCK' | 'LOST'>('BLOCK');
  const [selectedCardForAction, setSelectedCardForAction] = useState<TransportCard | null>(null);

  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [selectedCardForReplace, setSelectedCardForReplace] = useState<TransportCard | null>(null);

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await api.vehicleAccounts.getCards({
        page,
        pageSize,
        search: search.trim() || undefined,
        filters: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        },
      });
      setCards(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load transport cards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCards();
  };

  const activeCount = cards.filter((c) => c.status === 'ACTIVE').length;
  const blockedCount = cards.filter((c) => c.status === 'BLOCKED').length;
  const lostCount = cards.filter((c) => c.status === 'LOST').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Contact2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Transport RFID Cards Registry
            </h1>
            <p className="text-xs text-muted-foreground">
              RFID card issuance, vehicle credential linking, and lifecycle management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/topup">
            <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Link Card to Vehicle</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Cards Registered
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{total}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">In database ledger</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Contact2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active Credentials
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Authorized for terminal gate</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Blocked Cards
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-rose-500">{blockedCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Restricted from operation</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Lost / Archived
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-amber-500">{lostCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Misplaced or replaced</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter toolbar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Card UID, Card Number, Vehicle Plate, or Issuer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
                Search
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="REPLACED">Replaced</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setPage(1);
                  loadCards();
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
                <TableHead>Card Number & UID</TableHead>
                <TableHead>Linked Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Issued By</TableHead>
                <TableHead>Remarks / Block Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading transport cards...</span>
                  </TableCell>
                </TableRow>
              ) : cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                    No transport cards found.
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30 transition-colors text-xs">
                    <TableCell>
                      <div className="font-mono font-bold text-sm text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        <span>{c.cardNumber}</span>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">UID: {c.cardUid}</span>
                    </TableCell>

                    <TableCell>
                      {c.plateNumber ? (
                        <Link
                          href={`/vehicle-accounts/${c.vehicleId}`}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{c.plateNumber}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-2 font-semibold ${
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

                    <TableCell className="text-muted-foreground">{c.createdBy}</TableCell>

                    <TableCell className="text-muted-foreground text-[11px] max-w-xs">
                      {c.blockedReason ? (
                        <span className="text-rose-500 font-medium italic">{c.blockedReason}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {c.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSelectedCardForReplace(c);
                              setReplaceModalOpen(true);
                            }}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Replace
                          </Button>
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
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>
              Showing <span className="font-semibold text-foreground">{cards.length}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> cards
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
      {selectedCardForAction && (
        <CardBlockModal
          open={blockModalOpen}
          onOpenChange={setBlockModalOpen}
          cardId={selectedCardForAction.id}
          cardNumber={selectedCardForAction.cardNumber}
          cardUid={selectedCardForAction.cardUid}
          plateNumber={selectedCardForAction.plateNumber || ''}
          actionType={blockActionType}
          onSuccess={loadCards}
        />
      )}

      {selectedCardForReplace && (
        <CardAssignModal
          open={replaceModalOpen}
          onOpenChange={setReplaceModalOpen}
          vehicleId={selectedCardForReplace.vehicleId}
          plateNumber={selectedCardForReplace.plateNumber || ''}
          currentActiveCard={{
            id: selectedCardForReplace.id,
            cardUid: selectedCardForReplace.cardUid,
            cardNumber: selectedCardForReplace.cardNumber,
          }}
          onSuccess={loadCards}
        />
      )}
    </div>
  );
}
