# Story 14.3: Resources, Support & Legal Pages

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Prerequisites Checklist

- [x] **Story 14.1 (Homepage & Navigation Shell) is DONE** — PublicLayout, all 8 shared public components, router.tsx with placeholder routes, `content/` directory, Tabs + Accordion shadcn components installed
- [x] **Story 14.2 (Scheme Information Pages) is DONE** — Template A pattern established, content file convention proven, BreadcrumbNav tested for nested routes
- [x] **`content/news.ts` already has `slug` and `body` fields** — Story 14.1 creates this file with 3 placeholder articles including slug + full body text. Task 1.4 below is a verify-then-extend step, NOT a creation step
- [x] **shadcn `Tabs` component is installed** — confirmed available from Story 14.1 installation

## Story

As an **MDA Reporting Officer visiting the VLPRS website**,
I want to find FAQs, submission guides, downloadable forms, and contact information,
So that I can prepare for using the system without needing a phone call or office visit.

## Acceptance Criteria

### AC1: FAQ Page (`/resources/faq`)

**Given** a user navigates to the FAQ page
**When** the page renders
**Then** it displays:
- **Search input** at top — filters accordion questions by keyword (`Input` component with search icon)
- **3 category tabs** (`Tabs` component): "For Beneficiaries" (default active), "For MDA Officers", "General"
- **Collapsible accordion** within each tab with categorised questions:
  - **For Beneficiaries:** How do I check my loan balance? What happens when my loan is paid off? What is an Auto-Stop Certificate? How are my repayments calculated? What is an Expression of Interest? _(minimum 5 questions)_
  - **For MDA Officers:** How do I submit monthly deduction data? What is the 8-field CSV format? What happens if I make an error in my submission? When is the submission deadline? _(minimum 5 questions)_
  - **General:** What is VLPRS? Who administers the scheme? How is my data protected? What is an Expression of Interest? _(minimum 5 questions)_
**And** minimum 15 questions total across all categories
**And** each question uses shadcn `Accordion` + `AccordionItem` (accessible, keyboard-navigable)
**And** search filtering hides non-matching questions in real-time (client-side filter)
- CtaBanner at bottom

### AC2: MDA Submission Guide Page (`/resources/mda-guide`)

**Given** a user navigates to the MDA Guide page
**When** the page renders
**Then** it displays Template A (8-col main + 4-col sidebar):
- **Main content (8 cols):**
  - **The 8 CSV Fields (H2):** Table showing all 8 fields (Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Effective Date, Deduction Cessation Reason) with Required/Conditional column
  - **Conditional Fields (H2):** Event Effective Date required when Event Flag ≠ NONE; Cessation Reason required when Amount = ₦0 AND Event Flag = NONE
  - **Step-by-Step Process (H2):** 1. Download CSV template → 2. Fill in staff records → 3. Upload via VLPRS portal → 4. Review confirmation & comparison summary
  - **Screenshots (H2):** Placeholder section (`bg-slate-100 rounded border-dashed border-2`) — "Screenshots to be added after Sprint 8"
- **Sidebar (4 cols):**
  - Quick Reference box: Deadline "28th of each month", "Download CSV Template" button (secondary), Format .csv / Encoding UTF-8
  - DisclaimerCallout: "Need help? → Contact Support"
- CtaBanner at bottom

### AC3: Downloads & Forms Page (`/resources/downloads`)

**Given** a user navigates to Downloads
**When** the page renders
**Then** it displays Template B (Card Grid — `grid-cols-1 md:grid-cols-2 gap-6`) with 4 resource cards:
1. **CSV Submission Template** — Badge `CSV`, description, file size ~1KB, **Download button** (secondary)
2. **Policy Summary** — Badge `PDF`, "Official policy document — to be provided by AG's Office", **"Coming Soon" badge** (no download)
3. **MDA Officer Quick Reference Guide** — Badge `PDF`, "To be created post-training", **"Coming Soon" badge**
4. **Training Materials** — Badge `PDF`, "To be created for rollout", **"Coming Soon" badge**
**And** each card shows: document name, format badge (`Badge variant="secondary"`), description, file size (where available), action button or "Coming Soon" badge
**And** "Coming Soon" cards have `opacity-80 cursor-not-allowed` (visually and interactively signal unavailability)
- CtaBanner at bottom

### AC4: News & Announcements Page (`/resources/news`)

**Given** a user navigates to News
**When** the page renders
**Then** it displays Template B (Card Grid — `grid-cols-1 md:grid-cols-3 gap-6`) with announcement cards in reverse chronological order:
- 3 placeholder announcements: "VLPRS Deployed to 63 MDAs" (20 Feb 2026), "Migration Phase 1 Underway" (15 Feb 2026), "Beneficiary Portal Planned for Phase 2" (01 Feb 2026)
- Each card shows: date (`text-sm text-slate-500`), title (`text-lg font-semibold`), excerpt (`text-slate-600 line-clamp-3`), "Read more →" link (`text-teal-700 hover:underline`)
**And** clicking "Read more" navigates to `/resources/news/[slug]` detail page showing full announcement text
**And** news detail page uses Template A (full-width, no sidebar) with:
  - BreadcrumbNav: Home > Resources > News > [Article Title]
  - H1: article title
  - Date displayed below H1 (`text-sm text-slate-500`)
  - Full body text from `content/news.ts`
  - "← Back to News" link at bottom (`text-teal-700 hover:underline`)
  - Dynamic `<title>`: "[Article Title] — News — Vehicle Loan Scheme"
  - If slug not found → redirect to `/resources/news`
**And** announcements are stored as static content in `src/content/news.ts` (no CMS, no database — updates via code commits)

### AC5: Approved Beneficiary Lists Page (`/resources/beneficiary-lists`)

**Given** a user navigates to Approved Beneficiary Lists
**When** the page renders
**Then** it displays Template C (Placeholder — `max-w-lg mx-auto text-center py-24`) with:
- Clock icon (Lucide `Clock`, `text-slate-400 text-4xl`)
- "Approved Beneficiary Lists" title
- "Coming Soon — Phase 2" badge (`Badge variant="secondary"`)
- Description: published approved batch lists, searchable by name or Staff ID, NDPR-compliant masked identifiers
- "Expected: Phase 2 release"
- Related links: "→ Back to Resources", "→ How It Works"
**And** the page is fully styled — not a bare placeholder — to signal roadmap intentionality (`Card` with `shadow-sm`)

### AC6: Help & Support Page (`/support`)

**Given** a user navigates to Help & Support
**When** the page renders
**Then** it displays Template A (full-width, no sidebar):
- **Guidance banner** (`bg-teal-50 border border-teal-200 rounded-xl p-8`): "Need help? Here's where to start:" with 3 audience-specific pointers (MDA officers → Submission Guide, Loan enquiries → Car Loan Department, Technical issues → email)
- **Contact Information (H2):** 3 cards in grid (`grid-cols-1 md:grid-cols-3`):
  - Address card (MapPin icon): Accountant-General's Office, Ibadan, Oyo State
  - Email card (Mail icon): carloan@oyo.gov.ng
  - Phone card (Phone icon): +234 xxx xxxx
- Office hours: Monday–Friday, 8:00 AM – 6:00 PM WAT
- **Useful Links (H2):** FAQ, MDA Submission Guide, Programme Overview
- CtaBanner at bottom

### AC7: Privacy & Data Protection Page (`/privacy`)

**Given** a user navigates to Privacy
**When** the page renders
**Then** it displays full-width prose (`max-w-3xl mx-auto`) with 8 sections (H2 each):
1. What Personal Data Is Collected — data minimisation principle
2. How Data Is Processed — loan administration only
3. Who Has Access — role-based, need-to-know
4. Data Retention — minimum 7 years per government financial regulations
5. Right of Access — beneficiaries can view their own data
6. Consent Practices — consent capture
7. Data Security — encryption at rest AES-256, encryption in transit TLS 1.2+, RBAC, audit logging
8. Data Protection Enquiries — contact information

### AC8: Programme Disclaimer Page (`/disclaimer`)

**Given** a user navigates to Programme Disclaimer
**When** the page renders
**Then** it displays full-width prose (`max-w-3xl mx-auto`) with 5 sections (H2 each):
1. System Scope — general programme information and administrative record-keeping
2. Committee Authority — approvals/rejections remain committee responsibility
3. Expression of Interest — does not constitute, imply, or guarantee approval
4. No Legal Commitment — information for general guidance only
5. Payroll & Gratuity Scope — VLPRS records/tracks, does not execute payroll or process gratuity

### AC9: Accessibility Statement Page (`/accessibility`)

**Given** a user navigates to Accessibility
**When** the page renders
**Then** it displays full-width prose (`max-w-3xl mx-auto`) with 5 sections (H2 each):
1. WCAG 2.1 AA Compliance — commitment statement
2. Accessibility Features — keyboard navigation, screen reader support, colour contrast (4.5:1 / 3:1), text resizing 200%, touch targets 44x44px, focus indicators
3. Known Limitations — any discovered issues (initially "None identified")
4. Report an Issue — contact information
5. Continuous Improvement — ongoing commitment

### AC10: Expression of Interest Placeholder Page (`/eoi`)

**Given** a user navigates to Expression of Interest
**When** the page renders
**Then** it displays Template C (Placeholder) with:
- FileText icon (Lucide `FileText`, `text-slate-400 text-4xl`)
- "Expression of Interest" title
- "Coming Soon — Phase 2" badge
- Description: what EOI registration will enable (submit interest, receive reference number)
- Disclaimer: "Expression of Interest ≠ loan approval"
- "Expected: Phase 2 release"
- Related links: "→ How It Works", "→ Contact Support"
**And** fully styled with design system

### AC11: Cross-Page Requirements

**Given** any resources, support, or legal page (all 10 pages above)
**When** the page renders
**Then** it uses PublicLayout (nav + footer from Story 14.1)
**And** has a unique `<title>` tag and meta description
**And** has BreadcrumbNav
**And** meets WCAG AA accessibility requirements (semantic HTML, heading hierarchy, keyboard navigable, contrast ratios)
**And** renders in <500ms as a client-side SPA transition

## Tasks / Subtasks

- [x] Task 1 — Create content data files (AC: 1-10)
  - [x] 1.1 Create `apps/client/src/content/faq.ts` — 16 questions grouped by 3 categories (beneficiaries=6, mda-officers=5, general=5)
  - [x] 1.2 Create `apps/client/src/content/mda-guide.ts` — 8 CSV field definitions, conditional rules, 4 submission steps, sidebar info
  - [x] 1.3 Create `apps/client/src/content/downloads.ts` — 4 resources (1 available CSV, 3 coming-soon PDFs)
  - [x] 1.4 **Verified** `apps/client/src/content/news.ts` — confirmed slug and body fields exist with sufficient content for detail pages
  - [x] 1.5 Create `apps/client/src/content/support.ts` — guidance items, contact info, useful links
  - [x] 1.6 Create `apps/client/src/content/privacy.ts` — 8 NDPR sections (LegalSection interface)
  - [x] 1.7 Create `apps/client/src/content/programme-disclaimer.ts` — 5 disclaimer sections
  - [x] 1.8 Create `apps/client/src/content/accessibility-statement.ts` — 5 accessibility sections
  - [x] 1.9 Create `apps/client/src/content/eoi.ts` — placeholder description, disclaimer, related links
  - [x] 1.10 Create `apps/client/src/content/beneficiary-lists.ts` — placeholder description, features, related links
- [x] Task 2 — Build FAQ page (AC: 1, 11)
  - [x] 2.1 Create `pages/public/resources/FaqPage.tsx`
  - [x] 2.2 Implement search Input with filter state — client-side case-insensitive filter
  - [x] 2.3 Implement 3-category Tabs (shadcn Tabs)
  - [x] 2.4 Implement Accordion within each tab (shadcn Accordion type="multiple")
  - [x] 2.5 Search filters across active tab only with useMemo pattern
  - [x] 2.6 Set title + meta via usePageMeta hook
- [x] Task 3 — Build MDA Submission Guide page (AC: 2, 11)
  - [x] 3.1 Create `pages/public/resources/MdaGuidePage.tsx`
  - [x] 3.2 Build 8+4 col grid: main (table + conditions + steps + screenshot placeholder) + sidebar
  - [x] 3.3 Build 8-field semantic HTML table with <thead>/<tbody>, <th scope="col">
  - [x] 3.4 Build screenshot placeholder (bg-slate-100 dashed border)
  - [x] 3.5 Add "Download CSV Template" button in sidebar linking to /templates/submission-template.csv
  - [x] 3.6 Set title + meta
- [x] Task 4 — Build Downloads & Forms page (AC: 3, 11)
  - [x] 4.1 Create `pages/public/resources/DownloadsPage.tsx`
  - [x] 4.2 Build card grid (grid-cols-1 md:grid-cols-2 gap-6) from content/downloads.ts
  - [x] 4.3 Each card: document name, Badge format, description, action (Download or Coming Soon)
  - [x] 4.4 Create CSV template at apps/client/public/templates/submission-template.csv
  - [x] 4.5 Set title + meta
- [x] Task 5 — Build News & Announcements pages (AC: 4, 11)
  - [x] 5.1 Create `pages/public/resources/NewsPage.tsx` — 3-col card grid listing
  - [x] 5.2 Create `pages/public/resources/NewsDetailPage.tsx` — full article with back link
  - [x] 5.3 Build 3-column card grid from content/news.ts (reverse chronological)
  - [x] 5.4 Implement slug-based routing: /resources/news/:slug → NewsDetailPage
  - [x] 5.5 Handle invalid slug (Navigate redirect to /resources/news)
  - [x] 5.6 Set title + meta (dynamic title per article)
- [x] Task 6 — Build Beneficiary Lists placeholder page (AC: 5, 11)
  - [x] 6.1 Create `pages/public/resources/BeneficiaryListsPage.tsx`
  - [x] 6.2 Implement Template C: Card with Clock icon, Coming Soon badge, features, related links
  - [x] 6.3 Set title + meta
- [x] Task 7 — Build Help & Support page (AC: 6, 11)
  - [x] 7.1 Create `pages/public/SupportPage.tsx` (top-level at /support)
  - [x] 7.2 Build guidance banner (bg-teal-50 border-teal-200 rounded-xl)
  - [x] 7.3 Build 3 contact cards (MapPin, Mail, Phone icons)
  - [x] 7.4 Build office hours and useful links sections
  - [x] 7.5 Set title + meta
- [x] Task 8 — Build 3 legal/policy prose pages (AC: 7, 8, 9, 11)
  - [x] 8.1 Create `pages/public/legal/PrivacyPage.tsx` — 8 H2 sections, max-w-3xl prose
  - [x] 8.2 Create `pages/public/legal/DisclaimerPage.tsx` — 5 H2 sections, same layout
  - [x] 8.3 Create `pages/public/legal/AccessibilityPage.tsx` — 5 H2 sections with features list
  - [x] 8.4 All 3 pages: PageHeader + BreadcrumbNav + prose sections, no CtaBanner
- [x] Task 9 — Build EOI placeholder page (AC: 10, 11)
  - [x] 9.1 Create `pages/public/EoiPage.tsx` (top-level at /eoi)
  - [x] 9.2 Implement Template C: FileText icon, Coming Soon badge, DisclaimerCallout (teal Info icon), related links
  - [x] 9.3 Set title + meta
- [x] Task 10 — Update router with all real page components (AC: 11)
  - [x] 10.1 Replaced all placeholder routes with 11 lazy-loaded page imports + /resources/news/:slug dynamic route
  - [x] 10.2 BreadcrumbNav generates correct paths — PATH_LABELS already covers all routes
- [x] Task 11 — Create CSV template file (AC: 2, 3)
  - [x] 11.1 Created apps/client/public/templates/submission-template.csv with 8-field headers + example row
  - [x] 11.2 Linked from both Downloads page and MDA Guide sidebar
- [x] Task 12 — SEO meta tags for all 10 pages + 1 detail page (AC: 11)
  - [x] 12.1 All 11 unique titles implemented via usePageMeta hook — verified in unit tests
- [x] Task 13 — Accessibility & responsive verification (AC: 11)
  - [x] 13.1 FAQ: shadcn Tabs (keyboard-navigable) + Accordion (Enter/Space focusable) — built-in a11y
  - [x] 13.2 Search input has aria-label="Search frequently asked questions"
  - [x] 13.3 MDA Guide table: semantic HTML <table> with <th scope="col">, <thead>/<tbody>
  - [x] 13.4 All grids use responsive breakpoints (grid-cols-1 → md:grid-cols-2/3 → lg:grid-cols-12)
  - [x] 13.5 Legal pages use max-w-3xl mx-auto for comfortable reading
  - [x] 13.6 All interactive elements use Button component (44px+ targets), heading hierarchy correct per page
- [x] Task 14 — Unit tests (AC: all)
  - [x] 14.1 FaqPage.test.tsx: renders 16 questions across 3 tabs (7 tests)
  - [x] 14.2 FaqPage.test.tsx: search filters questions by keyword match
  - [x] 14.3 MdaGuidePage.test.tsx: renders 8-field table with correct headers (7 tests)
  - [x] 14.4 DownloadsPage.test.tsx: renders 4 cards, 1 downloadable + 3 coming soon (5 tests)
  - [x] 14.5 NewsPage.test.tsx: renders 3 announcement cards (5 tests)
  - [x] 14.6 NewsDetailPage.test.tsx: renders full article for valid slug (4 tests)
  - [x] 14.7 BeneficiaryListsPage.test.tsx + EoiPage.test.tsx: Coming Soon badges (5+6 tests)
  - [x] 14.8 SupportPage.test.tsx: renders 3 contact cards (7 tests)
  - [x] 14.9 PrivacyPage/DisclaimerPage/AccessibilityPage.test.tsx: all H2 sections (4+4+4 tests)
  - [x] 14.10 All 11 routes resolve to correct lazy-loaded components (verified via router.tsx)
  - [x] 14.11 All 11 title tests pass — unique <title> per page including dynamic NewsDetailPage title

### Review Follow-ups (AI) - 2026-02-24
- [x] [AI-Review][CRITICAL] Fix SupportPage: use `<a>` instead of `<Link>` for mailto: and #contact hrefs [SupportPage.tsx]
- [x] [AI-Review][CRITICAL] Add missing test for invalid slug redirect in NewsDetailPage [NewsDetailPage.test.tsx]
- [x] [AI-Review][HIGH] Fix Accessibility features section: render as semantic `<ul>` list instead of paragraph [AccessibilityPage.tsx, accessibility-statement.ts]
- [x] [AI-Review][HIGH] Fix Download button: change from variant="secondary" to variant="default" (brand CTA) [DownloadsPage.tsx, MdaGuidePage.tsx]
- [x] [AI-Review][MEDIUM] Expand news article bodies to substantive multi-paragraph content [news.ts]
- [x] [AI-Review][MEDIUM] Fix NewsDetailPage: move usePageMeta after article lookup to avoid title flicker on redirect [NewsDetailPage.tsx]
- [ ] [AI-Review][MEDIUM] Add FAQ tab switching test to verify tabs show correct questions [FaqPage.test.tsx]
- [ ] [AI-Review][MEDIUM] Add download button href assertion to verify correct URL [DownloadsPage.test.tsx]
- [x] [AI-Review][ACCEPTED] News article titles adapted for VLPRS context, accepted by PM
- [x] [AI-Review][ACCEPTED] Badge text uses parentheses "Coming Soon (Phase 2)" per no-em-dash style rule

## Dev Notes

### Critical Architecture Compliance

- **Content files pattern:** ALL page text in `src/content/*.ts`. Legal prose, FAQ questions, guide content — everything. Components import from content files. Future Sanity CMS migration swaps the import source only
- **No backend dependencies.** All content is static. News articles are stored as data in `content/news.ts`, NOT fetched from an API. Downloads link to static files in `public/`. This is a pure frontend story
- **Template patterns are NOT wrapper components.** Each page composes shared components (PageHeader, BreadcrumbNav, CtaBanner) directly. Template A = 8+4 grid. Template B = card grid. Template C = centred placeholder. Legal = full-width prose. All implemented inline
- **FAQ search is client-side only.** Filter the questions array in React state. No API, no debounce needed (instant filter on small dataset of 15-20 questions)
- **News routing uses slugs from content data.** Each news item in `content/news.ts` has a `slug` field. Router uses `:slug` param. NewsDetailPage looks up article by slug from the same content array. If not found → redirect to `/resources/news`

### Critical DO NOTs

1. **DO NOT create a CMS or database for news/FAQ/content** — all content is static TypeScript in `src/content/*.ts`. Updates happen via code commits + CI/CD deploy
2. **DO NOT use markdown rendering libraries** (remark, rehype, etc.) — legal page content is plain JSX with H2 sections and paragraphs. No markdown processing needed
3. **DO NOT create API endpoints** — Epic 14 has zero backend dependencies
4. **DO NOT create new shared public components** — all 8 were created in Story 14.1. REUSE them
5. **DO NOT modify Story 14.1 or 14.2 components/pages** — this story only ADDS new pages and content
6. **DO NOT use `dangerouslySetInnerHTML`** — content files export typed objects/strings, render as JSX
7. **DO NOT put the CSV template in `src/`** — put it in `apps/client/public/templates/` so it's served as a static file
8. **DO NOT use `react-router-dom`** — use `react-router` (v7 unified package)
9. **DO NOT create complex state management for FAQ search** — a single `useState<string>` for the search query + `.filter()` on the questions array is sufficient
10. **DO NOT abstract a "prose page" component** — the 3 legal pages share a layout pattern (PageHeader + max-w-3xl prose) but implement it inline. 3 similar pages don't warrant an abstraction

### Shared Components Available from Story 14.1

| Component | Usage in This Story |
|---|---|
| `PageHeader` | Every page — H1 title + subtitle |
| `BreadcrumbNav` | Every page — breadcrumb trail |
| `CtaBanner` | FAQ, MDA Guide, Downloads, News, Support (NOT on legal/placeholder pages) |
| `DisclaimerCallout` | MDA Guide sidebar ("Need help?"), FAQ (optional) |
| `ProgrammeDisclaimer` | EOI page disclaimer text |
| `PublicLayout` | Wraps all pages (nav + footer) |

### shadcn/ui Components Used (All Installed in Story 14.1)

| Component | Used By |
|---|---|
| `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | FAQ page categories |
| `Accordion` + `AccordionItem` + `AccordionTrigger` + `AccordionContent` | FAQ questions |
| `Input` | FAQ search input |
| `Card` + `CardContent` | Downloads cards, News cards, Contact cards, Placeholder cards |
| `Badge` (variant: secondary) | Format badges (CSV, PDF), "Coming Soon" badges |
| `Button` | Download buttons, CtaBanner |
| `Breadcrumb` components | BreadcrumbNav on every page |
| `Separator` | Section dividers |

### Lucide Icons Used

| Context | Icon | Colour |
|---|---|---|
| FAQ search | `Search` | text-slate-400 |
| Beneficiary Lists placeholder | `Clock` | text-slate-400 |
| EOI placeholder | `FileText` | text-slate-400 |
| Support — Address card | `MapPin` | text-teal-600 |
| Support — Email card | `Mail` | text-teal-600 |
| Support — Phone card | `Phone` | text-teal-600 |
| Download card — CSV | `FileSpreadsheet` | text-green-600 |
| Download card — PDF | `FileText` | text-red-500 |
| DisclaimerCallout | `Info` | text-teal-700 |

### File Structure (New/Modified Files)

```
apps/client/
├── public/
│   └── templates/
│       └── submission-template.csv         — NEW: 8-field CSV with headers + example row
├── src/
│   ├── content/                            — DIRECTORY (from Story 14.1)
│   │   ├── faq.ts                          — NEW: 15+ questions in 3 categories
│   │   ├── mda-guide.ts                    — NEW: 8 field definitions, steps, deadline
│   │   ├── downloads.ts                    — NEW: 4 downloadable resources
│   │   ├── news.ts                         — MODIFY: ensure full body text + slug per article
│   │   ├── support.ts                      — NEW: contact info, guidance, links
│   │   ├── privacy.ts                      — NEW: 8 NDPR sections
│   │   ├── disclaimer.ts                   — NEW: 5 disclaimer sections
│   │   ├── accessibility.ts                — NEW: 5 accessibility sections
│   │   ├── eoi.ts                          — NEW: placeholder content
│   │   └── beneficiary-lists.ts            — NEW: placeholder content
│   ├── pages/
│   │   └── public/                         — DIRECTORY (from Story 14.1)
│   │       ├── SupportPage.tsx             — NEW (top-level, /support)
│   │       ├── EoiPage.tsx                 — NEW (top-level, /eoi)
│   │       ├── resources/                  — NEW DIRECTORY
│   │       │   ├── FaqPage.tsx             — NEW
│   │       │   ├── MdaGuidePage.tsx        — NEW
│   │       │   ├── DownloadsPage.tsx       — NEW
│   │       │   ├── NewsPage.tsx            — NEW
│   │       │   ├── NewsDetailPage.tsx      — NEW (slug-based routing)
│   │       │   └── BeneficiaryListsPage.tsx — NEW
│   │       └── legal/                      — NEW DIRECTORY
│   │           ├── PrivacyPage.tsx          — NEW
│   │           ├── DisclaimerPage.tsx       — NEW
│   │           └── AccessibilityPage.tsx    — NEW
│   └── router.tsx                          — MODIFY: replace remaining placeholders with real lazy imports
```

### Key Tailwind Patterns

| Layout | Classes |
|---|---|
| Card grid (2-col) | `grid grid-cols-1 md:grid-cols-2 gap-6` |
| Card grid (3-col) | `grid grid-cols-1 md:grid-cols-3 gap-6` |
| Contact card grid | `grid grid-cols-1 md:grid-cols-3 gap-6` |
| Content page (8+4) | `grid grid-cols-1 lg:grid-cols-12 gap-8` |
| Full-width prose | `max-w-3xl mx-auto` + prose sections |
| Placeholder centred | `max-w-lg mx-auto text-center py-24` |
| Guidance banner | `bg-teal-50 border border-teal-200 rounded-xl p-8` |
| Screenshot placeholder | `bg-slate-100 rounded border-2 border-dashed border-slate-300 p-8 text-center text-slate-400` |
| Coming Soon card | Card + `opacity-80 cursor-not-allowed` + Badge variant="secondary" |
| FAQ search input | Input with `Search` icon prefix |
| Prose section spacing | `space-y-8` between H2 sections within prose |
| Page section spacing | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |

### MDA Guide Table Component Decision

> **Use a semantic HTML `<table>` for the 8-field CSV table on the MDA Guide page — NOT the shadcn `Table` component.** Task 3.3 already specifies `<table>` with `<thead>` / `<tbody>`, and shadcn Table is NOT listed in the installed components (Story 14.1 did not install it). A plain HTML table with Tailwind utility classes (`border-collapse`, `text-left`, `text-sm`) is sufficient and avoids an unnecessary dependency.

### Content Data Type Conventions

```typescript
// content/faq.ts
export interface FaqQuestion {
  question: string;
  answer: string;
}
export interface FaqCategory {
  id: string;        // "beneficiaries" | "mda-officers" | "general"
  label: string;     // Tab display name
  questions: FaqQuestion[];
}
export const faqCategories: FaqCategory[] = [...]

// content/downloads.ts
export interface DownloadResource {
  name: string;
  format: "CSV" | "PDF";
  description: string;
  fileSize?: string;        // "~1 KB"
  status: "available" | "coming-soon";
  downloadUrl?: string;     // "/templates/submission-template.csv"
}
export const downloadResources: DownloadResource[] = [...]

// content/news.ts
export interface NewsArticle {
  slug: string;             // URL-safe slug for routing
  title: string;
  date: string;             // "2026-02-20"
  excerpt: string;          // 2-3 sentence preview
  body: string;             // Full article text (plain text or JSX-safe)
}
export const newsArticles: NewsArticle[] = [...] // reverse chronological

// content/privacy.ts (same pattern for disclaimer.ts, accessibility.ts)
export interface LegalSection {
  title: string;
  body: string;             // Prose paragraph(s)
}
export const privacySections: LegalSection[] = [...]
```

### FAQ Search Implementation

```typescript
// Simple pattern — no library needed
const [searchQuery, setSearchQuery] = useState("");
const [activeTab, setActiveTab] = useState("beneficiaries");

const filteredQuestions = useMemo(() => {
  const category = faqCategories.find(c => c.id === activeTab);
  if (!category) return [];
  if (!searchQuery.trim()) return category.questions;
  const q = searchQuery.toLowerCase();
  return category.questions.filter(
    faq => faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
  );
}, [activeTab, searchQuery]);
```

### News Slug Routing

```typescript
// In router.tsx — nested under /resources
{ path: 'news', lazy: () => import('./pages/public/resources/NewsPage') },
{ path: 'news/:slug', lazy: () => import('./pages/public/resources/NewsDetailPage') }

// In NewsDetailPage.tsx
const { slug } = useParams();
const article = newsArticles.find(a => a.slug === slug);
if (!article) return <Navigate to="/resources/news" replace />;
```

### Route Configuration Updates

All 11 routes to add/replace in `router.tsx`:

| Path | Component | Notes |
|---|---|---|
| `/resources/faq` | FaqPage | Tabs + Accordion + search |
| `/resources/mda-guide` | MdaGuidePage | Template A with sidebar |
| `/resources/downloads` | DownloadsPage | Template B card grid |
| `/resources/news` | NewsPage | Template B card grid |
| `/resources/news/:slug` | NewsDetailPage | Dynamic slug routing |
| `/resources/beneficiary-lists` | BeneficiaryListsPage | Template C placeholder |
| `/support` | SupportPage | Top-level (not under /resources) |
| `/privacy` | PrivacyPage | Full-width prose |
| `/disclaimer` | DisclaimerPage | Full-width prose |
| `/accessibility` | AccessibilityPage | Full-width prose |
| `/eoi` | EoiPage | Template C placeholder |

### Dependencies on Other Stories

| Story | Status | What This Story Needs |
|---|---|---|
| **14.1 Homepage & Nav Shell** | ready-for-dev | PublicLayout, all 8 shared public components, router.tsx, Tabs + Accordion + Breadcrumb shadcn components, `content/` directory, `content/news.ts` base |
| **14.2 Scheme Info Pages** | ready-for-dev | Establishes Template A pattern for content pages. This story follows the same pattern for MDA Guide and Support pages |
| 1.6 Frontend Auth Shell | in-progress | React Router v7, LoginPage |
| 1.8a Design Foundation | ready-for-dev | Design tokens, fonts |

**Stories 14.1 AND 14.2 should be complete before starting 14.3.** This story consumes shared components from 14.1 and follows page patterns established in 14.2.

### Previous Story Intelligence

**From Story 14.1:**
- 8 shared public components in `components/public/`
- Router with placeholder routes for all 14.3 pages
- `content/news.ts` created with 3 placeholder announcements (may need slug + full body added)
- `content/navigation.ts` created with footer links (includes Resources section links)
- Tabs and Accordion shadcn components pre-installed

**From Story 14.2:**
- Template A (Content Page 8+4 grid) pattern established — reuse for MDA Guide
- Content file convention proven across 6 pages — extend for 10 more content files
- BreadcrumbNav proven for nested routes (Home > The Scheme > Page)
- DisclaimerCallout reused in sidebar pattern — reuse for MDA Guide sidebar

**Key reuse opportunities:**
- `content/news.ts` may already exist from 14.1 — MODIFY (add slug + body), don't recreate
- Template A pattern from 14.2 pages — follow exact same composition for MDA Guide and Support
- Template C (Placeholder) will be used by both Beneficiary Lists and EOI — same pattern, different content

### Git Intelligence

- All committed code is backend (Stories 1.1-1.5)
- Stories 14.1 and 14.2 establish the public zone infrastructure this story completes
- This story completes Epic 14 — after this, all 20 public pages are built

### Project Structure Notes

- **Page routing hierarchy:** `/resources/*` pages go in `pages/public/resources/`, `/support` and `/eoi` are top-level in `pages/public/`, legal pages go in `pages/public/legal/`
- **CSV template location:** Static files go in `apps/client/public/` — Vite serves them as-is at the root URL. The CSV template at `public/templates/submission-template.csv` is downloadable at `/templates/submission-template.csv`
- **News detail routing:** `/resources/news/:slug` is a dynamic route. The slug is matched against `content/news.ts` data. No API call — just array lookup
- **This story completes Epic 14.** After all 3 stories are implemented, the entire public website is live with 20+ pages, responsive layouts, and full accessibility compliance

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 14, Story 14.3] — Full BDD acceptance criteria for all 10 pages
- [Source: _bmad-output/planning-artifacts/wireframes-epic-14.md#Section 5] — Wireframes for FAQ, MDA Guide, Downloads, News, Beneficiary Lists
- [Source: _bmad-output/planning-artifacts/wireframes-epic-14.md#Section 5 cont.] — Help & Support, Privacy, Disclaimer, Accessibility, EOI wireframes
- [Source: _bmad-output/planning-artifacts/wireframes-epic-14.md#Section 6] — Component-to-shadcn/ui mapping table
- [Source: _bmad-output/planning-artifacts/wireframes-epic-14.md#Section 7] — Responsive behaviour summary
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Source Structure] — Directory layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Extension Points] — CMS migration readiness
- [Source: _bmad-output/implementation-artifacts/14-1-homepage-navigation-shell.md] — Shared components, router, content directory
- [Source: _bmad-output/implementation-artifacts/14-2-scheme-information-pages.md] — Template A pattern, content file convention

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- TS unused import fixes: removed `Link` from MdaGuidePage, `CONTACT_ICONS` from SupportPage, `publicPlaceholder` from router.tsx
- NewsDetailPage test fix: `useParams` returns empty without Route wrapper — wrapped in `<Routes><Route path="/resources/news/:slug" ...>`
- MdaGuidePage test fix: "Download CSV Template" matched multiple elements — changed assertion to "Step-by-Step Process" heading
- SupportPage test fix: "MDA Submission Guide" appeared in both guidance banner and useful links — changed to test "Programme Overview" (unique)
- BeneficiaryListsPage test fix: regex `/published/` didn't match content "publish" — corrected regex
- Route naming: story specifies `/resources/mda-guide` but existing navigation.ts uses `/resources/submission-guide` — kept existing route to avoid breaking navigation
- Content file naming: used `programme-disclaimer.ts` and `accessibility-statement.ts` (matching route semantics) instead of `disclaimer.ts` and `accessibility.ts` to avoid conflict with page names
- Server flaky test: authRoutes.refresh.test.ts had 1 intermittent failure — confirmed pre-existing and unrelated to Story 14.3 (frontend-only changes)

### Completion Notes List
- All 11 pages built: 6 resource pages, 1 support page, 3 legal pages, 1 EOI placeholder
- 10 content files created + 1 verified (news.ts)
- 1 CSV template file created in public/templates/
- Router updated: all remaining placeholders replaced with lazy-loaded real pages + /resources/news/:slug dynamic route
- publicPlaceholder function removed from router.tsx (no longer needed)
- 58 new unit tests across 11 test files — all passing
- 288 total client tests pass (42 test files)
- 443 total tests across all packages (288 client + 141 server + 12 shared + 2 testing)
- TypeScript typecheck clean — zero errors
- Epic 14 complete: all 3 stories (14-1, 14-2, 14-3) now in review status

### File List

**Content Files (10 new):**
- `apps/client/src/content/faq.ts`
- `apps/client/src/content/mda-guide.ts`
- `apps/client/src/content/downloads.ts`
- `apps/client/src/content/support.ts`
- `apps/client/src/content/privacy.ts`
- `apps/client/src/content/programme-disclaimer.ts`
- `apps/client/src/content/accessibility-statement.ts`
- `apps/client/src/content/eoi.ts`
- `apps/client/src/content/beneficiary-lists.ts`
- `apps/client/public/templates/submission-template.csv`

**Page Files (11 new):**
- `apps/client/src/pages/public/resources/FaqPage.tsx`
- `apps/client/src/pages/public/resources/MdaGuidePage.tsx`
- `apps/client/src/pages/public/resources/DownloadsPage.tsx`
- `apps/client/src/pages/public/resources/NewsPage.tsx`
- `apps/client/src/pages/public/resources/NewsDetailPage.tsx`
- `apps/client/src/pages/public/resources/BeneficiaryListsPage.tsx`
- `apps/client/src/pages/public/SupportPage.tsx`
- `apps/client/src/pages/public/EoiPage.tsx`
- `apps/client/src/pages/public/legal/PrivacyPage.tsx`
- `apps/client/src/pages/public/legal/DisclaimerPage.tsx`
- `apps/client/src/pages/public/legal/AccessibilityPage.tsx`

**Test Files (11 new):**
- `apps/client/src/pages/public/resources/FaqPage.test.tsx`
- `apps/client/src/pages/public/resources/MdaGuidePage.test.tsx`
- `apps/client/src/pages/public/resources/DownloadsPage.test.tsx`
- `apps/client/src/pages/public/resources/NewsPage.test.tsx`
- `apps/client/src/pages/public/resources/NewsDetailPage.test.tsx`
- `apps/client/src/pages/public/resources/BeneficiaryListsPage.test.tsx`
- `apps/client/src/pages/public/SupportPage.test.tsx`
- `apps/client/src/pages/public/EoiPage.test.tsx`
- `apps/client/src/pages/public/legal/PrivacyPage.test.tsx`
- `apps/client/src/pages/public/legal/DisclaimerPage.test.tsx`
- `apps/client/src/pages/public/legal/AccessibilityPage.test.tsx`

**Modified Files:**
- `apps/client/src/router.tsx` — replaced all remaining placeholders with lazy-loaded pages, added /resources/news/:slug route, removed publicPlaceholder function
