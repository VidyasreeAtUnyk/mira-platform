# Mira Platform — Spec

## Vision
One system, run by a "COO Agent" that continuously triages, plans, and acts across
the whole business — buyer leads, seller/developer inventory, marketing, comms,
and admin — so the CEO/COO see one prioritized "Today" view instead of navigating
separate modules. Humans review/approve judgment calls; the agent executes
low-risk work itself and always optimizes for revenue/pipeline velocity.

## Core architecture
- **Agent core** — scheduled + event-triggered reasoning loop. Not a literal
  always-on process; runs on a schedule and on triggers (new lead, stage change,
  deadline), reasons using current state, decides: auto-execute / escalate / inform.
- **Modules are tool/data providers** the agent calls — not separate UIs the human
  navigates to.
- **Today view** — the agent's current briefing (what needs attention, what's
  planned), regenerated as state changes. This is the home screen.
- **Review/approval queue** — where escalated actions land. Nearly everything
  routes here at launch (2-person team, no lead volume yet); loosens over time.
- **Monthly report** — auto-generated rollup: revenue, pipeline health, marketing
  ROI, lead source performance.
- **Budget governor** — hard caps on AI call volume/spend, enforced in the agent
  core itself, not left to convention.

## Scheduling policy
- **Social media module**: frequent loop (post + monitor) — this is the active
  growth engine right now.
- **Everything else**: priority/event-triggered, not fixed-interval. E.g. lead
  reply → immediate reasoning pass; otherwise batched into scheduled reviews
  (default: hourly or coarser — tune down as real usage data comes in).
- All scheduled/triggered runs respect the budget governor (see below).

## Roles (RBAC + ownership)
| Role | Sees | Edits | Notes |
|---|---|---|---|
| Owner/COO | Everything | Everything | All notifications, all modules |
| Senior Agent | Own + assigned team leads/deals | Own pipeline/tasks | No cross-team financials |
| Junior Agent | Own leads only | Own leads/tasks | No pipeline-wide view, no financials |
| Marketing/Social | Social, posters, content calendar, ad ROI | Drafts, schedule, posters | No CRM/lead access, no financials |
| Admin/Ops | Trackers, task automation, doc status, compliance alerts | Task status, docs | No financials |
| Finance (future) | Commission/financials only | Financial records | Nothing else |

Founder-only-for-now modules (loosen later via config, no code change):
poster creation (until junior staff onboarded), lead-discovery/market-strategy
(judgment-heavy — stays owner-reviewed longer).

## Modules

### 1. CRM + Lead Follow-up (merge target — Phase 0/1)
Unify existing CRM + lead-agent repos into one schema. This is the foundation
everything else depends on.

### 2. Transaction Pipeline
Lead → showing → offer → under contract → inspection → closing. Distinct from
raw "lead" concept in CRM.

### 3. Listing Management
Active listings, status, price changes, days on market.

### 4. Seller/Developer Inventory (Sobha, DAMAC, future MOUs)
- Developer partner directory: commission terms, MOU expiry, contacts.
- Inventory ingestion: **no public API from DAMAC or Sobha** — both run
  login-based broker portals (DAMAC Agents Portal / DAMAC 360 app; Sobha channel
  partner portal). Build as semi-manual ingestion: CSV/paste/AI-vision-on-screenshot
  parsing, NOT scraping with stored credentials. Portal logins stay a human action.
  Ask both developers' partner desks directly whether API/export access exists for
  active partners — not publicized, but sometimes available on request.
  DAMAC agency contact: agents.crm@damacproperties.com.
- MOU compliance tracking (renewal dates, targets, exclusivity terms).
- Commission reconciliation (developer payouts lag closings — needs its own aging view).
- Buyer-demand-to-inventory matching: agent cross-references warm CRM leads
  against live inventory and proactively suggests matches.
- Generic "add developer partner" flow — not hardcoded to Sobha/DAMAC.

### 5. Financial/Commission Tracking
Buyer-side and developer-side commission tracking (separate aging views).

### 6. Communications Hub
- Unified inbox: email (Gmail/Outlook API) + WhatsApp + (later) SMS/social DMs.
- **WhatsApp**: no direct Meta approval needed — integrate via a BSP (Business
  Solution Provider): Interakt (WhatsApp-native CRM features, India-strong),
  Wati, or Twilio (most developer-friendly for custom integration). Requires
  standard Meta Business verification via the BSP, not a special approval process.
  Budget note: utility messages ~₹0.145/conversation, marketing ~₹1.09/conversation,
  buyer-initiated replies free within 24h window (rates indicative, confirm with BSP).
- Notification center with priority tiers (urgent / today / fyi), filtered by role.
- Call logging (basic, if phone leads come in).

### 7. Social Media Assistant
- Content calendar generation, tied to real local market data (module 9).
- Poster creation: brand kit (logo/colors/fonts/listing photos) + data-driven
  generation (new listing → auto-pull details → poster) rather than free prompting.
  Founder-only + approval-gated at launch; opens to junior staff later.
  Distinguish own-branded vs. developer-co-branded content (some developers have
  strict marketing compliance rules).
- Runs on the frequent schedule loop — post + monitor performance.
- Local SEO / Google Business Profile management, reviews requests.

### 8. Lead Discovery (buyer-side, beyond APIs)
Signal-based, not just listing feeds:
- Public records: mortgage filings, tax delinquency, probate/divorce filings, permits.
- Expired/withdrawn MLS listings.
- FSBO monitoring (Craigslist, Marketplace, FSBO sites).
- Social listening (local FB groups, Nextdoor — organic "need a realtor" signals).
- Referral/sphere-of-influence nudges (past clients, vendors, other agents —
  cadence-based check-in reminders).
Note: most of this needs custom scrapers/watchers, not clean APIs — fragile,
higher maintenance. Sequence after core agent + CRM + marketing are solid.

### 9. Trends/Market Data
Feeds content calendar and lead-discovery prioritization.

### 10. Days/Goals Trackers
Mechanical, low-risk — safe early build target.

### 11. Standalone Chat
Direct Q&A interface, separate from the agent's proactive briefing.

### 12. Client Portal (future, not built now)
Not in scope for initial build, but data model + auth layer must be designed to
support client-level accounts later (payment plan status, purchase tracking)
without a redesign.

## Cross-cutting requirements
- **Security/privacy**: PII (passports/IDs), payment plans, contracts — encryption
  at rest, access logging per record, real backup/DR plan. Designed into data layer
  from day one, not bolted on.
- **Compliance**: market-specific (UAE/DAMAC: RERA, escrow/trust account rules;
  India/Sobha: RERA India, state-specific disclosure rules). Needs correct-by-
  construction checklists — verify with legal before agent auto-generates anything
  client-facing here.
- **Budget governance**: all AI calls (agent core + module automations) run
  against an explicit cap, enforced centrally.

## Data migration
No existing lead data in current CRM repo (clean repo, no live leads) — this is a
straightforward folder migration into the monorepo, not a data migration project.

## Build phase order
0. **Shared schema/data layer** + CRM/lead-agent merge (single agent, sequential —
   this is the contract everything else builds against)
1. Agent core (decision loop, scheduling, budget governor, escalation rules)
2. Dashboard shell / Today view
3. Trackers (days/goals)
4. Social media assistant + poster module
5. Communications hub (WhatsApp via BSP + email unification, notification tiers)
6. Transaction pipeline + listing management
7. Seller/developer inventory module
8. Lead discovery (signal-based)
9. Financial/commission tracking (both sides)
10. Standalone chat
11. Monthly reporting
12. Client portal groundwork (schema/auth only)

Phases 2 onward (post shared-schema) are parallelizable across separate agent
sessions once Phase 0 is committed and tagged stable — see CLAUDE.md and
MODULES.json for the fan-out mechanism.
