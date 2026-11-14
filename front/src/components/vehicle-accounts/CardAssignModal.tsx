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
import { Switch } from '@/components/ui/switch';
import { api } from '@/src/services/api';
import { toast } from 'sonner';
import { Contact2, CreditCard, Loader2, Sparkles } from 'lucide-react';

interface CardAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  plateNumber: string;
  currentActiveCard?: {
    id: string;
    cardUid: string;
    cardNumber: string;
  } | null;
  onSuccess?: () => void;
}

export function CardAssignModal({
  open,
  onOpenChange,
  vehicleId,
  plateNumber,
  currentActiveCard,
  onSuccess,
}: CardAssignModalProps) {
  const isReplacing = Boolean(currentActiveCard);
  const [cardUid, setCardUid] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [reason, setReason] = useState('');
  const [chargeFee, setChargeFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState('50');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCardUid('');
      setCardNumber('');
      setReason(isReplacing ? 'Lost / Damaged card replacement' : '');
      setChargeFee(false);
      setFeeAmount('50');
    }
  }, [open, isReplacing]);

  // Quick generator for testing RFID cards without hardware
  const handleGenerateSimulatedCard = () => {
    const randomHex = Array.from({ length: 5 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase(),
    ).join('');
    const randomCardNo = `CARD-${plateNumber.replace(/[^A-Za-z0-9]/g, '')}-${Math.floor(
      100 + Math.random() * 900,
    )}`;

    setCardUid(randomHex);
    setCardNumber(randomCardNo);
    toast.info('Generated test RFID Card UID and Card Number');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardUid.trim() || !cardNumber.trim()) {
      toast.error('Card UID and Card Number are required.');
      return;
    }

    setLoading(true);
    try {
      if (isReplacing && currentActiveCard) {
        await api.vehicleAccounts.replaceCard({
          vehicleId,
          oldCardId: currentActiveCard.id,
          newCardUid: cardUid.trim(),
          newCardNumber: cardNumber.trim(),
          reason: reason.trim() || undefined,
          feeCharged: chargeFee,
          feeAmount: chargeFee ? parseFloat(feeAmount) || 0 : 0,
        });
        toast.success(`Replaced card with ${cardNumber} for vehicle ${plateNumber}!`);
      } else {
        await api.vehicleAccounts.linkCard({
          vehicleId,
          cardUid: cardUid.trim(),
          cardNumber: cardNumber.trim(),
        });
        toast.success(`Successfully linked card ${cardNumber} to vehicle ${plateNumber}!`);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign card.');
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Contact2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {isReplacing ? 'Replace Transport RFID Card' : 'Link Transport RFID Card'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {isReplacing
                    ? `Assign a new card to ${plateNumber}. Previous card will be archived.`
                    : `Link a physical or simulated RFID card to ${plateNumber}.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-3.5">
            {/* Current card notice if replacing */}
            {currentActiveCard && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                <p className="font-semibold">Current Active Card:</p>
                <p className="font-mono mt-0.5">
                  UID: {currentActiveCard.cardUid} · Number: {currentActiveCard.cardNumber}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  This card will automatically be marked REPLACED. Vehicle account balance will carry forward.
                </p>
              </div>
            )}

            {/* Simulated test button */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateSimulatedCard}
                className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Test UID</span>
              </Button>
            </div>

            {/* Card UID Input */}
            <div className="space-y-1.5">
              <Label htmlFor="card-uid" className="text-xs font-semibold">
                Card UID (Hardware Identifier) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="card-uid"
                  placeholder="e.g. 04A7B82C19 (10 hex characters)"
                  value={cardUid}
                  onChange={(e) => setCardUid(e.target.value.toUpperCase())}
                  required
                  className="font-mono text-sm tracking-wider uppercase pl-9"
                />
                <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Card Number Input */}
            <div className="space-y-1.5">
              <Label htmlFor="card-number" className="text-xs font-semibold">
                Card Number (Printed Barcode / Label) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="card-number"
                placeholder="e.g. CARD-2A12345-01"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="font-mono text-sm"
              />
            </div>

            {/* If replacing, reason and fee options */}
            {isReplacing && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="replace-reason" className="text-xs text-muted-foreground">
                    Replacement Reason
                  </Label>
                  <Input
                    id="replace-reason"
                    placeholder="e.g. Lost card / Damaged NFC chip"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="charge-fee" className="text-xs font-semibold cursor-pointer">
                      Charge Card Replacement Fee
                    </Label>
                    <Switch
                      id="charge-fee"
                      checked={chargeFee}
                      onCheckedChange={setChargeFee}
                    />
                  </div>
                  {chargeFee && (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="fee-amount" className="text-[11px] text-muted-foreground">
                        Fee Amount (ETB)
                      </Label>
                      <Input
                        id="fee-amount"
                        type="number"
                        min="0"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </>
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
              disabled={loading || !cardUid.trim() || !cardNumber.trim()}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isReplacing ? 'Confirm Replacement' : 'Link Card'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
