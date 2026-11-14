'use client';

import React, { useState } from 'react';
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
import { api } from '@/src/services/api';
import { toast } from 'sonner';
import { Sliders, Loader2, ArrowRight } from 'lucide-react';

interface AdjustBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  plateNumber: string;
  currentBalance: number;
  onSuccess?: () => void;
}

export function AdjustBalanceModal({
  open,
  onOpenChange,
  vehicleId,
  plateNumber,
  currentBalance,
  onSuccess,
}: AdjustBalanceModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const newBalance = currentBalance + numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount) {
      toast.error('Please enter a non-zero adjustment amount.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Audit reason is required for balance adjustment.');
      return;
    }

    setLoading(true);
    try {
      await api.vehicleAccounts.adjustBalance(vehicleId, {
        amount: numAmount,
        reason: reason.trim(),
        reference: reference.trim() || undefined,
      });

      toast.success(`Adjusted balance by ${numAmount > 0 ? '+' : ''}${numAmount} ETB for ${plateNumber}`);
      onOpenChange(false);
      setAmount('');
      setReason('');
      setReference('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust balance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Manual Balance Adjustment</DialogTitle>
                <DialogDescription className="text-xs">
                  Administrative override to credit or debit vehicle financial balance
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-3.5">
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle Plate:</span>
                <span className="font-bold text-foreground">{plateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-mono font-bold text-foreground">{currentBalance.toFixed(2)} ETB</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-amount" className="text-xs font-semibold">
                Adjustment Amount (+ for Credit, - for Debit) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="adj-amount"
                type="number"
                step="any"
                required
                placeholder="e.g. 100 or -50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-reason" className="text-xs font-semibold">
                Audit Reason / Justification <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="adj-reason"
                required
                placeholder="e.g. Dispute resolution / Manual cash reimbursement"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-ref" className="text-xs text-muted-foreground">
                Document / Approval Reference (Optional)
              </Label>
              <Input
                id="adj-ref"
                placeholder="e.g. SUP-DISPUTE-2026-089"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Transition preview */}
            {numAmount !== 0 && (
              <div className="rounded-xl bg-muted/60 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resulting Balance:</span>
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span>{currentBalance.toFixed(2)} ETB</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={newBalance < 0 ? 'text-rose-500' : 'text-emerald-500 font-black'}>
                    {newBalance.toFixed(2)} ETB
                  </span>
                </div>
              </div>
            )}
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
              disabled={loading || numAmount === 0 || !reason.trim()}
              className="gap-2 bg-amber-600 text-white hover:bg-amber-700 font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Apply Adjustment</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
