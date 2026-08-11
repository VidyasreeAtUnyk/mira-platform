/**
 * Market Intelligence page — DLD price index chart and upgrade calculator
 */

import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { PriceIndexChart } from './price-index-chart';
import { UpgradeCalculator } from '@/components/leads/upgrade-calculator';
import type { DLDPriceIndex } from '@/types';

export const revalidate = 3600;

export default async function IntelligencePage() {
  const supabase = await createClient();
  const { data: priceIndex } = await supabase
    .from('dld_price_index')
    .select('*')
    .order('first_date_of_month');

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-sm text-muted-foreground">Dubai real estate price trends</p>
        </div>

        <PriceIndexChart data={(priceIndex as DLDPriceIndex[]) ?? []} />

        <div>
          <h2 className="font-semibold mb-3">Upgrade Calculator</h2>
          <UpgradeCalculator priceIndex={(priceIndex as DLDPriceIndex[]) ?? []} />
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="font-medium mb-1">Data Source</p>
          <p>Price index data sourced from Dubai Land Department (DLD) public records. Index base = 100 at January 2019. Calculations are estimates for illustration purposes only and do not constitute a formal property valuation.</p>
        </div>
      </div>
    </AppShell>
  );
}
