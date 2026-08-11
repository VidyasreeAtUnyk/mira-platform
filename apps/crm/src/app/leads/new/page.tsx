/**
 * New lead form — mobile-optimised, completable in 30 seconds
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import {
  LEAD_TYPES,
  PROPERTY_TYPES,
  BEDROOM_OPTIONS,
  LEAD_SOURCES,
  DUBAI_AREAS,
} from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { LeadType, PropertyType, BedroomOption, LeadSource } from '@/types';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ownsProperty, setOwnsProperty] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    lead_type: '' as LeadType | '',
    property_type: '' as PropertyType | '',
    budget_min: '',
    budget_max: '',
    bedrooms: '' as BedroomOption | '',
    source: '' as LeadSource | '',
    notes: '',
    preferred_areas: [] as string[],
    owned_property_type: '' as PropertyType | '',
    owned_property_area: '',
    owned_purchase_year: '',
    owned_purchase_price: '',
  });

  function toggleArea(area: string) {
    setForm((f) => ({
      ...f,
      preferred_areas: f.preferred_areas.includes(area)
        ? f.preferred_areas.filter((a) => a !== area)
        : [...f.preferred_areas, area],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.lead_type) return;

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        agent_id: user.id,
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        lead_type: form.lead_type,
        property_type: form.property_type || null,
        budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
        budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
        bedrooms: form.bedrooms || null,
        source: form.source || null,
        notes: form.notes || null,
        preferred_areas: form.preferred_areas.length > 0 ? form.preferred_areas : null,
        owns_property: ownsProperty,
        owned_property_type: ownsProperty ? form.owned_property_type || null : null,
        owned_property_area: ownsProperty ? form.owned_property_area || null : null,
        owned_purchase_year: ownsProperty && form.owned_purchase_year ? parseInt(form.owned_purchase_year) : null,
        owned_purchase_price: ownsProperty && form.owned_purchase_price ? parseFloat(form.owned_purchase_price) : null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Trigger AI scoring in background
    fetch('/api/leads/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id }),
    }).catch(() => {}); // fire and forget

    router.push(`/leads/${lead.id}`);
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/leads">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">New Lead</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Mohammed Al-Farsi"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lead type & property */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Lead Type *</Label>
                  <Select
                    value={form.lead_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, lead_type: v as LeadType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Property Type</Label>
                  <Select
                    value={form.property_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, property_type: v as PropertyType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Budget Min (AED)</Label>
                  <Input
                    type="number"
                    placeholder="500,000"
                    value={form.budget_min}
                    onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Budget Max (AED)</Label>
                  <Input
                    type="number"
                    placeholder="2,000,000"
                    value={form.budget_max}
                    onChange={(e) => setForm((f) => ({ ...f, budget_max: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <div className="flex flex-wrap gap-2">
                  {BEDROOM_OPTIONS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, bedrooms: f.bedrooms === b.value ? '' : b.value as BedroomOption }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.bedrooms === b.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferred areas */}
          <Card>
            <CardContent className="pt-4">
              <Label className="mb-2 block">Preferred Areas</Label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {DUBAI_AREAS.slice(0, 20).map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      form.preferred_areas.includes(area)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Source & notes */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm((f) => ({ ...f, source: v as LeadSource }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How did they find you?" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional context..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Owns property toggle */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Already owns a property?</p>
                  <p className="text-xs text-muted-foreground">Enables upgrade opportunity calculation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOwnsProperty(!ownsProperty)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ownsProperty ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      ownsProperty ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {ownsProperty && (
                <div className="mt-4 space-y-3 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Property Type</Label>
                      <Select
                        value={form.owned_property_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, owned_property_type: v as PropertyType }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="apartment">Apartment</SelectItem>
                          <SelectItem value="villa">Villa</SelectItem>
                          <SelectItem value="townhouse">Townhouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Area</Label>
                      <Input
                        placeholder="e.g. JLT"
                        value={form.owned_property_area}
                        onChange={(e) => setForm((f) => ({ ...f, owned_property_area: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Purchase Year</Label>
                      <Input
                        type="number"
                        placeholder="2019"
                        value={form.owned_purchase_year}
                        onChange={(e) => setForm((f) => ({ ...f, owned_purchase_year: e.target.value }))}
                        min="2000"
                        max="2026"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Purchase Price (AED)</Label>
                      <Input
                        type="number"
                        placeholder="850,000"
                        value={form.owned_purchase_price}
                        onChange={(e) => setForm((f) => ({ ...f, owned_purchase_price: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !form.name || !form.phone || !form.lead_type}
            className="w-full"
            size="lg"
          >
            {loading ? 'Saving...' : 'Create Lead'}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
