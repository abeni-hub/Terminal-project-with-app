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
import { ShieldAlert, Loader2, Ban } from 'lucide-react';

interface CardBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardNumber: string;
  cardUid: string;
  plateNumber: string;
  actionType: 'BLOCK' | 'LOST';
  onSuccess?: () => void;
}

export function CardBlockModal({
  open,
  onOpenChange,
  cardId,
  cardNumber,
  cardUid,
  plateNumber,
  actionType,
  onSuccess,
}: CardBlockModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const isLost = actionType === 'LOST';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please specify a reason.');
      return;
    }

    setLoading(true);
    try {
      if (isLost) {
        await api.vehicleAccounts.markCardLost(cardId, reason.trim());
        toast.success(`Card ${cardNumber} marked as LOST.`);
      } else {
        await api.vehicleAccounts.blockCard(cardId, reason.trim());
        toast.success(`Card ${cardNumber} has been BLOCKED.`);
      }

      onOpenChange(false);
      setReason('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update card status.');
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
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isLost ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {isLost ? <ShieldAlert className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {isLost ? 'Mark Card as Lost' : 'Block Transport Card'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {isLost
                    ? 'Card will be deactivated and marked as lost.'
                    : 'Prevent unauthorized transactions and gate taps.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Vehicle Plate:</span>
                <span className="font-bold text-foreground">{plateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Card Number:</span>
                <span className="text-foreground">{cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Card UID:</span>
                <span className="text-foreground">{cardUid}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="block-reason" className="text-xs font-semibold">
                Reason for {isLost ? 'Loss' : 'Blocking'} <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="block-reason"
                required
                placeholder={isLost ? 'e.g. Reported misplaced by driver' : 'e.g. Driver violation / Damaged'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-xs"
              />
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
              variant={isLost ? 'default' : 'destructive'}
              disabled={loading || !reason.trim()}
              className="gap-2 font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLost ? 'Mark Card Lost' : 'Block Card'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
