'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, CheckCircle2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

interface ReceiptData {
  transactionId: string;
  plateNumber: string;
  vehicleModel?: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod: string;
  paymentReference?: string;
  performedBy: string;
  createdAt: string | Date;
  description?: string;
}

interface ReceiptPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

export function ReceiptPrintModal({ open, onOpenChange, receipt }: ReceiptPrintModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!receipt) return null;

  const dateObj = typeof receipt.createdAt === 'string' ? new Date(receipt.createdAt) : receipt.createdAt;
  const formattedDate = format(dateObj, 'MMM dd, yyyy · hh:mm a');

  const handlePrint = () => {
    window.print();
  };

  const handleCopyRef = () => {
    if (receipt.paymentReference || receipt.transactionId) {
      navigator.clipboard.writeText(receipt.paymentReference || receipt.transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">Top-Up Receipt</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Official Financial Ledger Transaction Record
          </DialogDescription>
        </DialogHeader>

        <div className="receipt-paper my-2 rounded-xl border border-dashed border-border bg-muted/40 p-4 font-mono text-xs">
          <div className="border-b border-dashed border-border pb-3 text-center">
            <p className="font-bold uppercase tracking-wider text-foreground">Addis Ababa Transport Operations</p>
            <p className="text-[11px] text-muted-foreground">Vehicle Account Top-Up Station</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{formattedDate}</p>
          </div>

          <div className="space-y-2 py-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle Plate:</span>
              <span className="font-bold text-foreground">{receipt.plateNumber}</span>
            </div>
            {receipt.vehicleModel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle Model:</span>
                <span className="text-foreground">{receipt.vehicleModel}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method:</span>
              <span className="font-semibold text-foreground">{receipt.paymentMethod}</span>
            </div>
            {receipt.paymentReference && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reference / Slip:</span>
                <button
                  onClick={handleCopyRef}
                  className="flex items-center gap-1 font-semibold text-primary hover:underline"
                  title="Click to copy"
                >
                  <span>{receipt.paymentReference}</span>
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Officer:</span>
              <span className="text-foreground">{receipt.performedBy}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border py-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Previous Balance:</span>
              <span className="text-foreground">{receipt.balanceBefore.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Top-Up Amount Credited:</span>
              <span>+{receipt.amount.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold text-foreground">
              <span>New Available Balance:</span>
              <span className="text-primary">{receipt.balanceAfter.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border pt-2 text-center text-[10px] text-muted-foreground">
            <p>Txn ID: {receipt.transactionId}</p>
            <p className="mt-0.5">Thank you for keeping your account topped up.</p>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground">
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
