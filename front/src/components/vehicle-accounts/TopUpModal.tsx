'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api } from '@/src/services/api';
import { toast } from 'sonner';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  ArrowRight,
  Loader2,
  Receipt,
  AlertCircle,
} from 'lucide-react';

interface TopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId?: string;
  plateNumber?: string;
  currentBalance?: number;
  vehicleModel?: string;
  activeCardNumber?: string;
  onSuccess?: (result: any) => void;
}

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

export function TopUpModal({
  open,
  onOpenChange,
  vehicleId,
  plateNumber,
  currentBalance = 0,
  vehicleModel,
  activeCardNumber,
  onSuccess,
}: TopUpModalProps) {
  const [amount, setAmount] = useState<string>('200');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setAmount('200');
      setPaymentMethod('CASH');
      setPaymentReference(`REC-${Math.floor(100000 + Math.random() * 900000)}`);
      setNotes('');
    }
  }, [open]);

  const numAmount = parseFloat(amount) || 0;
  const newBalance = currentBalance + numAmount;
  const isClearingDebt = currentBalance < 0 && newBalance >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid top-up amount greater than 0 ETB.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.vehicleAccounts.topUp({
        vehicleId,
        plateNumber,
        amount: numAmount,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(`Successfully topped up ${numAmount} ETB for ${plateNumber || 'vehicle'}!`);
      onOpenChange(false);
      if (onSuccess) {
        onSuccess({
          ...res,
          receiptData: {
            transactionId: res.transaction.id,
            plateNumber: plateNumber || res.account.plateNumber,
            vehicleModel,
            amount: numAmount,
            balanceBefore: currentBalance,
            balanceAfter: res.account.balance,
            paymentMethod,
            paymentReference: res.transaction.paymentReference,
            performedBy: res.transaction.performedBy,
            createdAt: res.transaction.createdAt,
            description: res.transaction.description,
          },
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process top-up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Top-Up Vehicle Account</DialogTitle>
                <DialogDescription className="text-xs">
                  Credit funds to vehicle balance with instant ledger logging
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-4">
            {/* Vehicle Card Header */}
            <div className="rounded-xl border border-border bg-card/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Target Vehicle
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-bold text-foreground">{plateNumber || 'Selected Vehicle'}</span>
                    {vehicleModel && (
                      <span className="text-xs text-muted-foreground">({vehicleModel})</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Current Balance
                  </span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className={`font-mono text-sm px-2.5 py-0.5 font-bold ${
                        currentBalance >= 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {currentBalance.toFixed(2)} ETB
                    </Badge>
                  </div>
                </div>
              </div>

              {activeCardNumber && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  <span>Linked Card: </span>
                  <span className="font-mono font-medium text-foreground">{activeCardNumber}</span>
                </div>
              )}
            </div>

            {/* Presets */}
            <div>
              <Label className="text-xs text-muted-foreground">Quick Amount Preset (ETB)</Label>
              <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                {PRESET_AMOUNTS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={amount === String(preset) ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 font-semibold text-xs transition-all"
                    onClick={() => setAmount(String(preset))}
                  >
                    +{preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount" className="text-xs font-semibold">
                Top-Up Amount (ETB) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="topup-amount"
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-base font-bold font-mono"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">ETB</span>
              </div>
            </div>

            {/* Payment Method & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="payment-method" className="text-xs font-semibold">
                  Payment Method
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method" className="h-9">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-500" />
                        <span>Cash</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="TELEBIRR">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-sky-500" />
                        <span>Telebirr</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="CBE_BIRR">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-amber-500" />
                        <span>CBE Birr</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-purple-500" />
                        <span>Bank Transfer</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="OTHER">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <span>Other / Voucher</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-ref" className="text-xs font-semibold">
                  Slip / Reference Code
                </Label>
                <Input
                  id="payment-ref"
                  placeholder="e.g. REC-892144, TT-901..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="topup-notes" className="text-xs text-muted-foreground">
                Officer Notes (Optional)
              </Label>
              <Input
                id="topup-notes"
                placeholder="e.g. Paid at Station Desk 1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Balance Preview Card */}
            <div className="rounded-xl bg-muted/60 p-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground">Balance Transition</span>
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className={currentBalance < 0 ? 'text-rose-500' : 'text-foreground'}>
                    {currentBalance.toFixed(2)} ETB
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-primary text-sm font-black">
                    {newBalance.toFixed(2)} ETB
                  </span>
                </div>
              </div>

              {isClearingDebt && (
                <div className="flex items-center gap-1 text-emerald-500 font-semibold text-[11px] bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Clears Debt!</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || numAmount <= 0}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Confirm Top-Up ({numAmount} ETB)</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
