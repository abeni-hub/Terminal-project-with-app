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
import { api } from '@/src/services/api';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, DollarSign, Percent, Calculator } from 'lucide-react';

interface PenaltyConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PenaltyConfigModal({ open, onOpenChange, onSuccess }: PenaltyConfigModalProps) {
  const [ruleType, setRuleType] = useState<string>('FIXED_AMOUNT');
  const [amount, setAmount] = useState<string>('50');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      setFetching(true);
      api.vehicleAccounts
        .getPenaltyConfig()
        .then((config) => {
          if (config) {
            setRuleType(config.ruleType || 'FIXED_AMOUNT');
            setAmount(String(config.amount ?? 50));
            setDescription(config.description || '');
          }
        })
        .catch((err) => {
          toast.error('Failed to load current penalty configuration');
        })
        .finally(() => setFetching(false));
    }
  }, [open]);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.vehicleAccounts.updatePenaltyConfig({
        ruleType,
        amount: numAmount,
        description: description.trim() || undefined,
        active: true,
      });

      toast.success('Updated unauthorized departure penalty configuration!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update penalty configuration.');
    } finally {
      setLoading(false);
    }
  };

  const getExampleCalculation = () => {
    const sampleFee = 25; // 25 ETB standard bus fee
    let penalty = 50;
    if (ruleType === 'FIXED_AMOUNT') {
      penalty = numAmount;
    } else if (ruleType === 'PERCENTAGE_OF_FEE') {
      penalty = (sampleFee * numAmount) / 100;
    } else if (ruleType === 'FEE_MULTIPLIER') {
      penalty = sampleFee * numAmount;
    }
    return {
      sampleFee,
      penalty,
      total: sampleFee + penalty,
    };
  };

  const example = getExampleCalculation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Unauthorized Departure Penalty Rule</DialogTitle>
                <DialogDescription className="text-xs">
                  Configure the penalty fine automatically charged when a vehicle leaves without valid dispatch
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {fetching ? (
            <div className="py-8 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="my-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rule-type" className="text-xs font-semibold">
                  Penalty Calculation Method
                </Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger id="rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_AMOUNT">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <span>Fixed Amount (e.g. 50 ETB)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="PERCENTAGE_OF_FEE">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-sky-500" />
                        <span>Percentage of Dispatch Fee (e.g. 150%)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="FEE_MULTIPLIER">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-amber-500" />
                        <span>Dispatch Fee Multiplier (e.g. 2.0x Fee)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="penalty-value" className="text-xs font-semibold">
                  {ruleType === 'FIXED_AMOUNT' && 'Fixed Penalty Amount (ETB)'}
                  {ruleType === 'PERCENTAGE_OF_FEE' && 'Fee Percentage (%)'}
                  {ruleType === 'FEE_MULTIPLIER' && 'Fee Multiplier Factor'}
                </Label>
                <Input
                  id="penalty-value"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="penalty-desc" className="text-xs text-muted-foreground">
                  Policy Description / Reference
                </Label>
                <Input
                  id="penalty-desc"
                  placeholder="e.g. Municipal Transport Directive #2026-B"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Simulation example */}
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  <span>Calculation Example (for a 25 ETB Standard Dispatch Fee):</span>
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="rounded-lg bg-card p-2 border border-border">
                    <span className="text-muted-foreground block text-[10px]">Base Fee</span>
                    <span className="font-bold text-foreground">25.00 ETB</span>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border">
                    <span className="text-muted-foreground block text-[10px]">Penalty</span>
                    <span className="font-bold text-rose-500">+{example.penalty.toFixed(2)} ETB</span>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 border border-primary/30">
                    <span className="text-primary block text-[10px] font-bold">Total Charged</span>
                    <span className="font-bold text-primary">{example.total.toFixed(2)} ETB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              disabled={loading || fetching}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save Penalty Configuration</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
