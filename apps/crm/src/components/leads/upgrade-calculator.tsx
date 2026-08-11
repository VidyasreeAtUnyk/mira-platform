/**
 * UpgradeCalculator — DLD price index based equity calculator
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calculator } from 'lucide-react';
import { formatAED } from '@/lib/utils';
import type { DLDPriceIndex, UpgradeCalculation } from '@/types';

interface UpgradeCalculatorProps {
  priceIndex: DLDPriceIndex[];
  prefillPropertyType?: 'apartment' | 'villa';
  prefillPurchaseYear?: number;
  prefillPurchasePrice?: number;
}

export function UpgradeCalculator({
  priceIndex,
  prefillPropertyType,
  prefillPurchaseYear,
  prefillPurchasePrice,
}: UpgradeCalculatorProps) {
  const [propertyType, setPropertyType] = useState<'apartment' | 'villa'>(
    prefillPropertyType ?? 'apartment'
  );
  const [purchaseYear, setPurchaseYear] = useState(prefillPurchaseYear?.toString() ?? '');
  const [purchasePrice, setPurchasePrice] = useState(prefillPurchasePrice?.toString() ?? '');
  const [result, setResult] = useState<UpgradeCalculation | null>(null);

  function calculate() {
    const year = parseInt(purchaseYear);
    const price = parseFloat(purchasePrice);
    if (!year || !price || priceIndex.length === 0) return;

    // Find purchase month index (use January of purchase year)
    const purchaseRow = priceIndex.find(
      (row) => new Date(row.first_date_of_month).getFullYear() === year
    ) ?? priceIndex.find(
      (row) => new Date(row.first_date_of_month).getFullYear() === year + 1
    );

    if (!purchaseRow) return;

    // Current = most recent entry
    const currentRow = priceIndex[priceIndex.length - 1];

    const indexKey = propertyType === 'apartment' ? 'flat_monthly_index' : 'villa_monthly_index';
    const purchaseIndex = purchaseRow[indexKey] ?? purchaseRow.all_monthly_index ?? 100;
    const currentIndex = currentRow[indexKey] ?? currentRow.all_monthly_index ?? 100;

    const estimatedCurrentValue = price * ((currentIndex as number) / (purchaseIndex as number));
    const equityGained = estimatedCurrentValue - price;
    const equityPercentage = (equityGained / price) * 100;

    setResult({
      purchasePrice: price,
      purchaseYear: year,
      propertyType,
      purchaseIndex: purchaseIndex as number,
      currentIndex: currentIndex as number,
      estimatedCurrentValue,
      equityGained,
      equityPercentage,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="h-4 w-4 text-primary" />
          Upgrade Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Property Type</Label>
            <Select
              value={propertyType}
              onValueChange={(v) => setPropertyType(v as 'apartment' | 'villa')}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purchase Year</Label>
            <Input
              className="h-9"
              placeholder="e.g. 2019"
              value={purchaseYear}
              onChange={(e) => setPurchaseYear(e.target.value)}
              type="number"
              min="2010"
              max="2026"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Purchase Price (AED)</Label>
          <Input
            placeholder="e.g. 950000"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            type="number"
          />
        </div>

        <Button onClick={calculate} size="sm" className="w-full" disabled={!purchaseYear || !purchasePrice}>
          Calculate Equity
        </Button>

        {result && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Estimated Equity</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Purchase Price</p>
                <p className="text-sm font-medium">{formatAED(result.purchasePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Current Value</p>
                <p className="text-sm font-medium text-green-700">
                  {formatAED(result.estimatedCurrentValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Equity Gained</p>
                <p className="text-sm font-semibold text-green-700">
                  {formatAED(result.equityGained)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Return</p>
                <p className="text-sm font-semibold text-green-700">
                  +{result.equityPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on DLD price index. For illustration only — not a formal valuation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
