-- Migration 003: Seed Data
-- Test agents, sample leads, interactions, and DLD price index

-- NOTE: In production, run this AFTER creating auth users in Supabase Auth.
-- The UUIDs below must match the auth.users UUIDs.
-- For testing, create auth users manually and update these UUIDs.

-- ============================================================
-- Test Agents
-- Replace UUIDs after creating auth users via Supabase Dashboard
-- ============================================================
insert into agents (id, name, email, phone, role) values
  ('a63aa912-619d-4bf7-8581-ef1dcc506dec', 'Ahmed Al-Rashidi', 'agent@realestateintel.com', '+971501234567', 'agent'),
  ('ca7c0940-0172-4efd-8db4-824a14c8a3b1', 'Sarah Mitchell', 'manager@realestateintel.com', '+971509876543', 'manager')
on conflict (email) do nothing;

-- ============================================================
-- Sample Leads (10 leads in various stages)
-- ============================================================
insert into leads (id, agent_id, name, phone, email, lead_type, property_type, budget_min, budget_max, preferred_areas, bedrooms, status, source, notes, owns_property, owned_property_type, owned_property_area, owned_purchase_year, owned_purchase_price, last_contacted_at, next_followup_at, ai_score, ai_score_reason) values

-- Lead 1: Hot buyer
('10000000-0000-0000-0000-000000000001',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Mohammed Al-Farsi', '+971551234567', 'mohammed@email.com',
 'buyer', 'apartment', 1800000, 2500000,
 ARRAY['Downtown Dubai', 'Business Bay', 'DIFC'],
 '2', 'interested', 'property_finder',
 'Looking for 2BR in Downtown. Has strong budget. Pre-approved mortgage.',
 false, null, null, null, null,
 now() - interval '2 days', now() + interval '1 day',
 8, 'High budget, specific area requirements, pre-approved mortgage — serious buyer'),

-- Lead 2: Upgrade candidate
('10000000-0000-0000-0000-000000000002',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Fatima Hassan', '+971552345678', 'fatima.hassan@email.com',
 'buyer', 'villa', 3500000, 5000000,
 ARRAY['Arabian Ranches', 'Dubai Hills', 'Mudon'],
 '4+', 'new', 'referral',
 'Owns a 1BR in JLT bought in 2019. Wants to upgrade to a villa.',
 true, 'apartment', 'Jumeirah Lake Towers', 2019, 850000,
 now() - interval '1 day', now(),
 9, 'High budget, upgrade candidate with equity in existing property, villa in family-friendly community'),

-- Lead 3: Cold lead
('10000000-0000-0000-0000-000000000003',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Ravi Sharma', '+971553456789', 'ravi.sharma@email.com',
 'buyer', 'apartment', 900000, 1200000,
 ARRAY['Dubai Marina', 'JBR'],
 '1', 'contacted', 'instagram',
 'Looking for 1BR near the beach. Flexible on budget.',
 false, null, null, null, null,
 now() - interval '10 days', now() - interval '3 days',
 5, 'Mid-range budget, popular area, but no urgency signal'),

-- Lead 4: Active viewing stage
('10000000-0000-0000-0000-000000000004',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Anna Kowalski', '+971554567890', 'anna.k@email.com',
 'buyer', 'apartment', 2000000, 2800000,
 ARRAY['Palm Jumeirah', 'Dubai Marina'],
 '2', 'viewing', 'bayut',
 'Viewed 2 apartments in Marina last week. Liked Unit 1204 Cayan Tower.',
 false, null, null, null, null,
 now() - interval '3 days', now() + interval '2 days',
 7, 'Clear preferences, active viewing stage, strong budget for the area'),

-- Lead 5: Offer stage
('10000000-0000-0000-0000-000000000005',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'James Okafor', '+971555678901', 'james.okafor@email.com',
 'buyer', 'villa', 4200000, 4800000,
 ARRAY['Emirates Hills', 'Jumeirah Golf Estates'],
 '4+', 'offer', 'family',
 'Offer submitted on 4BR Emirates Hills villa. Waiting for seller response.',
 true, 'apartment', 'Business Bay', 2018, 1200000,
 now() - interval '1 day', now() + interval '1 day',
 9, 'Premium budget, clear area and size preference, actively in negotiation'),

-- Lead 6: Tenant lead
('10000000-0000-0000-0000-000000000006',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Priya Patel', '+971556789012', 'priya.patel@email.com',
 'tenant', 'apartment', 80000, 110000,
 ARRAY['JVC', 'Al Barsha', 'Jumeirah Village Triangle'],
 '2', 'interested', 'property_finder',
 'Annual rent budget. Moving to Dubai in 2 months. Needs parking.',
 false, null, null, null, null,
 now() - interval '5 days', now(),
 6, 'Time-sensitive (moving in 2 months), clear budget and area preferences'),

-- Lead 7: Landlord / investor
('10000000-0000-0000-0000-000000000007',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Khalid Al-Mansoori', '+971557890123', null,
 'landlord', 'apartment', null, null,
 ARRAY['Downtown Dubai'],
 '1', 'new', 'walk_in',
 'Owns 3 apartments in Downtown. Wants help renting them out. High-value client.',
 true, 'apartment', 'Downtown Dubai', 2017, 950000,
 now() - interval '0 days', now() + interval '3 days',
 7, 'Existing property owner with portfolio — good for rental management and future sales'),

-- Lead 8: Low score / vague
('10000000-0000-0000-0000-000000000008',
 'ca7c0940-0172-4efd-8db4-824a14c8a3b1',
 'David Chen', '+971558901234', 'david.chen@email.com',
 'buyer', 'apartment', 500000, 700000,
 ARRAY['Deira', 'Bur Dubai', 'Karama', 'Jumeirah', 'Business Bay', 'Marina', 'Downtown'],
 null, 'new', 'other',
 'Very vague requirements. Listed half of Dubai as preferred areas.',
 false, null, null, null, null,
 now() - interval '4 days', now() + interval '7 days',
 3, 'Low budget, no specific area preference, no urgency signal'),

-- Lead 9: Seller lead
('10000000-0000-0000-0000-000000000009',
 'ca7c0940-0172-4efd-8db4-824a14c8a3b1',
 'Elena Petrov', '+971559012345', 'elena.petrov@email.com',
 'seller', 'apartment', null, null,
 ARRAY['Business Bay'],
 '1', 'contacted', 'referral',
 'Wants to sell her 1BR in Business Bay. Bought in 2020 for AED 750K.',
 true, 'apartment', 'Business Bay', 2020, 750000,
 now() - interval '6 days', now() - interval '1 day',
 6, 'Active seller with clear property details — listing opportunity'),

-- Lead 10: Closed Won
('10000000-0000-0000-0000-000000000010',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'Omar Al-Zahrani', '+971550123456', 'omar@email.com',
 'buyer', 'villa', 6000000, 8000000,
 ARRAY['Palm Jumeirah'],
 '4+', 'closed_won', 'family',
 'Deal closed! 4BR Palm villa for AED 7.2M. Great client for referrals.',
 false, null, null, null, null,
 now() - interval '2 days', null,
 10, 'Closed deal — note for referral tracking')

on conflict (id) do nothing;

-- ============================================================
-- Sample Interactions
-- ============================================================
insert into interactions (id, lead_id, agent_id, type, summary, outcome, next_action, next_action_date) values

('20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'call', 'Discussed requirements. He wants a high floor, sea view if possible. Has pre-approved mortgage from Emirates NBD for AED 2M.',
 'positive', 'Send shortlist of 3 properties in Downtown', now()::date + 1),

('20000000-0000-0000-0000-000000000002',
 '10000000-0000-0000-0000-000000000002',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'whatsapp', 'Initial contact. She confirmed she owns 1BR in JLT and is ready to sell and upgrade. Very motivated.',
 'positive', 'Calculate equity on JLT apartment and present upgrade options', now()::date),

('20000000-0000-0000-0000-000000000003',
 '10000000-0000-0000-0000-000000000004',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'viewing', 'Viewed Unit 1204 Cayan Tower and Unit 803 in Marina Gate. Preferred Cayan for the view but concerned about the price.',
 'positive', 'Send comparative analysis: Cayan vs Marina Gate pricing', now()::date + 2),

('20000000-0000-0000-0000-000000000004',
 '10000000-0000-0000-0000-000000000005',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'call', 'Offer of AED 4.35M submitted. Seller wants 4.5M. James willing to go to 4.45M max.',
 'neutral', 'Wait for seller counter-offer. Call James on Friday.', now()::date + 3),

('20000000-0000-0000-0000-000000000005',
 '10000000-0000-0000-0000-000000000003',
 'a63aa912-619d-4bf7-8581-ef1dcc506dec',
 'call', 'Called twice, no answer. Left voicemail.',
 'no_answer', 'Try WhatsApp message', now()::date - 3)

on conflict (id) do nothing;

-- ============================================================
-- DLD Price Index (sample data 2019-2024)
-- Approximate values based on Dubai real estate market trends
-- ============================================================
insert into dld_price_index (first_date_of_month, all_monthly_index, flat_monthly_index, villa_monthly_index, all_monthly_price_index, flat_monthly_price_index, villa_monthly_price_index) values
('2019-01-01', 100.00, 100.00, 100.00, 100.00, 100.00, 100.00),
('2019-04-01', 98.50, 97.80, 99.50, 98.50, 97.80, 99.50),
('2019-07-01', 97.20, 96.10, 98.80, 97.20, 96.10, 98.80),
('2019-10-01', 95.80, 94.50, 97.60, 95.80, 94.50, 97.60),
('2020-01-01', 94.50, 93.20, 96.40, 94.50, 93.20, 96.40),
('2020-04-01', 91.20, 89.80, 93.10, 91.20, 89.80, 93.10),
('2020-07-01', 90.50, 88.90, 92.80, 90.50, 88.90, 92.80),
('2020-10-01', 91.80, 90.50, 93.60, 91.80, 90.50, 93.60),
('2021-01-01', 94.20, 92.80, 96.20, 94.20, 92.80, 96.20),
('2021-04-01', 98.60, 96.40, 101.80, 98.60, 96.40, 101.80),
('2021-07-01', 103.40, 100.20, 108.10, 103.40, 100.20, 108.10),
('2021-10-01', 109.80, 105.60, 116.40, 109.80, 105.60, 116.40),
('2022-01-01', 116.20, 110.80, 124.50, 116.20, 110.80, 124.50),
('2022-04-01', 122.80, 115.60, 133.20, 122.80, 115.60, 133.20),
('2022-07-01', 128.40, 120.20, 140.10, 128.40, 120.20, 140.10),
('2022-10-01', 133.60, 124.80, 146.80, 133.60, 124.80, 146.80),
('2023-01-01', 137.20, 127.60, 151.40, 137.20, 127.60, 151.40),
('2023-04-01', 141.80, 130.40, 157.60, 141.80, 130.40, 157.60),
('2023-07-01', 145.20, 132.80, 162.40, 145.20, 132.80, 162.40),
('2023-10-01', 148.60, 135.20, 167.20, 148.60, 135.20, 167.20),
('2024-01-01', 151.40, 137.60, 170.80, 151.40, 137.60, 170.80),
('2024-04-01', 154.20, 139.80, 174.40, 154.20, 139.80, 174.40),
('2024-07-01', 157.60, 142.20, 178.60, 157.60, 142.20, 178.60),
('2024-10-01', 160.80, 144.60, 182.40, 160.80, 144.60, 182.40),
('2025-01-01', 163.40, 146.80, 185.60, 163.40, 146.80, 185.60),
('2025-04-01', 166.20, 149.20, 188.80, 166.20, 149.20, 188.80),
('2025-07-01', 168.80, 151.40, 191.60, 168.80, 151.40, 191.60),
('2025-10-01', 171.20, 153.60, 194.40, 171.20, 153.60, 194.40),
('2026-01-01', 173.60, 155.80, 197.20, 173.60, 155.80, 197.20),
('2026-04-01', 175.80, 157.60, 199.40, 175.80, 157.60, 199.40)
on conflict (first_date_of_month) do nothing;
