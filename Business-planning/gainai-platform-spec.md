# GainAI Platform — Technical Specification

## Claude Code Implementation Guide

**Version:** 1.0  
**Date:** February 2026  
**Stack:** Next.js 14 (App Router) + Supabase + Google Business Profile APIs  
**Deployment:** Vercel + Supabase Cloud

---

## 1. Project Overview

GainAI is a SaaS platform for managing Google Business Profile (GBP) visibility for UK small businesses. It provides:

1. **Admin Dashboard** — Internal GainAI team interface for managing all clients, creating content, monitoring reviews, and running reports
2. **Client Portal** — Per-client branded interface for reviewing posts, approving content, viewing reports, and managing their profile
3. **Automation Engine** — Background jobs for post scheduling, review polling, performance metric collection, and alert generation
4. **Bulk Operations** — CSV/spreadsheet upload for multi-client and multi-location operations

The platform manages the full GBP lifecycle: profile creation → verification → optimisation → ongoing content → review management → performance reporting.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  Next.js 14 App Router                              │
│  ┌──────────────┐  ┌───────────────────────────┐    │
│  │ Admin Portal  │  │ Client Portal             │    │
│  │ /admin/*      │  │ /client/{slug}/*          │    │
│  │               │  │ (magic link auth)         │    │
│  └──────────────┘  └───────────────────────────┘    │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                 SUPABASE                             │
│  ┌────────┐ ┌──────┐ ┌────────┐ ┌───────────────┐  │
│  │Postgres│ │ Auth │ │Storage │ │Edge Functions  │  │
│  │        │ │      │ │(media) │ │(cron/webhooks) │  │
│  └────────┘ └──────┘ └────────┘ └───────────────┘  │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│              EXTERNAL APIs                           │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │
│  │ GBP API │ │Claude AI │ │Twilio  │ │Stripe    │  │
│  │ (Google)│ │(content) │ │(SMS)   │ │(billing) │  │
│  └─────────┘ └──────────┘ └────────┘ └──────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Organisations (GainAI is the sole org initially, but multi-tenant ready)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Team members (GainAI staff)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients (businesses we manage)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  industry TEXT,
  address JSONB,
  website TEXT,
  package TEXT CHECK (package IN ('starter', 'growth', 'premium')),
  monthly_fee NUMERIC(10,2),
  status TEXT DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused', 'churned')),
  onboarded_at TIMESTAMPTZ,
  brand_voice JSONB,
  settings JSONB DEFAULT '{}',
  notes TEXT,
  tags TEXT[],
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Client portal users
CREATE TABLE client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'approver', 'viewer')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Google Business Profile

```sql
CREATE TABLE gbp_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  google_account_id TEXT,
  google_location_id TEXT,
  google_place_id TEXT,
  name TEXT NOT NULL,
  address JSONB,
  phone TEXT,
  website TEXT,
  primary_category TEXT,
  additional_categories TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'created', 'verification_requested', 'verified', 'suspended', 'disconnected'
  )),
  verification_method TEXT,
  verification_requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  oauth_token_encrypted TEXT,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE gbp_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  audit_data JSONB NOT NULL,
  overall_score TEXT,
  scores JSONB,
  recommendations JSONB,
  audited_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Posts & Content

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('whats_new', 'event', 'offer', 'product')),
  title TEXT,
  body TEXT NOT NULL,
  cta_type TEXT,
  cta_url TEXT,
  media_urls TEXT[],
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  offer_coupon_code TEXT,
  offer_terms TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  google_post_id TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'approved', 'rejected', 'scheduled', 'published', 'failed', 'expired'
  )),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  ai_model TEXT,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  industry TEXT,
  content_type TEXT NOT NULL,
  title_template TEXT,
  body_template TEXT NOT NULL,
  cta_type TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.4 Reviews

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  google_review_id TEXT UNIQUE NOT NULL,
  reviewer_name TEXT,
  reviewer_photo_url TEXT,
  star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  comment TEXT,
  review_language TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  response_status TEXT DEFAULT 'pending' CHECK (response_status IN (
    'pending', 'draft_ready', 'pending_approval', 'approved', 'published', 'skipped'
  )),
  ai_draft_response TEXT,
  final_response TEXT,
  response_published_at TIMESTAMPTZ,
  responded_by TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  themes TEXT[],
  flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  star_range INT4RANGE,
  sentiment TEXT,
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Media

```sql
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  google_media_id TEXT,
  storage_path TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('photo', 'video', 'logo', 'cover')),
  category TEXT,
  caption TEXT,
  source TEXT CHECK (source IN ('uploaded', 'ai_generated', 'customer', 'google_street_view')),
  uploaded_to_google BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 Performance Metrics

```sql
CREATE TABLE performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  business_impressions_desktop INTEGER DEFAULT 0,
  business_impressions_mobile INTEGER DEFAULT 0,
  search_impressions INTEGER DEFAULT 0,
  maps_impressions INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,
  direction_requests INTEGER DEFAULT 0,
  bookings INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, date)
);

CREATE TABLE search_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  keyword TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  report_type TEXT CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'audit')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  summary TEXT,
  pdf_storage_path TEXT,
  sent_to_client BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 Competitors

```sql
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES gbp_locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  google_place_id TEXT,
  address TEXT,
  primary_category TEXT,
  current_rating NUMERIC(2,1),
  current_review_count INTEGER,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  rating NUMERIC(2,1),
  review_count INTEGER,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competitor_id, snapshot_date)
);
```

### 3.8 Activity & Notifications

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  location_id UUID,
  actor_type TEXT CHECK (actor_type IN ('system', 'team', 'client', 'ai')),
  actor_id UUID,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT CHECK (recipient_type IN ('team', 'client')),
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  notification_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.9 Bulk Operations

```sql
CREATE TABLE bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  job_type TEXT NOT NULL CHECK (job_type IN (
    'client_import', 'post_import', 'location_import', 'media_import', 'competitor_import'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'partial'
  )),
  source_file_path TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_by UUID REFERENCES team_members(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Google Business Profile API Integration

### 4.1 Authentication

- Use OAuth 2.0 with offline access (refresh tokens)
- Store encrypted refresh tokens per gbp_location
- Client connects their Google account during onboarding via OAuth consent screen
- GainAI's GCP project needs these APIs enabled:
  - My Business Business Information API
  - My Business Account Management API
  - Business Profile Performance API
  - My Business Verifications API
  - Google My Business API v4 (legacy — still needed for posts, reviews, media)

### 4.2 API Capabilities Map

| Feature | API | Endpoint | Automated? |
|---------|-----|----------|------------|
| Create location | Business Information API | `POST accounts/{id}/locations` | ✅ |
| Search existing listing | GoogleLocations API | `POST googleLocations:search` | ✅ |
| Request ownership | GoogleLocations API | Returns `requestAdminRightsUrl` | Semi (redirect) |
| Verify location | Verifications API | `POST locations/{id}:verify` | ✅ |
| Complete verification | Verifications API | `POST verifications/{id}:complete` | ✅ (with PIN) |
| Update business info | Business Information API | `PATCH locations/{id}` | ✅ |
| Create post | My Business API v4 | `POST .../localPosts` | ✅ |
| Edit/delete post | My Business API v4 | `PATCH/DELETE .../localPosts/{id}` | ✅ |
| List reviews | My Business API v4 | `GET .../reviews` | ✅ |
| Batch get reviews | My Business API v4 | `POST .../locations:batchGetReviews` | ✅ |
| Reply to review | My Business API v4 | `PUT .../reviews/{id}/reply` | ✅ |
| Upload media | My Business API v4 | `POST .../media` | ✅ |
| Delete media | My Business API v4 | `DELETE .../media/{id}` | ✅ |
| Get performance | Performance API v1 | `GET locations/{id}:fetchMultiDailyMetricsTimeSeries` | ✅ |
| Get search keywords | Performance API v1 | `GET locations/{id}/searchkeywordimpressions` | ✅ |
| Get categories | Business Information API | `GET categories` | ✅ |
| Get attributes | Business Information API | `GET categories/{id}/attributes` | ✅ |
| Notifications | Notifications API | `GET accounts/{id}/notifications` | ✅ |

### 4.3 Location Lifecycle (Full API Flow)

```
1. DISCOVER
   POST googleLocations:search
   → Match found & unclaimed? → Claim via requestAdminRightsUrl
   → Match found & claimed?   → Request admin rights via URL
   → No match?                → CREATE

2. CREATE
   POST accounts/{accountId}/locations
   Body: { title, address, primaryPhone, websiteUri, primaryCategory, ... }
   → Returns location with locationId

3. VERIFY
   POST locations/{locationId}:fetchVerificationOptions
   → Returns available methods (POSTCARD, PHONE_CALL, SMS, EMAIL, AUTO)
   POST locations/{locationId}:verify  { method: "SMS", phoneNumber: "+44..." }
   → Verification initiated
   POST verifications/{verificationId}:complete  { pin: "123456" }
   → Location verified

4. OPTIMISE
   PATCH locations/{locationId}  { description, hours, attributes, ... }
   POST .../media  (upload photos)
   POST .../localPosts  (create first post)

5. ONGOING
   Scheduled posts, review sync, performance tracking (see Automation section)
```

### 4.4 Sync Strategy

| Data | Frequency | Method |
|------|-----------|--------|
| Reviews | Every 2 hours | Poll per location |
| Performance metrics | Daily 06:00 UTC | Batch fetch (48hr data lag) |
| Search keywords | Weekly Mondays | Batch fetch |
| Profile data | Weekly + on-edit | Full sync |
| Competitor ratings | Weekly Sundays | Places API snapshot |
| OAuth token health | Daily 08:00 | Validate per location |

### 4.5 Rate Limits & Error Handling

- GBP API: ~60 QPM per project for most endpoints
- Implement exponential backoff with jitter
- Queue all API calls through rate-limited job queue (use pg_cron or Supabase Edge Function scheduler)
- Log all API errors to `activity_log` with full request/response
- Retry failed post publishes up to 3x with 5-minute intervals
- On permanent failure: mark post as `failed`, create notification for team

---

## 5. AI Content Engine

### 5.1 Post Generation

Use Claude API (`claude-sonnet-4-5-20250929`) for content generation.

**System prompt structure:**
```
You are a local business content writer for {{business_name}}, a {{industry}}
located in {{city}}, {{county}}.

Brand voice: {{brand_voice_description}}
Tone: {{tone}}
Things to avoid: {{avoid_words}}

Write a Google Business Profile post for the "{{content_type}}" category.
Keep it under 1,500 characters. Include a clear call to action.
Do NOT include phone numbers (Google rejects these).
Make it locally relevant to {{city}} and surrounding areas.
{{#if previous_posts}}
Here are recent posts to avoid repetition:
{{previous_posts}}
{{/if}}
```

**Content calendar generation pipeline:**
1. Monthly (25th): Generate next month's content calendar per client
2. Input: business type, seasonality, local events, previous post performance
3. Output: 12-16 posts with body, image descriptions, CTA types, optimal publish times
4. Content type rotation: tips → promo → engagement → seasonal → behind-scenes
5. Posts saved as `draft` → sent to client portal for review or auto-scheduled if client prefs allow

**Bulk generation:**
- Admin selects multiple clients → AI generates calendars for all
- Progress tracked per client with preview before committing

### 5.2 Review Response Generation

**System prompt:**
```
Respond to this Google review on behalf of {{business_name}}.
Respond as the business owner in first person.
Brand voice: {{brand_voice_description}}

Review: {{star_rating}} stars by {{reviewer_name}}
"{{review_comment}}"

Guidelines:
- Thank reviewer by name
- Reference specific details they mentioned
- For 1-3 stars: acknowledge concern, apologise, offer resolution path (invite to contact directly)
- For 4-5 stars: express gratitude, reinforce what they enjoyed, subtle invite to return
- Keep under 500 characters
- Never be defensive or argumentative
- Never offer discounts or compensation in the response
- Never use the word "sorry" more than once
```

**Auto-response rules (configurable per client):**
- 5-star, no comment: auto-publish thank-you from template
- 5-star with comment: AI draft → auto-publish (if client enabled)
- 4-star: AI draft → queue for team review
- 1-3 star: AI draft → flag as urgent → team review required
- All auto-responses logged in activity_log

### 5.3 Report Summary Generation

```
Summarise this GBP performance data for {{business_name}} ({{period}}).
Write 3-5 sentences a small business owner would understand.
Highlight: biggest win, area needing attention, one actionable recommendation.
Compare to previous period where data available.
Mention specific numbers (e.g., "calls up 23% to 47").
Data: {{performance_json}}
```

### 5.4 Audit Narrative Generation

After automated audit scoring, AI generates a plain-English explanation:
```
Based on this GBP audit data for {{business_name}}, write a brief assessment.
Score: {{overall_score}}. Category scores: {{scores_json}}.
Write 2-3 paragraphs explaining what's working, what needs fixing, and prioritised next steps.
Assume the reader is a non-technical small business owner.
```

---

## 6. Admin Dashboard

### 6.1 Routes

```
/admin
├── /dashboard                    — Overview KPIs, alerts, pending actions
├── /clients
│   ├── /                        — Client list (search, filter, sort, export)
│   ├── /new                     — Add new client form
│   ├── /import                  — Bulk CSV import
│   └── /[clientId]
│       ├── /                    — Client overview & settings
│       ├── /locations           — GBP locations (connect, create, verify)
│       ├── /posts               — Content calendar & post management
│       ├── /reviews             — Review inbox & response management
│       ├── /media               — Photo/video library
│       ├── /reports             — Performance reports
│       ├── /competitors         — Competitor tracking
│       ├── /audit               — Profile audit tool
│       └── /activity            — Activity log
├── /posts
│   ├── /                        — All posts across all clients (kanban + list)
│   ├── /calendar                — Visual calendar view (month/week/day)
│   ├── /templates               — Post template library (CRUD)
│   ├── /generate                — AI bulk content generation
│   └── /import                  — Bulk post import (CSV)
├── /reviews
│   ├── /                        — All reviews across all clients (unified inbox)
│   ├── /pending                 — Reviews needing response
│   ├── /templates               — Response template library
│   └── /analytics               — Sentiment & theme analysis dashboard
├── /reports
│   ├── /                        — Report generation & history
│   └── /scheduled               — Scheduled report deliveries
├── /locations
│   ├── /                        — All locations across all clients
│   ├── /import                  — Bulk location import
│   └── /health                  — Location health (verification, completeness, token status)
├── /bulk
│   ├── /                        — Upload hub (client, post, location, media, competitor)
│   └── /jobs                    — Job history & status tracking
└── /settings
    ├── /team                    — Team member management
    ├── /billing                 — Client billing overview (Stripe integration)
    ├── /integrations            — OAuth connections, API health, quota usage
    ├── /templates               — Global templates (posts, reviews, emails, reports)
    └── /notifications           — Notification preferences & Slack webhook config
```

### 6.2 Dashboard Page

**KPI Cards (top row):**
- Total active clients (with trend)
- Total managed locations
- Posts published this month
- Average client rating (all locations)
- Pending reviews needing response
- Revenue this month (from Stripe)

**Alerts panel:**
- Failed post publishes
- Expired/expiring OAuth tokens
- New negative reviews (1-2 stars)
- Locations with verification issues
- Clients with no posts in 14+ days
- Overdue review responses (>24hrs for negative)

**Quick actions:**
- Generate posts for client
- Respond to review
- Run profile audit
- Create new client

**Recent activity feed:**
- Last 20 actions across all clients (filterable)

### 6.3 Client Detail Page

**Header:** Client name, status badge, package, rating, location count, Stripe status
**Tabs:**
- Overview: brand voice config, contact details, package, health score, recent activity
- Locations: GBP locations with status (verified/pending), connect new, create new
- Posts: Calendar view with post cards, create/edit, generate AI content
- Reviews: Review feed with response drafts, sentiment chart, response rate
- Media: Photo grid with upload, categorise, push to Google
- Reports: Monthly reports with view/download/send, date range selector
- Competitors: Competitor list with rating/review trends
- Audit: Latest audit scorecard, run new audit, audit history
- Activity: Full activity log for this client

### 6.4 Post Management (Cross-Client)

**Kanban view columns:** Draft → Pending Review → Approved → Scheduled → Published → Failed
- Cards show: client name, post preview (first 80 chars), date, content type
- Drag-and-drop between columns
- Click to expand full post with edit capability

**Calendar view:**
- Month/week/day toggle
- Colour-coded by client
- Click date to create new post
- Drag posts to reschedule

**AI Generation page:**
- Select clients (multi-select or "all active")
- Configure: number of posts, date range, content types to include
- Generate → preview all → approve individually or in bulk → schedule
- Shows estimated publish schedule

### 6.5 Review Inbox (Cross-Client)

**Unified inbox layout:**
- Left panel: review list (client name, stars, first line, time ago, status badge)
- Right panel: full review with AI draft response, edit field, approve/skip buttons
- Filters: star rating, sentiment, response status, client, date range
- Keyboard shortcuts: J/K to navigate, A to approve, S to skip, E to edit

**Auto-response rules config (per client in settings):**
- Enable/disable auto-publish for 5-star reviews
- Enable/disable auto-publish for 4-star reviews
- Always require manual review for 1-3 stars
- Custom response delay (e.g., wait 2 hours before publishing to seem human)

### 6.6 Audit Tool

**One-click audit checks:**
| Check | Scoring |
|-------|---------|
| Business name accuracy | Pass/Fail |
| Address completeness & format | Pass/Fail |
| Phone number present & correct | Pass/Fail |
| Website URL valid & reachable | Pass/Fail |
| Business hours set | Pass/Fail |
| Holiday hours set | -/5 points |
| Business description present & >250 chars | /10 |
| Primary category set & appropriate | Pass/Fail |
| Additional categories (2+) | /5 |
| Photo count (target: 10+ business, 3+ interior, 3+ exterior) | /15 |
| Recent post (within 7 days) | /10 |
| Post frequency (4+ per month) | /10 |
| Average review rating | /10 |
| Review count (vs competitor benchmark) | /10 |
| Review response rate (target: 100%) | /10 |
| Review response time (target: <24hrs) | /5 |
| Attributes completed | /5 |
| Products/services listed | /5 |

**Output:**
- Overall letter grade (A+ through F)
- Per-category scores
- Prioritised recommendations with effort/impact matrix
- Comparison to top local competitor (if competitor data available)
- Save to `gbp_audits` table
- Export as branded PDF using GainAI template

---

## 7. Client Portal

### 7.1 Authentication

- Magic link authentication via Supabase Auth (no passwords)
- Client receives email with one-time login link
- Session persists for 30 days
- Role-based: owner (full access), approver (approve/reject content), viewer (read-only)
- Custom branded login page per client: `/client/{slug}/login`

### 7.2 Routes

```
/client/{slug}
├── /                            — Dashboard (KPIs, pending items, activity)
├── /posts
│   ├── /                        — Content calendar (view scheduled/published)
│   ├── /pending                 — Posts awaiting approval (approve/reject)
│   └── /[postId]                — Post detail with Google preview mock
├── /reviews
│   ├── /                        — Review feed (with response drafts)
│   └── /[reviewId]              — Review detail with approve/edit response
├── /reports
│   ├── /                        — Report list with download
│   └── /[reportId]              — Interactive report view
├── /photos                      — Photo gallery with upload
├── /profile                     — Current GBP info (read-only)
├── /settings                    — Notification preferences, contact details
└── /support                     — Contact form → creates notification for GainAI team
```

### 7.3 Client Dashboard

**Top row KPIs (current month vs previous):**
- Profile views (Search + Maps, with % change)
- Website clicks (with % change)
- Phone calls (with % change)
- Direction requests (with % change)

**Second row:**
- Current Google rating (star display) + total review count
- Posts published this month / target
- Average review response time
- Pending items badge count

**Sections:**
- Pending approvals: post cards and review response cards with approve/reject buttons
- Recent reviews: last 5 reviews with status
- Upcoming posts: next 5 scheduled posts
- Activity feed: last 10 actions on their account

### 7.4 Post Approval Flow

**Post card shows:**
- Google Business Profile post preview (mocked GBP card with photo, text, CTA button)
- Content type badge
- Scheduled publish date
- Actions: Approve ✅ | Request Edit ✏️ | Reject ❌

**Approve:** Post moves to `scheduled` status, published at scheduled time
**Request Edit:** Post moves to `draft`, GainAI team notified with client's notes
**Reject:** Post moves to `rejected`, rejection reason required, GainAI team notified

### 7.5 Review Response Approval

For clients who want to approve responses before they go live:
- Review card shows: star rating, reviewer name, review text, AI-drafted response
- Client can: Approve as-is | Edit response then approve | Skip (no response)
- Approved responses published via API within configured delay

### 7.6 Reports

**Interactive report view:**
- Date range selector (default: last 30 days)
- Charts: impressions trend, actions breakdown, device split
- Search keywords table (sortable by impressions)
- Review summary: new reviews, average rating, sentiment breakdown
- Posts summary: published count, top performer by views/clicks
- Competitor comparison (if tracked): rating + review count side-by-side
- AI-generated summary at top in plain English
- Download as PDF button

### 7.7 Photo Management

- Drag-and-drop upload (max 5MB per image, JPEG/PNG)
- Auto-categorise: interior, exterior, product, team, food, logo, cover
- Photos uploaded by client go to `media` table with `source: 'uploaded'`
- GainAI team reviews and pushes to GBP via API
- Client can see which photos are live on Google vs pending

---

## 8. Bulk Operations

### 8.1 Supported Bulk Types

| Type | CSV Columns | Notes |
|------|-------------|-------|
| Client Import | name, contact_name, contact_email, contact_phone, industry, address_line1, city, county, postcode, website, package | Creates client records |
| Location Import | client_slug, location_name, address_line1, city, county, postcode, phone, website, primary_category | Links to existing clients |
| Post Import | client_slug, content_type, title, body, cta_type, cta_url, scheduled_for, image_url | Creates posts in draft or scheduled |
| Media Import | client_slug, location_name, file_url, media_type, category, caption | Downloads and stores media |
| Competitor Import | client_slug, competitor_name, google_place_id, address, primary_category, website | Links competitors to locations |

### 8.2 Bulk Upload UI

**Upload flow:**
1. Select bulk type from dropdown
2. Download template CSV (with headers + 2 example rows)
3. Drag-and-drop CSV/XLSX file
4. System validates all rows instantly:
   - Required field checks
   - Format validation (email, URL, postcode, date)
   - Reference validation (client_slug exists, etc.)
   - Duplicate detection
5. Show validation results table:
   - ✅ Valid rows (green)
   - ⚠️ Warning rows (amber) — e.g., optional field missing
   - ❌ Error rows (red) — with specific error per field
6. Download error report as CSV
7. Confirm import of valid rows (skip errors or abort all)
8. Progress bar during processing
9. Completion summary: X created, Y skipped, Z errors

### 8.3 Bulk Job History

- Table: job type, uploaded by, date, total/success/error counts, status, actions
- Click to view: full job details, error log, re-download source file
- Re-run failed rows button (creates new job with only error rows)

---

## 9. Automation Engine

### 9.1 Scheduled Jobs (Supabase Edge Functions + pg_cron)

| Job | Schedule | Description |
|-----|----------|-------------|
| `sync-reviews` | Every 2 hours | Poll GBP API for new reviews per verified location |
| `sync-performance` | Daily 06:00 UTC | Fetch daily metrics via Performance API |
| `sync-keywords` | Weekly Mon 06:00 | Fetch search keyword impressions |
| `publish-posts` | Every 15 minutes | Publish posts where `status=scheduled` AND `scheduled_for <= now()` |
| `generate-reports` | Monthly 1st, 07:00 | Generate monthly reports for all active clients |
| `send-reports` | Monthly 2nd, 09:00 | Email clients that reports are ready + portal link |
| `competitor-snapshot` | Weekly Sun 06:00 | Snapshot competitor ratings via Places API |
| `token-health` | Daily 08:00 | Validate OAuth tokens, alert on failures |
| `generate-calendars` | Monthly 25th | AI-generate next month's content for all clients |
| `location-health` | Weekly Wed 06:00 | Check completeness, hours, verification status |
| `stale-post-alert` | Daily 09:00 | Alert if any active client has no post in 14+ days |
| `review-response-alert` | Every 4 hours | Alert if any negative review is unresponded >24hrs |

### 9.2 Event-Driven Automations

| Trigger | Action |
|---------|--------|
| New review (1-3 stars) | AI draft → flag urgent → Slack alert → team notification |
| New review (4-5 stars, comment) | AI draft → auto-publish if enabled, else queue |
| New review (5 stars, no comment) | Template response → auto-publish if enabled |
| Post approved by client | Move to `scheduled` with next available publish slot |
| Post rejected by client | Notify team with rejection reason |
| Post publish succeeded | Update `google_post_id`, `published_at`, log activity |
| Post publish failed | Retry 3x → alert team → mark as `failed` |
| OAuth token expired | Alert team + email client with re-auth link |
| Client onboarded | Run profile audit → generate first content calendar |
| Report generated | Create notification for client → send email |
| Location verified | Log activity → notify team → trigger initial audit |
| Stripe payment failed | Notify team → 7 day grace → auto-pause if unresolved |
| Stripe subscription cancelled | Update client status to `churned` → notify team |

### 9.3 Notification Channels

| Channel | Internal | Client |
|---------|----------|--------|
| In-app notification bell | ✅ | ✅ |
| Email | ✅ (digest) | ✅ (per event) |
| Slack webhook | ✅ | ❌ |
| SMS (Twilio) | ✅ (urgent only) | ❌ |

---

## 10. Stripe Billing Integration

### 10.1 Setup

- Stripe Products: `gainai_starter`, `gainai_growth`, `gainai_premium`
- Stripe Prices: monthly recurring (£59/£99/£149 or custom per-client)
- Each client has `stripe_customer_id` and `stripe_subscription_id`

### 10.2 Admin Billing Page

- Table: client, package, monthly fee, payment status, next invoice date, Stripe link
- Filters: overdue, active, cancelled
- Quick actions: create invoice, pause subscription, change plan

### 10.3 Webhooks

Handle via `/api/webhooks/stripe`:
- `invoice.payment_succeeded` → log, update status
- `invoice.payment_failed` → notify team, start grace period
- `customer.subscription.deleted` → update client to `churned`
- `customer.subscription.updated` → update package/fee

---

## 11. Security & RLS

### 11.1 Row Level Security Policies

```sql
-- Team members see all data
CREATE POLICY "team_select_clients" ON clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members WHERE user_id = auth.uid()));

-- Client users see only their own client's data
CREATE POLICY "client_select_own" ON clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM client_users WHERE user_id = auth.uid() AND client_id = id));

-- Apply same pattern to: posts, reviews, media, reports, performance_daily,
-- search_keywords, gbp_locations, competitors, notifications, activity_log

-- Client users can UPDATE posts (for approval workflow)
CREATE POLICY "client_approve_posts" ON posts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM client_users
    WHERE user_id = auth.uid() AND client_id = posts.client_id
    AND role IN ('owner', 'approver')
  ))
  WITH CHECK (status IN ('approved', 'rejected'));

-- Client users can INSERT media (photo uploads)
CREATE POLICY "client_upload_media" ON media FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM client_users
    WHERE user_id = auth.uid() AND client_id = media.client_id
  ));
```

### 11.2 Sensitive Data Handling

- OAuth refresh tokens: encrypted using Supabase Vault (`vault.create_secret()`)
- API keys (Claude, Stripe, Twilio): stored in Supabase Edge Function secrets via dashboard
- Client portal: magic link auth, no stored passwords, 30-day session expiry
- All API routes: verify auth token + check team_member or client_user role

---

## 12. File Structure

```
gainai-platform/
├── src/
│   ├── app/
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx                    # Dashboard
│   │   │       ├── clients/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── new/page.tsx
│   │   │       │   ├── import/page.tsx
│   │   │       │   └── [clientId]/
│   │   │       │       ├── page.tsx
│   │   │       │       ├── locations/page.tsx
│   │   │       │       ├── posts/page.tsx
│   │   │       │       ├── reviews/page.tsx
│   │   │       │       ├── media/page.tsx
│   │   │       │       ├── reports/page.tsx
│   │   │       │       ├── competitors/page.tsx
│   │   │       │       ├── audit/page.tsx
│   │   │       │       └── activity/page.tsx
│   │   │       ├── posts/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── calendar/page.tsx
│   │   │       │   ├── templates/page.tsx
│   │   │       │   ├── generate/page.tsx
│   │   │       │   └── import/page.tsx
│   │   │       ├── reviews/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── pending/page.tsx
│   │   │       │   ├── templates/page.tsx
│   │   │       │   └── analytics/page.tsx
│   │   │       ├── reports/page.tsx
│   │   │       ├── locations/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── import/page.tsx
│   │   │       │   └── health/page.tsx
│   │   │       ├── bulk/
│   │   │       │   ├── page.tsx
│   │   │       │   └── jobs/page.tsx
│   │   │       └── settings/
│   │   │           ├── team/page.tsx
│   │   │           ├── billing/page.tsx
│   │   │           ├── integrations/page.tsx
│   │   │           └── templates/page.tsx
│   │   ├── (client)/
│   │   │   └── client/
│   │   │       └── [slug]/
│   │   │           ├── layout.tsx
│   │   │           ├── page.tsx                # Client dashboard
│   │   │           ├── posts/
│   │   │           │   ├── page.tsx
│   │   │           │   ├── pending/page.tsx
│   │   │           │   └── [postId]/page.tsx
│   │   │           ├── reviews/
│   │   │           │   ├── page.tsx
│   │   │           │   └── [reviewId]/page.tsx
│   │   │           ├── reports/
│   │   │           │   ├── page.tsx
│   │   │           │   └── [reportId]/page.tsx
│   │   │           ├── photos/page.tsx
│   │   │           ├── profile/page.tsx
│   │   │           ├── settings/page.tsx
│   │   │           └── support/page.tsx
│   │   ├── api/
│   │   │   ├── google/
│   │   │   │   ├── oauth/
│   │   │   │   │   ├── connect/route.ts        # Initiate OAuth flow
│   │   │   │   │   └── callback/route.ts       # Handle OAuth callback
│   │   │   │   ├── locations/
│   │   │   │   │   ├── search/route.ts         # Search for existing listing
│   │   │   │   │   ├── create/route.ts         # Create new location
│   │   │   │   │   └── verify/route.ts         # Initiate/complete verification
│   │   │   │   ├── posts/
│   │   │   │   │   ├── publish/route.ts        # Publish single post
│   │   │   │   │   └── bulk-publish/route.ts   # Publish batch
│   │   │   │   ├── reviews/
│   │   │   │   │   ├── sync/route.ts           # Sync reviews for location
│   │   │   │   │   └── reply/route.ts          # Publish review response
│   │   │   │   ├── media/
│   │   │   │   │   └── upload/route.ts         # Upload media to GBP
│   │   │   │   └── performance/
│   │   │   │       ├── sync/route.ts           # Sync daily metrics
│   │   │   │       └── keywords/route.ts       # Sync search keywords
│   │   │   ├── ai/
│   │   │   │   ├── generate-posts/route.ts     # Generate content calendar
│   │   │   │   ├── draft-review/route.ts       # Draft review response
│   │   │   │   ├── generate-report/route.ts    # Generate report summary
│   │   │   │   └── run-audit/route.ts          # Run profile audit
│   │   │   ├── bulk/
│   │   │   │   ├── upload/route.ts             # Handle CSV upload + validation
│   │   │   │   ├── process/route.ts            # Process validated rows
│   │   │   │   ├── status/[jobId]/route.ts     # Get job status
│   │   │   │   └── templates/[type]/route.ts   # Download CSV templates
│   │   │   ├── webhooks/
│   │   │   │   ├── stripe/route.ts
│   │   │   │   └── google/route.ts
│   │   │   ├── reports/
│   │   │   │   ├── generate/route.ts
│   │   │   │   └── pdf/[reportId]/route.ts
│   │   │   └── auth/
│   │   │       └── magic-link/route.ts
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── callback/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx                            # Landing / redirect
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── ClientCard.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   ├── PostKanban.tsx
│   │   │   ├── PostCalendar.tsx
│   │   │   ├── PostEditor.tsx
│   │   │   ├── PostPreviewCard.tsx
│   │   │   ├── ReviewInbox.tsx
│   │   │   ├── ReviewResponseEditor.tsx
│   │   │   ├── AuditScorecard.tsx
│   │   │   ├── AuditCheckRow.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   ├── KeywordsTable.tsx
│   │   │   ├── BulkUploader.tsx
│   │   │   ├── BulkValidationTable.tsx
│   │   │   ├── CompetitorTable.tsx
│   │   │   ├── CompetitorTrendChart.tsx
│   │   │   ├── LocationHealthGrid.tsx
│   │   │   ├── LocationConnectFlow.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── AlertsPanel.tsx
│   │   │   └── BillingTable.tsx
│   │   ├── client/
│   │   │   ├── ClientSidebar.tsx
│   │   │   ├── ClientDashboard.tsx
│   │   │   ├── PostApprovalCard.tsx
│   │   │   ├── GooglePostPreview.tsx           # Mock GBP post card
│   │   │   ├── ReviewFeed.tsx
│   │   │   ├── ReviewResponseApproval.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   ├── MetricTrend.tsx
│   │   │   ├── ReportViewer.tsx
│   │   │   ├── ReportChart.tsx
│   │   │   ├── PhotoUploader.tsx
│   │   │   ├── PhotoGrid.tsx
│   │   │   └── SupportForm.tsx
│   │   ├── shared/
│   │   │   ├── DataTable.tsx                   # Sortable, filterable, paginated
│   │   │   ├── KPICard.tsx                     # Metric + trend arrow + sparkline
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── NotificationBell.tsx
│   │   │   ├── NotificationPanel.tsx
│   │   │   ├── FileDropzone.tsx
│   │   │   ├── StarRating.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── ExportButton.tsx
│   │   └── ui/                                 # shadcn/ui primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── sheet.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       └── tooltip.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                       # Browser client
│   │   │   ├── server.ts                       # Server client (RSC/API routes)
│   │   │   ├── admin.ts                        # Service role client (background jobs)
│   │   │   └── middleware.ts                    # Auth middleware
│   │   ├── google/
│   │   │   ├── auth.ts                         # OAuth helpers (token refresh, etc)
│   │   │   ├── locations.ts                    # Location CRUD, search, verify
│   │   │   ├── posts.ts                        # Post create/edit/delete/list
│   │   │   ├── reviews.ts                      # Review list, reply
│   │   │   ├── media.ts                        # Media upload/delete
│   │   │   ├── performance.ts                  # Fetch daily metrics, keywords
│   │   │   ├── categories.ts                   # Get categories/attributes
│   │   │   └── types.ts                        # TypeScript types for all GBP responses
│   │   ├── ai/
│   │   │   ├── client.ts                       # Claude API client wrapper
│   │   │   ├── prompts.ts                      # All prompt templates
│   │   │   ├── post-generator.ts               # Content calendar generation
│   │   │   ├── review-responder.ts             # Review response drafting
│   │   │   ├── report-summariser.ts            # Report narrative generation
│   │   │   └── audit-narrator.ts               # Audit result narration
│   │   ├── stripe/
│   │   │   ├── client.ts                       # Stripe SDK wrapper
│   │   │   ├── webhooks.ts                     # Webhook event handlers
│   │   │   └── billing.ts                      # Subscription management helpers
│   │   ├── bulk/
│   │   │   ├── parser.ts                       # CSV/XLSX parsing
│   │   │   ├── validator.ts                    # Row validation per type
│   │   │   ├── processor.ts                    # Process validated rows
│   │   │   └── templates.ts                    # Generate template CSVs
│   │   ├── notifications/
│   │   │   ├── sender.ts                       # Notification dispatcher
│   │   │   ├── email.ts                        # Email sending (Resend/Sendgrid)
│   │   │   └── slack.ts                        # Slack webhook
│   │   ├── audit/
│   │   │   ├── runner.ts                       # Profile audit logic
│   │   │   ├── scoring.ts                      # Score calculation
│   │   │   └── pdf-generator.ts                # Audit PDF export
│   │   ├── reports/
│   │   │   ├── generator.ts                    # Report data compilation
│   │   │   └── pdf-generator.ts                # Report PDF export
│   │   └── utils/
│   │       ├── dates.ts
│   │       ├── formatting.ts
│   │       ├── encryption.ts                   # Token encryption helpers
│   │       └── rate-limiter.ts                 # API rate limiting
│   ├── hooks/
│   │   ├── useClients.ts
│   │   ├── usePosts.ts
│   │   ├── useReviews.ts
│   │   ├── usePerformance.ts
│   │   ├── useNotifications.ts
│   │   ├── useBulkUpload.ts
│   │   └── useRealtime.ts                     # Supabase realtime subscriptions
│   ├── types/
│   │   ├── database.ts                        # Generated Supabase types
│   │   ├── google.ts                          # GBP API response types
│   │   └── index.ts                           # Shared app types
│   └── styles/
│       └── globals.css                        # Tailwind + custom GainAI theme
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_indexes.sql
│   │   └── 004_functions.sql                  # DB functions (triggers, computed columns)
│   ├── functions/
│   │   ├── sync-reviews/index.ts
│   │   ├── sync-performance/index.ts
│   │   ├── sync-keywords/index.ts
│   │   ├── publish-posts/index.ts
│   │   ├── generate-reports/index.ts
│   │   ├── competitor-snapshot/index.ts
│   │   ├── token-health/index.ts
│   │   └── generate-calendars/index.ts
│   └── seed.sql                               # Dev seed data
├── public/
│   ├── gainai-logo.svg
│   └── gainai-wordmark.svg
├── .env.local.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 13. Key Database Indexes

```sql
CREATE INDEX idx_clients_org ON clients(organisation_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_slug ON clients(slug);

CREATE INDEX idx_locations_client ON gbp_locations(client_id);
CREATE INDEX idx_locations_status ON gbp_locations(status);

CREATE INDEX idx_posts_client ON posts(client_id);
CREATE INDEX idx_posts_location ON posts(location_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_for) WHERE status = 'scheduled';

CREATE INDEX idx_reviews_client ON reviews(client_id);
CREATE INDEX idx_reviews_location ON reviews(location_id);
CREATE INDEX idx_reviews_response_status ON reviews(response_status);
CREATE INDEX idx_reviews_rating ON reviews(star_rating);
CREATE INDEX idx_reviews_google_id ON reviews(google_review_id);

CREATE INDEX idx_performance_location_date ON performance_daily(location_id, date);
CREATE INDEX idx_keywords_location ON search_keywords(location_id);

CREATE INDEX idx_activity_client ON activity_log(client_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read = false;

CREATE INDEX idx_bulk_jobs_org ON bulk_jobs(organisation_id);
```

---

## 14. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Claude AI
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Notifications
RESEND_API_KEY=                   # or SENDGRID_API_KEY
SLACK_WEBHOOK_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App
NEXT_PUBLIC_APP_URL=https://app.gainai.co.uk
ENCRYPTION_KEY=                   # For OAuth token encryption
```

---

## 15. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Next.js 14 project setup with Tailwind + shadcn/ui
- [ ] Supabase project creation with initial schema migration
- [ ] Auth: team member login (Supabase Auth email/password)
- [ ] Auth: client portal magic link flow
- [ ] Admin layout: sidebar, header, notification bell
- [ ] Client portal layout: sidebar, header
- [ ] Basic CRUD: clients, locations (manual, no Google API yet)
- [ ] DataTable, KPICard, StatusBadge shared components

### Phase 2: Google Integration (Weeks 4-6)
- [ ] OAuth flow: connect Google account, store tokens
- [ ] Location lifecycle: search → create → verify
- [ ] Post management: create, edit, delete via API
- [ ] Review sync: poll and store reviews
- [ ] Review reply: publish responses via API
- [ ] Media upload to GBP
- [ ] Performance metrics sync (daily + keywords)
- [ ] Rate limiting and error handling

### Phase 3: AI Engine (Weeks 7-8)
- [ ] Claude API integration with prompt templates
- [ ] Post generation: single client content calendar
- [ ] Bulk post generation: multi-client
- [ ] Review response drafting with auto-publish rules
- [ ] Report summary generation
- [ ] Audit narrative generation

### Phase 4: Admin Dashboard (Weeks 9-11)
- [ ] Dashboard page with KPIs, alerts, quick actions
- [ ] Client detail page with all tabs
- [ ] Post kanban board and calendar view
- [ ] Review inbox with keyboard shortcuts
- [ ] Audit tool with scorecard
- [ ] Competitor tracking
- [ ] Report generation and PDF export
- [ ] Template management (posts and reviews)
- [ ] Activity log and notification system

### Phase 5: Client Portal (Weeks 12-13)
- [ ] Client dashboard with metrics
- [ ] Post approval flow with Google preview mock
- [ ] Review feed with response approval
- [ ] Interactive report viewer with charts
- [ ] Photo upload
- [ ] Support/contact form
- [ ] Notification preferences

### Phase 6: Bulk Operations & Automation (Weeks 14-15)
- [ ] CSV parser and validator
- [ ] Bulk upload UI with validation table
- [ ] All 5 bulk import types
- [ ] Template CSV downloads
- [ ] Job history page
- [ ] All scheduled cron jobs (Edge Functions)
- [ ] Event-driven automations
- [ ] Email notifications (Resend)
- [ ] Slack webhook integration

### Phase 7: Billing & Polish (Weeks 16-17)
- [ ] Stripe integration: subscriptions, webhooks
- [ ] Billing admin page
- [ ] Payment failure handling
- [ ] Client onboarding wizard (guided setup)
- [ ] Empty states and loading skeletons
- [ ] Error boundaries and toast notifications
- [ ] Mobile responsiveness pass
- [ ] Performance optimisation (lazy loading, pagination)

### Phase 8: Testing & Launch (Week 18)
- [ ] End-to-end testing of full flows
- [ ] Security audit (RLS, token handling, input sanitisation)
- [ ] Load testing on sync jobs
- [ ] Seed with test data (5 clients, 3 locations each)
- [ ] Staging deployment and UAT
- [ ] Production deployment
- [ ] First client onboarding

---

## 16. Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.2",
    "@supabase/supabase-js": "^2.45",
    "@supabase/ssr": "^0.5",
    "googleapis": "^140",
    "@anthropic-ai/sdk": "^0.30",
    "stripe": "^16",
    "recharts": "^2.12",
    "@tanstack/react-table": "^8.20",
    "react-big-calendar": "^1.14",
    "react-beautiful-dnd": "^13.1",
    "papaparse": "^5.4",
    "xlsx": "^0.18",
    "date-fns": "^3.6",
    "zod": "^3.23",
    "resend": "^4",
    "lucide-react": "^0.400",
    "@radix-ui/react-dialog": "^1.1",
    "@radix-ui/react-dropdown-menu": "^2.1",
    "@radix-ui/react-tabs": "^1.1",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.4"
  }
}
```

---

## 17. Do NOT Constraints

- Do NOT store OAuth tokens in plain text — always encrypt
- Do NOT expose Google API keys or service account keys to the client
- Do NOT auto-publish review responses for 1-3 star reviews (always require human review)
- Do NOT include phone numbers in GBP post content (Google rejects these)
- Do NOT call Google APIs synchronously in page renders — always use API routes or Edge Functions
- Do NOT store Stripe webhook secrets in client-side code
- Do NOT allow client portal users to edit business info directly (they submit requests)
- Do NOT skip rate limiting on Google API calls — respect 60 QPM
- Do NOT generate posts without checking previous posts for duplicate content
- Do NOT send client emails without unsubscribe option (UK GDPR compliance)
- Do NOT store raw review text from Google in public-facing HTML without sanitisation

---

## 18. Verification Steps (Per Phase)

### After Phase 1:
- [ ] Team member can log in and see admin dashboard skeleton
- [ ] Client user can log in via magic link and see portal skeleton
- [ ] CRUD operations work for clients and locations
- [ ] RLS policies prevent cross-client data access

### After Phase 2:
- [ ] OAuth flow completes and tokens are stored encrypted
- [ ] Can create a new GBP location via API
- [ ] Can publish a post to a verified location
- [ ] Reviews sync and appear in admin
- [ ] Review response publishes to Google
- [ ] Performance metrics populate the database

### After Phase 3:
- [ ] AI generates a full month's content calendar for a client
- [ ] AI drafts review responses that match brand voice
- [ ] Report summaries are readable and accurate

### After Phase 4:
- [ ] Admin dashboard shows live KPIs
- [ ] Post kanban drag-and-drop works
- [ ] Review inbox processes 10 reviews in under 5 minutes
- [ ] Audit produces a scored, exportable report

### After Phase 5:
- [ ] Client can approve/reject posts in portal
- [ ] Approved post automatically schedules and publishes
- [ ] Client can view interactive monthly report
- [ ] Photo upload stores file and creates media record

### After Phase 6:
- [ ] Bulk import of 50 clients via CSV works with validation
- [ ] All cron jobs execute on schedule
- [ ] New negative review triggers Slack alert within 2 hours
- [ ] Scheduled posts publish within 15 minutes of scheduled_for time

### After Phase 7:
- [ ] Stripe subscription creates on client setup
- [ ] Failed payment triggers pause flow
- [ ] Onboarding wizard completes full setup in one session

### After Phase 8:
- [ ] 5 test clients fully operational
- [ ] No console errors in production
- [ ] All RLS policies verified with cross-user testing
- [ ] Performance: admin dashboard loads in <2 seconds
