---
title: 'Epic 14 — Public Website Wireframes & Implementation Guide'
epic: 14
stories: [14.1, 14.2, 14.3]
status: approved
date: '2026-02-21'
lastEdited: '2026-02-21'
editHistory:
  - date: '2026-02-21'
    changes: 'Asset inventory & actual leadership roster: Replaced placeholder names/photos with actual AG Office leadership (6 officers from docs/team_pics/). Added Section 10 — Asset Inventory with source→target file mapping, image optimisation requirements (240x240 retina team photos, SVG/WebP/PNG crest variants), naming convention, and usage matrix. Updated About page wireframe with all 6 leadership cards showing real names, full office titles, institutional role descriptions, and photo slugs. Added card ordering note (hierarchy = display order, do not re-sort). Updated leadership card component notes with full-title requirement and personnel rotation guidance.'
  - date: '2026-02-20'
    changes: 'About page wireframe: Added About the Programme page replacing AG Office page. Updated PublicNavBar (About as top-level item, AG Office removed from The Scheme dropdown). Updated footer. Added leadership card wireframe with role-title-prominent design.'
  - date: '2026-02-20'
    changes: 'Initial creation: ASCII wireframes for all 20 public pages, 4 page templates, 8 shared components, SEO meta tags, responsive annotations, build order.'
---

# Epic 14 — Public Website Wireframes & Implementation Guide

> **Purpose:** ASCII wireframes with component annotations, responsive layouts, actual copy direction, and reusable page templates. Designed so implementation is paint-by-numbers.

> **Design System Reference:** `_bmad-output/planning-artifacts/ux-design-specification.md`
> **Story ACs:** `_bmad-output/planning-artifacts/epics.md` → Epic 14

---

## Table of Contents

1. [Page Templates](#1-page-templates)
2. [Shared Components](#2-shared-components)
3. [Story 14.1 — Homepage & Navigation Shell](#3-story-141--homepage--navigation-shell)
4. [Story 14.2 — Scheme Information Pages](#4-story-142--scheme-information-pages)
5. [Story 14.3 — Resources, Support & Legal Pages](#5-story-143--resources-support--legal-pages)
6. [Component–to–shadcn/ui Mapping](#6-componentshadcnui-mapping)
7. [Responsive Behaviour Summary](#7-responsive-behaviour-summary)

---

## 1. Page Templates

> **Key insight:** 20 pages share 4 layout templates. Implement the templates first, then each page is just content.

### Template A — Content Page

Used by: About the Programme, Programme Overview, About VLPRS, Eligibility, Repayment, How It Works, MDA Guide, Privacy, Disclaimer, Accessibility, Help & Support

```
┌─────────────────────────────────────────────────────────────────────┐
│  [PublicLayout: Navigation Bar]                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Home > Section > Page Name                    ← Breadcrumb        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Page Title (H1)                                             │   │
│  │  Subtitle / introductory paragraph                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐   │
│  │                              │  │  Sidebar Callout (opt.)  │   │
│  │  Main Content Area           │  │                          │   │
│  │  (8 cols)                    │  │  (4 cols)                │   │
│  │                              │  │  - Key info card         │   │
│  │  Prose, accordions, cards,   │  │  - Disclaimer callout    │   │
│  │  tables, lists               │  │  - Related links         │   │
│  │                              │  │                          │   │
│  └──────────────────────────────┘  └──────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Optional CTA Banner]  "Ready to access VLPRS?"            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [PublicLayout: Footer]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile (<768px):** Sidebar callout stacks below main content (full-width).

**Tailwind:** `grid grid-cols-1 lg:grid-cols-12 gap-8` → main `lg:col-span-8`, sidebar `lg:col-span-4`

---

### Template B — Card Grid Page

Used by: Downloads & Forms, News & Announcements

```
┌─────────────────────────────────────────────────────────────────────┐
│  [PublicLayout: Navigation Bar]                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Home > Resources > Page Name                  ← Breadcrumb        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Page Title (H1)                                             │   │
│  │  Subtitle                                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Optional: Search / Filter bar]                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Card 1      │  │  Card 2      │  │  Card 3      │             │
│  │  Title       │  │  Title       │  │  Title       │             │
│  │  Description │  │  Description │  │  Description │             │
│  │  [Badge]     │  │  [Badge]     │  │  [Badge]     │             │
│  │  [Action]    │  │  [Action]    │  │  [Action]    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  Card 4      │  │  Card 5      │   ...                          │
│  └──────────────┘  └──────────────┘                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [PublicLayout: Footer]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile:** Cards stack single-column. **Tablet:** 2-column grid.

**Tailwind:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

---

### Template C — Placeholder Page

Used by: Approved Beneficiary Lists, Expression of Interest

```
┌─────────────────────────────────────────────────────────────────────┐
│  [PublicLayout: Navigation Bar]                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Home > Section > Page Name                    ← Breadcrumb        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │          ┌─────────────────────────────┐                      │   │
│  │          │     🕐  (Clock icon)        │                      │   │
│  │          │                             │                      │   │
│  │          │   Coming Soon — Phase 2     │                      │   │
│  │          │                             │                      │   │
│  │          │   [Description of what      │                      │   │
│  │          │    this page will enable]   │                      │   │
│  │          │                             │                      │   │
│  │          │   Expected: [Timeline]      │                      │   │
│  │          │                             │                      │   │
│  │          │   ┌───────────────────┐     │                      │   │
│  │          │   │ Related Links     │     │                      │   │
│  │          │   │ → How It Works    │     │                      │   │
│  │          │   │ → Contact Support │     │                      │   │
│  │          │   └───────────────────┘     │                      │   │
│  │          └─────────────────────────────┘                      │   │
│  │                                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [PublicLayout: Footer]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Tailwind:** `max-w-lg mx-auto text-center py-24`

---

### Template D — Homepage (unique, one-off)

Full wireframe in [Section 3](#3-story-141--homepage--navigation-shell) below.

---

### Template E — FAQ Page (unique, one-off)

Full wireframe in [Section 5 → FAQ](#faq-page-resourcesfaq) below.

---

## 2. Shared Components

> Components that appear on 2+ pages. Build these first.

### 2.1 PublicNavBar

**Component:** `components/public/PublicNavBar.tsx`
**shadcn:** `NavigationMenu` + `NavigationMenuList` + `NavigationMenuTrigger` + `NavigationMenuContent` (desktop), `Sheet` + `SheetTrigger` + `SheetContent` (mobile)

```
DESKTOP (≥768px):
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Crest] Vehicle Loan Scheme    Home  About  The Scheme▾  How It Works     │
│          Accountant-General's Office          Resources▾   Help & Support   │
│                                                            [Staff Login]    │
└──────────────────────────────────────────────────────────────────────────────┘
                                                              ↑ Button
                                   ↑ direct link to /about      variant="default"
                                                              bg: --button-primary

The Scheme ▾ dropdown:              Resources ▾ dropdown:
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│ Programme Overview             │  │ Frequently Asked Questions         │
│ About VLPRS                    │  │ MDA Submission Guide               │
│ Eligibility & Loan Categories  │  │ Downloads & Forms                  │
│ Repayment & Settlement Rules   │  │ News & Announcements               │
└────────────────────────────────┘  │ Approved Beneficiary Lists [Soon]  │
                                    └────────────────────────────────────┘

MOBILE (<768px):
┌─────────────────────────────────────────────┐
│  [Crest] Vehicle Loan Scheme     [≡] [Login]│
└─────────────────────────────────────────────┘
                                    ↑ Sheet trigger

Sheet overlay (slide from left):
┌──────────────────────────┐
│  Home                    │
│  About                   │
│  The Scheme              │
│    Programme Overview    │
│    About VLPRS           │
│    Eligibility           │
│    Repayment Rules       │
│  How It Works            │
│  Resources               │
│    FAQ                   │
│    MDA Guide             │
│    Downloads             │
│    News                  │
│    Beneficiary Lists     │
│  Help & Support          │
│                          │
│  [Staff Login]           │
└──────────────────────────┘
```

**Sticky:** `sticky top-0 z-50`
**Glassmorphism:** `bg-white/80 backdrop-blur-md border-b border-slate-200`
**Crest:** Oyo State Government crest, `h-10 w-auto`
**Wordmark:** "Vehicle Loan Scheme" `text-lg font-semibold text-slate-900`, "Accountant-General's Office" `text-xs text-slate-500`
**"Coming Soon" badge on Beneficiary Lists:** `<Badge variant="outline">Coming Soon</Badge>`

---

### 2.2 LoginModal

**Component:** `components/public/LoginModal.tsx`
**shadcn:** `Dialog` + `DialogTrigger` + `DialogContent` + `DialogHeader` + `DialogTitle`
**Trigger:** "Staff Login" button in nav bar

```
┌─────────────────────────────────────────────────┐
│  Access VLPRS                              [✕]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ● Staff Portal                    [→]  │    │
│  │  For authorised MDA officers,            │    │
│  │  department staff, and administrators    │    │
│  │                          [Login to       │    │
│  │                           Dashboard]     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ○ Beneficiary Portal        [Soon]     │    │
│  │  View your loan status and documents     │    │
│  │                      Coming Soon — P2    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ○ Expression of Interest    [Soon]     │    │
│  │  Register interest in the scheme         │    │
│  │                      Coming Soon — P2    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ─────────────────────────────────────────────  │
│  All portal access is role-based. Contact       │
│  your department for account setup.             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Accessibility:** `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close
**Staff Portal card:** `border-l-4 border-[--button-primary]` (Oyo Crimson left accent)
**Disabled cards:** `opacity-60 cursor-not-allowed`
**"Login to Dashboard" button:** `<Button>` links to `/login`
**"Coming Soon" badges:** `<Badge variant="secondary">`

---

### 2.3 PublicFooter

**Component:** `components/public/PublicFooter.tsx`
**shadcn:** `Separator`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  bg: slate-900  text: slate-300                                         │
│                                                                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐  │
│  │ ABOUT &       │ │ RESOURCES     │ │ CONTACT       │ │ PORTAL     │  │
│  │ SCHEME        │ │               │ │               │ │            │  │
│  │               │ │ FAQs          │ │ Accountant-   │ │ Staff      │  │
│  │ About the     │ │ MDA Guide     │ │  General's    │ │  Login     │  │
│  │  Programme    │ │ Downloads     │ │  Office       │ │            │  │
│  │ Programme     │ │ News          │ │ Ibadan,       │ │            │  │
│  │  Overview     │ │               │ │  Oyo State    │ │            │  │
│  │ Eligibility   │ │               │ │ email@oyo.gov │ │            │  │
│  │ Repayment     │ │               │ │ +234 xxx xxxx │ │            │  │
│  │ How It Works  │ │               │ │ Mon-Fri       │ │            │  │
│  │ About VLPRS   │ │               │ │ 8am-6pm WAT   │ │            │  │
│  └───────────────┘ └───────────────┘ └───────────────┘ └────────────┘  │
│                                                                         │
│  ─── Separator ─────────────────────────────────────────────────────── │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PROGRAMME DISCLAIMER                                           │   │
│  │  This portal provides general programme information. Loan       │   │
│  │  approvals, payroll deductions, and gratuity processing remain  │   │
│  │  subject to applicable government procedures and committee      │   │
│  │  decisions.                                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Privacy & Data Protection  ·  Accessibility  ·  Programme Disclaimer  │
│                                                                         │
│  ─── Separator ─────────────────────────────────────────────────────── │
│                                                                         │
│  © 2026 Oyo State Government. All rights reserved.                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tailwind:** `bg-slate-900 text-slate-300`
**Columns:** `grid grid-cols-2 md:grid-cols-4 gap-8`
**Column headers:** `text-sm font-semibold text-white uppercase tracking-wider`
**Links:** `text-sm text-slate-400 hover:text-white transition-colors`
**Disclaimer box:** `bg-slate-800 rounded-lg p-4 text-xs text-slate-400`
**Legal links:** `text-xs text-slate-500 hover:text-slate-300`
**Copyright:** `text-xs text-slate-500`

---

### 2.4 BreadcrumbNav

**Component:** `components/public/BreadcrumbNav.tsx`
**shadcn:** `Breadcrumb` + `BreadcrumbList` + `BreadcrumbItem` + `BreadcrumbLink` + `BreadcrumbSeparator` + `BreadcrumbPage`

```
Home  >  The Scheme  >  Eligibility & Loan Categories
 ↑ link   ↑ link         ↑ current (text, not link)
```

**Tailwind:** `py-4 text-sm text-slate-500`

---

### 2.5 PageHeader

**Component:** `components/public/PageHeader.tsx`
**Props:** `title: string`, `subtitle?: string`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Page Title Here                           ← H1, text-3xl      │
│  Subtitle or introductory paragraph here   ← text-lg           │
│                                               text-slate-600   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tailwind:** `pb-8 border-b border-slate-200 mb-8`

---

### 2.6 CtaBanner

**Component:** `components/public/CtaBanner.tsx`
**Props:** `title: string`, `primaryLabel: string`, `primaryHref: string`, `secondaryLabel?: string`, `secondaryHref?: string`

```
┌─────────────────────────────────────────────────────────────────┐
│  bg: slate-50  border: slate-200  rounded-xl                    │
│                                                                 │
│           Ready to access VLPRS?                                │
│                                                                 │
│       [  Staff Login  ]    [ Contact Support ]                  │
│        ↑ primary              ↑ secondary (outline)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tailwind:** `bg-slate-50 border border-slate-200 rounded-xl py-12 text-center`

---

### 2.7 DisclaimerCallout

**Component:** `components/public/DisclaimerCallout.tsx`
**Props:** `text: string`
**shadcn:** `Alert` (custom variant)

```
┌─────────────────────────────────────────────────┐
│  ℹ  Key Clarification                          │
│                                                 │
│  VLPRS supports record accuracy and             │
│  reconciliation. It does not replace payroll    │
│  authority or gratuity processing procedures.   │
│                                                 │
│  → See FAQ for more details                     │
└─────────────────────────────────────────────────┘
```

**Tailwind:** `bg-teal-50 border border-teal-200 rounded-lg p-4`
**Icon:** Info circle in `text-teal-700`

---

### 2.8 ProgrammeDisclaimer

**Component:** `components/public/ProgrammeDisclaimer.tsx`
**Used on:** Homepage hero, EOI page, any page referencing loan approvals

```
┌─────────────────────────────────────────────────┐
│  bg-slate-50  text-xs  text-slate-500           │
│                                                 │
│  Expression of Interest submission does not     │
│  constitute loan approval. All approvals remain │
│  subject to committee decision under existing   │
│  government procedures.                         │
└─────────────────────────────────────────────────┘
```

---

## 3. Story 14.1 — Homepage & Navigation Shell

### 3.1 Full Homepage Wireframe (Desktop)

```
┌═════════════════════════════════════════════════════════════════════════┐
│  NAVIGATION BAR (sticky, glassmorphism)                                │
│  [Crest] Vehicle Loan Scheme    Home  About  The Scheme▾  How It Works │
│          AG's Office                          Resources▾  Help&Support  │
│                                                           [Staff Login] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ════════════════════════ HERO SECTION ════════════════════════════════ │
│                                                                         │
│  ┌────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  [Oyo State Crest]            │  │  OFFICIAL PROGRAMME NOTICE   │  │
│  │                               │  │                              │  │
│  │  Vehicle Loan Scheme    (H1)  │  │  • Approvals remain          │  │
│  │                               │  │    committee-based and       │  │
│  │  An official staff welfare    │  │    policy-led                │  │
│  │  programme administered       │  │                              │  │
│  │  through the Accountant-      │  │  • Repayment is primarily    │  │
│  │  General's Office. VLPRS      │  │    through payroll           │  │
│  │  provides structured record-  │  │    deductions; retirement    │  │
│  │  keeping, transparent         │  │    cases handled via         │  │
│  │  reporting, and auditable     │  │    gratuity settlement       │  │
│  │  repayment tracking.          │  │                              │  │
│  │                               │  │  • Records maintained with   │  │
│  │  [Staff Login] [Learn How →]  │  │    audit trails for          │  │
│  │   ↑ primary    ↑ ghost/link   │  │    accuracy and              │  │
│  │                               │  │    accountability            │  │
│  │                               │  │                              │  │
│  │                               │  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │  │
│  │                               │  │  Data handled per NDPR      │  │
│  │       7 cols                  │  │       5 cols                 │  │
│  └────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                         │
│  bg: subtle gradient (slate-50 → white)                                │
│                                                                         │
│  ══════════════════════ TRUST STRIP ══════════════════════════════════ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Administered by the Accountant-General's Office                │   │
│  │                                                                 │   │
│  │  [NDPR-aligned handling]  [Audit-ready reporting]  [Committee   │   │
│  │                                                     approvals   │   │
│  │   ↑ Badge outline          ↑ Badge outline          preserved]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  bg: white  border-y: slate-200  text-center                           │
│                                                                         │
│  ════════════════════ HOW IT WORKS ═══════════════════════════════════ │
│                                                                         │
│  How the Scheme Works                                            (H2)  │
│  Clear steps from Expression of Interest to repayment completion       │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  ① ──────→   │ │  ② ──────→   │ │  ③ ──────→   │ │  ④           │  │
│  │              │ │              │ │              │ │              │  │
│  │ Expression  │ │ Administra-  │ │ Committee    │ │ Payroll      │  │
│  │ of Interest │ │ tive Review  │ │ Decision     │ │ Repayment    │  │
│  │              │ │              │ │              │ │              │  │
│  │ Submit      │ │ Applications │ │ Approvals    │ │ Approved     │  │
│  │ interest    │ │ are screened │ │ determined   │ │ loans repaid │  │
│  │ digitally   │ │ and prepared │ │ by the       │ │ via payroll. │  │
│  │ and receive │ │ for commit-  │ │ designated   │ │ Completion   │  │
│  │ a reference │ │ tee consi-   │ │ committee.   │ │ triggers     │  │
│  │ number.     │ │ deration.    │ │ Portal does  │ │ clearance.   │  │
│  │              │ │              │ │ not approve. │ │              │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                         │
│  ⚠ Expression of Interest does not constitute loan approval             │
│  ↑ text-sm text-slate-500 italic                                       │
│                                                                         │
│  Component: Card  |  Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4  │
│  Step badge: Badge variant="default" (Oyo Crimson bg, white text)      │
│  Arrow: hidden on mobile, visible lg: (CSS pseudo-element or icon)     │
│                                                                         │
│  ═══════════════ ELIGIBILITY & LOAN CATEGORIES ══════════════════════ │
│                                                                         │
│  Eligibility & Loan Categories                                   (H2)  │
│  Loan limits determined by salary grade levels under the scheme        │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │  Levels 1–6      │  │  Levels 7–8      │                            │
│  │                   │  │                   │                            │
│  │  Up to            │  │  Up to            │                            │
│  │  ₦250,000         │  │  ₦450,000         │                            │
│  │  ↑ text-2xl bold  │  │  ↑ text-2xl bold  │                            │
│  │  JetBrains Mono   │  │  JetBrains Mono   │                            │
│  │                   │  │                   │                            │
│  │  Standard tenure: │  │  Standard tenure: │                            │
│  │  60 months        │  │  60 months        │                            │
│  │                   │  │                   │                            │
│  │  See repayment →  │  │  See repayment →  │                            │
│  └──────────────────┘  └──────────────────┘                            │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │  Levels 9–10     │  │  Levels 12+      │                            │
│  │                   │  │                   │                            │
│  │  Up to            │  │  Up to            │                            │
│  │  ₦600,000         │  │  ₦750,000         │                            │
│  │                   │  │                   │                            │
│  │  Standard tenure: │  │  Standard tenure: │                            │
│  │  60 months        │  │  60 months        │                            │
│  │                   │  │                   │                            │
│  │  See repayment →  │  │  See repayment →  │                            │
│  └──────────────────┘  └──────────────────┘                            │
│                                                                         │
│  Eligibility is subject to scheme rules, including tenure-to-          │
│  retirement provisions.                                                │
│  ↑ text-sm text-slate-500                                              │
│                                                                         │
│  Component: Card  |  Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4  │
│  Amount: font-mono text-2xl font-bold text-slate-900                   │
│  "See repayment" link: text-teal-700 hover:underline                   │
│                                                                         │
│  ═══════════════════ KEY CAPABILITIES ════════════════════════════════ │
│                                                                         │
│  What VLPRS Delivers                                             (H2)  │
│                                                                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │
│  │  🔒               │ │  🧮               │ │  ✓               │       │
│  │  Immutable        │ │  Computed         │ │  Auto-Stop       │       │
│  │  Financial Ledger │ │  Balances         │ │  Certificates    │       │
│  │                   │ │                   │ │                   │       │
│  │  Banking-grade    │ │  Derived from     │ │  Automatic       │       │
│  │  record integrity │ │  ledger entries — │ │  deduction       │       │
│  │  — every trans-   │ │  never stored,    │ │  cessation upon  │       │
│  │  action append-   │ │  never manually   │ │  loan completion │       │
│  │  only, auditor-   │ │  edited. One      │ │  — guaranteed.   │       │
│  │  verifiable.      │ │  formula for all. │ │                   │       │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘       │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │
│  │  📊               │ │  🤝               │ │  📋               │       │
│  │  Real-Time        │ │  Non-Punitive    │ │  Audit-Ready     │       │
│  │  Executive        │ │  Design          │ │  from Day One    │       │
│  │  Dashboard        │ │                   │ │                   │       │
│  │  Scheme-wide      │ │  Comparisons,    │ │  Every action    │       │
│  │  status visible   │ │  not accusations.│ │  logged. Full    │       │
│  │  on any device    │ │  Variances, not  │ │  computation     │       │
│  │  in under 3       │ │  mistakes.       │ │  chain recon-    │       │
│  │  seconds.         │ │  Adoption        │ │  structable by   │       │
│  │                   │ │  through trust.  │ │  any auditor.    │       │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘       │
│                                                                         │
│  Component: Card  |  Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3  │
│  Icons: Lucide React icons (Lock, Calculator, CheckCircle,            │
│          LayoutDashboard, Handshake, ClipboardCheck)                   │
│  Icon colour: text-teal-600                                            │
│                                                                         │
│  ═══════════════ REPAYMENT & SETTLEMENT RULES ═══════════════════════ │
│                                                                         │
│  Repayment & Settlement Rules                                    (H2)  │
│  Repayment structures are policy-defined                               │
│                                                                         │
│  ┌──────────────────────────────────┐ ┌────────────────────────────┐   │
│  │  ACCORDION (left, 8 cols)       │ │  KEY CLARIFICATION (4 col) │   │
│  │                                 │ │                            │   │
│  │  ▼ Standard Repayment          │ │  ℹ                         │   │
│  │    60-month tenure, monthly     │ │                            │   │
│  │    principal + interest via     │ │  VLPRS supports record     │   │
│  │    payroll. 2-month moratorium  │ │  accuracy and              │   │
│  │    at loan start.              │ │  reconciliation. It does   │   │
│  │                                 │ │  not replace payroll       │   │
│  │  ▶ Accelerated Repayment       │ │  authority or gratuity     │   │
│  │                                 │ │  processing procedures.    │   │
│  │  ▶ Early Principal Settlement  │ │                            │   │
│  │                                 │ │  → See FAQ                 │   │
│  │  ▶ Retirement & Gratuity       │ │                            │   │
│  │    Settlement                   │ │  bg: teal-50              │   │
│  │                                 │ │  border: teal-200         │   │
│  └──────────────────────────────────┘ └────────────────────────────┘   │
│                                                                         │
│  Component: Accordion (left) + DisclaimerCallout (right)               │
│  Mobile: stacks vertically, callout below accordion                    │
│  Grid: grid-cols-1 lg:grid-cols-12  →  lg:col-span-8 + lg:col-span-4 │
│                                                                         │
│  ═══════════════════ WHO VLPRS SERVES ═══════════════════════════════ │
│                                                                         │
│  Who VLPRS Serves                                                (H2)  │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│  │ Accountant  │ │ Deputy AG   │ │ Car Loan    │ │ MDA         │     │
│  │ General     │ │             │ │ Department  │ │ Officers    │     │
│  │             │ │ Pattern     │ │             │ │ — 63        │     │
│  │ Instant     │ │ detection   │ │ Reports in  │ │             │     │
│  │ scheme-wide │ │ and excep-  │ │ seconds,    │ │ Submit 8    │     │
│  │ visibility  │ │ tion in-    │ │ not days.   │ │ fields      │     │
│  │ from any    │ │ vestigation │ │             │ │ instead of  │     │
│  │ device.     │ │             │ │             │ │ computing   │     │
│  │             │ │             │ │             │ │ 17 columns. │     │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │
│                          ┌─────────────┐                               │
│                          │ Benefi-     │                               │
│                          │ ciaries     │                               │
│                          │ — 3,100+    │                               │
│                          │             │                               │
│                          │ Protection  │                               │
│                          │ from over-  │                               │
│                          │ deduction — │                               │
│                          │ guaranteed. │                               │
│                          └─────────────┘                               │
│                                                                         │
│  Grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-5                      │
│  (5th card centres on mobile via col-span trick or flex justify)       │
│  Alt: grid-cols-2 lg:grid-cols-4 with 5th card full-width centred     │
│  Component: Card with role title as H3                                 │
│                                                                         │
│  ═══════════════ TRUST & COMPLIANCE ═════════════════════════════════ │
│                                                                         │
│  Trust & Compliance                                              (H2)  │
│                                                                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │
│  │  🛡               │ │  📝               │ │  🔗               │       │
│  │  NDPR Compliant  │ │  Audit-Ready     │ │  Immutable       │       │
│  │                   │ │                   │ │  Ledger          │       │
│  │  Privacy notices, │ │  Every action    │ │                   │       │
│  │  data minimisa-  │ │  logged with     │ │  No record can   │       │
│  │  tion, consent   │ │  user, timestamp,│ │  be altered or   │       │
│  │  capture.        │ │  role, and IP.   │ │  deleted — ever. │       │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘       │
│                                                                         │
│  Grid: grid-cols-1 md:grid-cols-3  |  Component: Card                  │
│  Icons: Lucide (Shield, FileText, Link2)  colour: text-teal-600       │
│                                                                         │
│  ═══════════════════ ENDORSEMENT BANNER ═════════════════════════════ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  bg: slate-50  border-l-4 border-[--button-primary]            │   │
│  │                                                                 │   │
│  │  ❝                                                              │   │
│  │     [Placeholder quote — to be provided by                      │   │
│  │      the Accountant General's office]                           │   │
│  │                                                                 │   │
│  │     — Accountant General, Oyo State                             │   │
│  │  ❞                                                              │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Component: custom Blockquote  |  text-xl italic text-slate-700       │
│  Attribution: text-sm font-semibold text-slate-900                    │
│                                                                         │
│  ════════════════════════ NEWS ═══════════════════════════════════════ │
│                                                                         │
│  News & Announcements                                            (H2)  │
│                                                                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐       │
│  │  Feb 2026        │ │  Feb 2026        │ │  Jan 2026        │       │
│  │                   │ │                   │ │                   │       │
│  │  System deployed │ │  Migration       │ │  Beneficiary     │       │
│  │  to 63 MDAs      │ │  Phase 1         │ │  Portal coming   │       │
│  │                   │ │  underway        │ │  Phase 2         │       │
│  │  Short excerpt   │ │                   │ │                   │       │
│  │  of the announce-│ │  Short excerpt   │ │  Short excerpt   │       │
│  │  ment goes here. │ │  goes here.      │ │  goes here.      │       │
│  │                   │ │                   │ │                   │       │
│  │  Read more →     │ │  Read more →     │ │  Read more →     │       │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘       │
│                                                                         │
│  Grid: grid-cols-1 md:grid-cols-3  |  Component: Card                  │
│  Date: text-sm text-slate-500  |  Title: font-semibold                │
│  "Read more": text-teal-700 hover:underline                           │
│                                                                         │
│  ═══════════════════════ FINAL CTA ══════════════════════════════════ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  bg: slate-900  text: white  py-16  text-center                │   │
│  │                                                                 │   │
│  │           Ready to access VLPRS?                                │   │
│  │                                                                 │   │
│  │       [ Staff Login ]    [ Contact Support ]                    │   │
│  │        ↑ white bg,        ↑ white outline,                      │   │
│  │          slate-900 text     white text                          │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Note: Button colours invert in dark section                           │
│                                                                         │
│  ═══════════════════════ FOOTER ═════════════════════════════════════ │
│                                                                         │
│  [See Shared Component 2.3 — PublicFooter]                             │
│                                                                         │
└═════════════════════════════════════════════════════════════════════════┘
```

### 3.2 Homepage — Mobile Layout (<768px)

Key differences from desktop:

```
┌─────────────────────────────┐
│ [Crest] Vehicle Loan  [≡][→]│  ← Compact nav
├─────────────────────────────┤
│                             │
│ [Oyo State Crest]           │  ← Crest above title
│                             │
│ Vehicle Loan Scheme   (H1)  │  ← 32px (not 44px)
│ 32px, centred               │
│                             │
│ An official staff welfare   │
│ programme administered...   │
│                             │
│ [  Staff Login  ] (full-w)  │
│ [Learn How It Works →]      │
│                             │
│ ┌─────────────────────────┐ │
│ │ OFFICIAL PROGRAMME      │ │  ← Card stacks below
│ │ NOTICE                  │ │     hero copy
│ │ • Approvals remain...   │ │
│ │ • Repayment is...       │ │
│ │ • Records maintained... │ │
│ │                         │ │
│ │ Data handled per NDPR   │ │
│ └─────────────────────────┘ │
│                             │
│ ─── TRUST STRIP ────────── │
│ Administered by the AG's   │
│ Office                      │
│ [NDPR] [Audit] [Committee] │
│  ↑ badges wrap naturally    │
│                             │
│ ─── HOW IT WORKS ───────── │
│ ┌─────────────────────────┐ │
│ │ ① Expression of Interest│ │  ← Full-width
│ │   Submit interest...    │ │     stacked cards
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ② Administrative Review │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ③ Committee Decision    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ④ Payroll Repayment     │ │
│ └─────────────────────────┘ │
│                             │
│ ─── LOAN CATEGORIES ────── │
│ ┌─────────────────────────┐ │
│ │ Levels 1-6  ₦250,000   │ │  ← Full-width
│ └─────────────────────────┘ │     stacked
│ ┌─────────────────────────┐ │
│ │ Levels 7-8  ₦450,000   │ │
│ └─────────────────────────┘ │
│ ...                         │
│                             │
│ ─── CAPABILITIES ───────── │
│ (stacked single column)     │
│                             │
│ ─── REPAYMENT RULES ────── │
│ [Accordion - full width]    │
│ [Key Clarification card]    │
│  ↑ stacks below accordion   │
│                             │
│ ─── WHO VLPRS SERVES ───── │
│ (2-column grid on mobile)   │
│ (5th card full-width)       │
│                             │
│ ... remaining sections ...  │
│ ... all full-width stacked  │
│                             │
│ ─── FOOTER ─────────────── │
│ (2-column grid on mobile)   │
└─────────────────────────────┘
```

---

## 4. Story 14.2 — Scheme Information Pages

### 4.1 Programme Overview (`/scheme`)

**Template:** A (Content Page)

```
Breadcrumb: Home > The Scheme > Programme Overview

┌─────────────────────────────────────────────────────────────────────┐
│  Programme Overview                                          (H1)  │
│  Understanding the Oyo State Vehicle Loan Scheme                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐   │
│  │  MAIN CONTENT (8 cols)       │  │  SIDEBAR CALLOUT (4 col) │   │
│  │                              │  │                          │   │
│  │  Scheme Objectives     (H2)  │  │  ┌────────────────────┐ │   │
│  │  • Eliminating manual        │  │  │ ℹ  VLPRS is an     │ │   │
│  │    record-keeping            │  │  │ administrative     │ │   │
│  │  • Centralising loan         │  │  │ support system.    │ │   │
│  │    administration            │  │  │ It records and     │ │   │
│  │  • Establishing auditable    │  │  │ administers        │ │   │
│  │    records                   │  │  │ decisions — it     │ │   │
│  │                              │  │  │ does not make      │ │   │
│  │  Policy Basis          (H2)  │  │  │ them.              │ │   │
│  │  Vehicle Loan Committee      │  │  └────────────────────┘ │   │
│  │  governance, AG's Office     │  │                          │   │
│  │  administration.             │  │  QUICK LINKS             │   │
│  │                              │  │  → Eligibility           │   │
│  │  Benefits to Staff     (H2)  │  │  → Repayment Rules      │   │
│  │  • Reduced administrative    │  │  → How It Works          │   │
│  │    burden                    │  │  → FAQ                   │   │
│  │  • Transparent record-       │  │                          │   │
│  │    keeping                   │  │                          │   │
│  │  • Automatic deduction       │  │                          │   │
│  │    cessation at completion   │  │                          │   │
│  │  • Structured grievance      │  │                          │   │
│  │    resolution                │  │                          │   │
│  │                              │  │                          │   │
│  │  Role of the AG's Office(H2) │  │                          │   │
│  │  Scheme oversight, financial │  │                          │   │
│  │  reporting, fund management  │  │                          │   │
│  └──────────────────────────────┘  └──────────────────────────┘   │
│                                                                     │
│  [CtaBanner: "Ready to access VLPRS?"]                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 About VLPRS (`/scheme/about-vlprs`)

**Template:** A (Content Page)

```
Breadcrumb: Home > The Scheme > About VLPRS

┌─────────────────────────────────────────────────────────────────────┐
│  About VLPRS                                                 (H1)  │
│  The digital system of record for the Oyo State Car Loan Scheme    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Core Principle                                              (H2)  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  bg: slate-50  text-center  py-8  rounded-xl                │   │
│  │                                                             │   │
│  │  "MDAs submit facts.                                        │   │
│  │   VLPRS computes truth.                                     │   │
│  │   Reports are generated views."                             │   │
│  │                                                             │   │
│  │  ↑ text-xl font-medium text-slate-700                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐   │
│  │  ✓  What VLPRS Does     │  │  ✕  What VLPRS Does NOT     │   │
│  │                          │  │                              │   │
│  │  • Centralised record-   │  │  • Does not approve or      │   │
│  │    keeping               │  │    reject loans              │   │
│  │  • Automated computation │  │  • Does not change loan      │   │
│  │  • Retirement obligation │  │    policy                    │   │
│  │    tracking              │  │  • Does not impose sanctions │   │
│  │  • Anomaly detection     │  │  • Does not replace payroll  │   │
│  │  • Transparent reporting │  │    systems                   │   │
│  │  • Audit-ready records   │  │  • Does not process gratuity │   │
│  │                          │  │    payments                  │   │
│  │  bg: green-50            │  │  • Does not impose retro-    │   │
│  │  border: green-200       │  │    spective sanctions        │   │
│  │  icon: CheckCircle green │  │                              │   │
│  └──────────────────────────┘  │  bg: slate-50               │   │
│                                 │  border: slate-200          │   │
│                                 │  icon: XCircle slate        │   │
│                                 └──────────────────────────────┘   │
│                                                                     │
│  Grid: grid-cols-1 md:grid-cols-2 gap-6                            │
│  Component: Card (custom header with icon)                          │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Eligibility & Loan Categories (`/scheme/eligibility`)

**Template:** A (Content Page)

```
Breadcrumb: Home > The Scheme > Eligibility & Loan Categories

┌─────────────────────────────────────────────────────────────────────┐
│  Eligibility & Loan Categories                               (H1)  │
│  Loan limits determined by salary grade levels                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Loan Tiers                                                  (H2)  │
│                                                                     │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────┐ │
│  │ Levels 1–6    │ │ Levels 7–8    │ │ Levels 9–10   │ │ Lv 12+ │ │
│  │               │ │               │ │               │ │        │ │
│  │ Up to         │ │ Up to         │ │ Up to         │ │ Up to  │ │
│  │ ₦250,000      │ │ ₦450,000      │ │ ₦600,000      │ │₦750,000│ │
│  │               │ │               │ │               │ │        │ │
│  │ 60 months     │ │ 60 months     │ │ 60 months     │ │60 mos  │ │
│  │ Interest: TBD │ │ Interest: TBD │ │ Interest: TBD │ │Int:TBD │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └────────┘ │
│                                                                     │
│  Eligibility Conditions                                      (H2)  │
│  • Active government service                                       │
│  • Grade level qualification                                       │
│  • No existing active loan (one loan at a time)                    │
│  • Committee approval required                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ℹ  Retirement Provision                                    │   │
│  │  Staff within 24 months to retirement may be processed      │   │
│  │  under gratuity settlement procedures where applicable.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│   ↑ Alert component (variant: info, teal)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Eligibility is determined by scheme rules and committee    │   │
│  │  decision. This page provides general information only.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│   ↑ text-sm text-slate-500 italic                                  │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Repayment & Settlement Rules (`/scheme/repayment`)

**Template:** A (Content Page with sidebar)

```
Breadcrumb: Home > The Scheme > Repayment & Settlement Rules

┌─────────────────────────────────────────────────────────────────────┐
│  Repayment & Settlement Rules                                (H1)  │
│  Understanding the repayment paths available                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐   │
│  │  SETTLEMENT PATHS (8 cols)   │  │  KEY CLARIFICATION       │   │
│  │                              │  │  (4 cols)                │   │
│  │  ▼ Standard Repayment  (H3) │  │                          │   │
│  │  ┌──────────────────────┐   │  │  ℹ VLPRS supports       │   │
│  │  │ 60-month tenure.     │   │  │  record accuracy and    │   │
│  │  │ Monthly principal +  │   │  │  reconciliation. It     │   │
│  │  │ interest via payroll │   │  │  does not replace       │   │
│  │  │ deduction. 2-month   │   │  │  payroll authority or   │   │
│  │  │ moratorium at start. │   │  │  gratuity processing    │   │
│  │  │                      │   │  │  procedures.            │   │
│  │  │ Example: A Level 9   │   │  │  Adjustments follow     │   │
│  │  │ officer with ₦600k   │   │  │  administrative review  │   │
│  │  │ principal over 60    │   │  │  and applicable         │   │
│  │  │ months pays ~₦10,000 │   │  │  regulations.           │   │
│  │  │ per month in         │   │  │                          │   │
│  │  │ principal + monthly  │   │  │  → See FAQ               │   │
│  │  │ interest.            │   │  │                          │   │
│  │  └──────────────────────┘   │  │  bg: teal-50            │   │
│  │                              │  └──────────────────────────┘   │
│  │  ▶ Accelerated Repayment    │                                  │
│  │    Shorter tenure, reduced   │                                  │
│  │    total interest, higher    │                                  │
│  │    monthly payments.         │                                  │
│  │    Example: ...              │                                  │
│  │                              │                                  │
│  │  ▶ Early Principal Settlement│                                  │
│  │    Lump-sum payoff. Interest │                                  │
│  │    waiver as incentive.      │                                  │
│  │    Example: ...              │                                  │
│  │                              │                                  │
│  │  ▶ Retirement & Gratuity    │                                  │
│  │    Outstanding balance       │                                  │
│  │    recovered from gratuity.  │                                  │
│  │    Example: ...              │                                  │
│  └──────────────────────────────┘                                  │
│                                                                     │
│  Component: Accordion (shadcn)  +  DisclaimerCallout (sidebar)     │
│  Each accordion item includes a plain-language example             │
│  Mobile: stacks — accordion full-width, callout below              │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 How It Works (`/how-it-works`)

**Template:** A (Content Page, no sidebar — full-width content)

```
Breadcrumb: Home > How It Works

┌─────────────────────────────────────────────────────────────────────┐
│  How the Scheme Works                                        (H1)  │
│  From Expression of Interest to loan completion                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ ①            │  │ ②            │  │ ③            │  │ ④      │ │
│  │ Expression   │  │ Administra-  │  │ Committee    │  │ Payroll│ │
│  │ of Interest  │  │ tive Review  │  │ Decision     │  │ Repay- │ │
│  │              │  │              │  │              │  │ ment   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘ │
│   ↑ Same 4-step cards as homepage but with EXPANDED detail below   │
│                                                                     │
│  Step 1 — Expression of Interest                             (H2)  │
│  Submit your interest digitally and receive a reference             │
│  number for administrative tracking.                               │
│  [Expanded paragraph with additional detail]                       │
│                                                                     │
│  Step 2 — Administrative Review                              (H2)  │
│  Applications are screened and prepared for committee               │
│  consideration under established procedures.                       │
│  [Expanded paragraph]                                              │
│                                                                     │
│  Step 3 — Committee Decision                                 (H2)  │
│  Approvals are determined by the designated committee.             │
│  The portal does not approve loans.                                │
│  [Expanded paragraph]                                              │
│                                                                     │
│  Step 4 — Payroll Repayment                                  (H2)  │
│  Approved loans are repaid through payroll deductions.             │
│  Completion triggers clearance documentation and                   │
│  automatic deduction cessation.                                    │
│  [Expanded paragraph]                                              │
│                                                                     │
│  ──────────────────────────────────────────────────────────────    │
│                                                                     │
│  What Happens After Completion?                              (H2)  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  bg: green-50  border: green-200  rounded-lg               │   │
│  │                                                             │   │
│  │  When your loan balance reaches zero, VLPRS automatically  │   │
│  │  generates a Clearance Certificate and notifies your MDA   │   │
│  │  to cease deductions. No manual intervention required.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠ Expression of Interest submission does not constitute   │   │
│  │  loan approval. All approvals remain subject to committee  │   │
│  │  decision under existing government procedures.            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│   ↑ ProgrammeDisclaimer component                                  │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 About the Programme (`/about`)

**Template:** A (Content Page)
**Note:** This page absorbs the former `/scheme/ag-office` content into the Programme Governance section.

```
Breadcrumb: Home > About the Programme

┌─────────────────────────────────────────────────────────────────────┐
│  About the Programme                                         (H1)  │
│  Transforming Vehicle Loan Administration in Oyo State             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐   │
│  │  MAIN CONTENT (8 cols)       │  │  SIDEBAR (4 cols)        │   │
│  │                              │  │                          │   │
│  │  Our Mission           (H2)  │  │  QUICK LINKS             │   │
│  │  [2-3 sentences — what the   │  │  → Eligibility           │   │
│  │   programme exists to        │  │  → How It Works          │   │
│  │   achieve]                   │  │  → FAQ                   │   │
│  │                              │  │  → Contact Support       │   │
│  │  Our Vision            (H2)  │  │                          │   │
│  │  [2-3 sentences — what       │  │  ┌────────────────────┐ │   │
│  │   success looks like]        │  │  │ The AG's Office    │ │   │
│  │                              │  │  │ is the authority.   │ │   │
│  │  Core Values           (H2)  │  │  │ VLPRS is the tool  │ │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │  │  │ that serves that   │ │   │
│  │  │Trans│ │Accou│ │Accur│   │  │  │ authority.          │ │   │
│  │  │paren│ │ntab-│ │acy  │   │  │  └────────────────────┘ │   │
│  │  │cy   │ │ility│ │     │   │  │  ↑ bg-crimson-50        │   │
│  │  └─────┘ └─────┘ └─────┘   │  │    border-l-4           │   │
│  │  ┌─────┐ ┌─────────────┐   │  │    border-[#9C1E23]     │   │
│  │  │Fair-│ │Institutional│   │  │                          │   │
│  │  │ness │ │Trust        │   │  │                          │   │
│  │  └─────┘ └─────────────┘   │  │                          │   │
│  │  ↑ Badge or Card per value  │  │                          │   │
│  │                              │  │                          │   │
│  │  ════════════════════════   │  │                          │   │
│  │                              │  │                          │   │
│  │  Programme Leadership  (H2)  │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Accountant-  │ │  │                          │   │
│  │  │  │ Photo│ General      │ │  │                          │   │
│  │  │  │adego-│  ↑ H3, bold  │ │  │                          │   │
│  │  │  │ke-ka │              │ │  │                          │   │
│  │  │  └──────┘ Mrs. K. A.   │ │  │                          │   │
│  │  │    80x80  Adegoke (FCA)│ │  │                          │   │
│  │  │  rounded  ↑ text-lg    │ │  │                          │   │
│  │  │  -full                 │ │  │                          │   │
│  │  │  Provides strategic    │ │  │                          │   │
│  │  │  oversight of the      │ │  │                          │   │
│  │  │  Vehicle Loan Scheme   │ │  │                          │   │
│  │  │  and ensures alignment │ │  │                          │   │
│  │  │  with government       │ │  │                          │   │
│  │  │  financial policy.     │ │  │                          │   │
│  │  │  ↑ text-slate-600      │ │  │                          │   │
│  │  │  (permanent, instit.)  │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Director,    │ │  │                          │   │
│  │  │  │ Photo│ Finance and  │ │  │                          │   │
│  │  │  │kilan-│ Accounts     │ │  │                          │   │
│  │  │  │ko-oo │  ↑ H3, bold  │ │  │                          │   │
│  │  │  └──────┘ Mr. O. O.    │ │  │                          │   │
│  │  │           Kilanko      │ │  │                          │   │
│  │  │  Oversees the finan-   │ │  │                          │   │
│  │  │  cial operations of    │ │  │                          │   │
│  │  │  the AG's Office and   │ │  │                          │   │
│  │  │  the programme's       │ │  │                          │   │
│  │  │  fiscal management.    │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Director,    │ │  │                          │   │
│  │  │  │ Photo│ Inspectorate │ │  │                          │   │
│  │  │  │adewo-│ and Manage-  │ │  │                          │   │
│  │  │  │le-ra │ ment Service │ │  │                          │   │
│  │  │  └──────┘ Mr. R. A.    │ │  │                          │   │
│  │  │           Adewole      │ │  │                          │   │
│  │  │  Responsible for       │ │  │                          │   │
│  │  │  inspectorate over-    │ │  │                          │   │
│  │  │  sight and management  │ │  │                          │   │
│  │  │  service delivery.     │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Director,    │ │  │                          │   │
│  │  │  │ Photo│ Treasury     │ │  │                          │   │
│  │  │  │ adeb-│  ↑ H3, bold  │ │  │                          │   │
│  │  │  │ayo-tg│              │ │  │                          │   │
│  │  │  └──────┘ Mr. T. G.    │ │  │                          │   │
│  │  │           Adebayo      │ │  │                          │   │
│  │  │  Manages treasury      │ │  │                          │   │
│  │  │  operations and fund   │ │  │                          │   │
│  │  │  disbursement for the  │ │  │                          │   │
│  │  │  loan programme.       │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Director,    │ │  │                          │   │
│  │  │  │ Photo│ Administra-  │ │  │                          │   │
│  │  │  │ adeb-│ tion and     │ │  │                          │   │
│  │  │  │iyi-ao│ Supplies     │ │  │                          │   │
│  │  │  └──────┘ Mrs. A. O.   │ │  │                          │   │
│  │  │           Adebiyi      │ │  │                          │   │
│  │  │  Oversees administra-  │ │  │                          │   │
│  │  │  tive operations and   │ │  │                          │   │
│  │  │  supply chain manage-  │ │  │                          │   │
│  │  │  ment within the AG's  │ │  │                          │   │
│  │  │  Office.               │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  ┌────────────────────────┐ │  │                          │   │
│  │  │  ┌──────┐ Head, Project│ │  │                          │   │
│  │  │  │ Photo│ Financial    │ │  │                          │   │
│  │  │  │fadip-│ Management   │ │  │                          │   │
│  │  │  │e-cf  │ Unit (PFMU)  │ │  │                          │   │
│  │  │  └──────┘ Mrs. C. F.   │ │  │                          │   │
│  │  │           Fadipe       │ │  │                          │   │
│  │  │  Leads project finan-  │ │  │                          │   │
│  │  │  cial management,      │ │  │                          │   │
│  │  │  reporting, and donor  │ │  │                          │   │
│  │  │  fund coordination.    │ │  │                          │   │
│  │  └────────────────────────┘ │  │                          │   │
│  │                              │  │                          │   │
│  │  Component: Card per leader │  │                          │   │
│  │  Photo: 80x80 rounded-full │  │                          │   │
│  │  Oyo crest as fallback      │  │                          │   │
│  │  Layout: flex row (desktop) │  │                          │   │
│  │  stacks on mobile           │  │                          │   │
│  │  Order = visual hierarchy   │  │                          │   │
│  │  (do not re-sort)           │  │                          │   │
│  │                              │  │                          │   │
│  │  ════════════════════════   │  │                          │   │
│  │                              │  │                          │   │
│  │  Programme Governance  (H2)  │  │                          │   │
│  │                              │  │                          │   │
│  │  Vehicle Loan Committee      │  │                          │   │
│  │  • Who sits on it            │  │                          │   │
│  │  • Decision authority        │  │                          │   │
│  │  • How VLPRS supports the    │  │                          │   │
│  │    committee's process       │  │                          │   │
│  │                              │  │                          │   │
│  │  AG's Office Role            │  │                          │   │
│  │  • Scheme oversight          │  │                          │   │
│  │  • Financial reporting       │  │                          │   │
│  │  • Fund management           │  │                          │   │
│  │  • Compliance monitoring     │  │                          │   │
│  │  (Absorbed from former       │  │                          │   │
│  │   /scheme/ag-office page)    │  │                          │   │
│  │                              │  │                          │   │
│  │  ════════════════════════   │  │                          │   │
│  │                              │  │                          │   │
│  │  Institutional Story   (H2)  │  │                          │   │
│  │  Brief neutral-language      │  │                          │   │
│  │  narrative of what the       │  │                          │   │
│  │  programme aims to achieve   │  │                          │   │
│  │  for Oyo State civil         │  │                          │   │
│  │  servants. NOT what was      │  │                          │   │
│  │  broken — what is being      │  │                          │   │
│  │  built.                      │  │                          │   │
│  └──────────────────────────────┘  └──────────────────────────┘   │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Leadership card component notes:**
- Role title (H3, `font-semibold`) — permanent, institutional. Use full office title (e.g. "Director, Finance and Accounts" not just "Director")
- Name (`text-lg`) — swappable when personnel rotate
- Role description (`text-slate-600`) — permanent, institutional
- Photo: 80x80px `rounded-full` from `images/team/{slug}.jpeg`. Oyo State crest as fallback if image fails to load
- Card: `flex flex-row items-start gap-4` (desktop), stacks on mobile
- **Card order is deliberate** — reflects organisational hierarchy. Do not alphabetise or re-sort
- **CMS migration note:** Leadership data extracted to `src/content/about.ts` → future Sanity migration. Name/photo are the only fields that change on personnel rotation

**Leadership roster (6 cards, in display order):**

| # | Image Source | Image Target | Role Title | Name |
|---|---|---|---|---|
| 1 | `docs/team_pics/Mrs. K. A. Adegoke (FCA) - Accountant General.jpeg` | `images/team/adegoke-ka.jpeg` | Accountant-General | Mrs. K. A. Adegoke (FCA) |
| 2 | `docs/team_pics/Mr. O. O. Kilanko - Director, Finance and Accounts.jpeg` | `images/team/kilanko-oo.jpeg` | Director, Finance and Accounts | Mr. O. O. Kilanko |
| 3 | `docs/team_pics/Mr. R. A. Adewole - Director, Inspectorate  and Management Service.jpeg` | `images/team/adewole-ra.jpeg` | Director, Inspectorate and Management Service | Mr. R. A. Adewole |
| 4 | `docs/team_pics/Mr. T. G. Adebayo - Director, Treasury.jpeg` | `images/team/adebayo-tg.jpeg` | Director, Treasury | Mr. T. G. Adebayo |
| 5 | `docs/team_pics/Mrs. A. O. Adebiyi - Director, Administration and Supplies.jpeg` | `images/team/adebiyi-ao.jpeg` | Director, Administration and Supplies | Mrs. A. O. Adebiyi |
| 6 | `docs/team_pics/Mrs. C. F. Fadipe - Head, Project Financial Management Unit.jpeg` | `images/team/fadipe-cf.jpeg` | Head, Project Financial Management Unit (PFMU) | Mrs. C. F. Fadipe |

---

## 5. Story 14.3 — Resources, Support & Legal Pages

### FAQ Page (`/resources/faq`)

**Template:** E (unique — accordion with search + category tabs)

```
Breadcrumb: Home > Resources > Frequently Asked Questions

┌─────────────────────────────────────────────────────────────────────┐
│  Frequently Asked Questions                                  (H1)  │
│  Find answers about the Vehicle Loan Scheme                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🔍 Search questions...                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│   ↑ Input component — filters accordion items by keyword           │
│                                                                     │
│  [ For Beneficiaries ]  [ For MDA Officers ]  [ General ]          │
│   ↑ active (underline)    ↑ tab                  ↑ tab             │
│   Component: Tabs (shadcn)                                         │
│                                                                     │
│  ── For Beneficiaries ──────────────────────────────────────────   │
│                                                                     │
│  ▶ How do I check my loan balance?                                 │
│  ▶ What happens when my loan is paid off?                          │
│  ▶ What is an Auto-Stop Certificate?                               │
│  ▼ How are my repayments calculated?                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Your monthly repayment is calculated as principal divided   │  │
│  │  by tenure plus monthly interest. VLPRS computes this from  │  │
│  │  your loan record — the same formula for everyone.          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ▶ What is an Expression of Interest?                              │
│  ▶ ...                                                             │
│                                                                     │
│  ── For MDA Officers ───────────────────────────────────────────   │
│  (shown when tab selected)                                         │
│                                                                     │
│  ▶ How do I submit monthly deduction data?                         │
│  ▶ What is the 8-field CSV format?                                 │
│  ▶ What happens if I make an error in my submission?               │
│  ▶ When is the submission deadline?                                │
│  ▶ ...                                                             │
│                                                                     │
│  ── General ────────────────────────────────────────────────────   │
│  (shown when tab selected)                                         │
│                                                                     │
│  ▶ What is VLPRS?                                                  │
│  ▶ Who administers the scheme?                                     │
│  ▶ How is my data protected?                                       │
│  ▶ ...                                                             │
│                                                                     │
│  Minimum 15 questions total across all categories                  │
│  Component: Tabs + Accordion (shadcn)                              │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### MDA Submission Guide (`/resources/mda-guide`)

**Template:** A (Content Page with sidebar)

```
Breadcrumb: Home > Resources > MDA Submission Guide

┌─────────────────────────────────────────────────────────────────────┐
│  MDA Monthly Submission Guide                                (H1)  │
│  Step-by-step guide for the 8-field CSV submission                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐   │
│  │  MAIN CONTENT (8 cols)       │  │  SIDEBAR (4 cols)        │   │
│  │                              │  │                          │   │
│  │  The 8 CSV Fields      (H2) │  │  QUICK REFERENCE         │   │
│  │                              │  │                          │   │
│  │  ┌──────────────────────┐   │  │  Deadline: 28th of      │   │
│  │  │ # │ Field    │ Req'd │   │  │  each month             │   │
│  │  ├───┼──────────┼───────┤   │  │                          │   │
│  │  │ 1 │ Staff ID │ Yes   │   │  │  [Download CSV          │   │
│  │  │ 2 │ Month    │ Yes   │   │  │   Template]             │   │
│  │  │ 3 │ Amount   │ Yes   │   │  │   ↑ Button (secondary)  │   │
│  │  │ 4 │ Payroll  │ Yes   │   │  │                          │   │
│  │  │   │ Batch Ref│       │   │  │  Format: .csv            │   │
│  │  │ 5 │ MDA Code │ Yes   │   │  │  Encoding: UTF-8        │   │
│  │  │ 6 │ Event    │ Yes   │   │  │                          │   │
│  │  │   │ Flag     │       │   │  │  ┌────────────────────┐ │   │
│  │  │ 7 │ Event    │ Cond. │   │  │  │ ℹ Need help?      │ │   │
│  │  │   │ Eff.Date │       │   │  │  │ → Contact Support  │ │   │
│  │  │ 8 │ Cessation│ Cond. │   │  │  └────────────────────┘ │   │
│  │  │   │ Reason   │       │   │  │                          │   │
│  │  └──────────────────────┘   │  └──────────────────────────┘   │
│  │                              │                                  │
│  │  Component: Table (shadcn)   │                                  │
│  │                              │                                  │
│  │  Conditional Fields    (H2)  │                                  │
│  │  • Event Effective Date:     │                                  │
│  │    required when Event Flag  │                                  │
│  │    ≠ NONE                    │                                  │
│  │  • Cessation Reason:         │                                  │
│  │    required when Amount = ₦0 │                                  │
│  │    AND Event Flag = NONE     │                                  │
│  │                              │                                  │
│  │  Step-by-Step Process  (H2)  │                                  │
│  │  1. Download the CSV         │                                  │
│  │     template                 │                                  │
│  │  2. Fill in staff records    │                                  │
│  │  3. Upload via VLPRS portal  │                                  │
│  │  4. Review confirmation &    │                                  │
│  │     comparison summary       │                                  │
│  │                              │                                  │
│  │  Screenshots          (H2)  │                                  │
│  │  ┌──────────────────────┐   │                                  │
│  │  │  [Placeholder for    │   │                                  │
│  │  │   UI screenshots     │   │                                  │
│  │  │   — to be added      │   │                                  │
│  │  │   after Sprint 8]    │   │                                  │
│  │  └──────────────────────┘   │                                  │
│  │   ↑ bg-slate-100 rounded    │                                  │
│  │     dashed border           │                                  │
│  └──────────────────────────────┘                                  │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Downloads & Forms (`/resources/downloads`)

**Template:** B (Card Grid Page)

```
Breadcrumb: Home > Resources > Downloads & Forms

┌─────────────────────────────────────────────────────────────────────┐
│  Downloads & Forms                                           (H1)  │
│  Downloadable resources for MDA officers and staff                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  CSV Submission       │  │  Policy Summary      │                │
│  │  Template             │  │                      │                │
│  │                       │  │  [PDF]  badge        │                │
│  │  [CSV]  badge         │  │                      │                │
│  │                       │  │  Official policy     │                │
│  │  Monthly deduction    │  │  document — to be    │                │
│  │  submission template  │  │  provided by AG's    │                │
│  │  with correct headers │  │  Office              │                │
│  │  and example row.     │  │                      │                │
│  │                       │  │  [Coming Soon]       │                │
│  │  Size: ~1 KB          │  │   ↑ Badge secondary  │                │
│  │                       │  │                      │                │
│  │  [ Download ]         │  │                      │                │
│  │   ↑ Button secondary  │  │                      │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  MDA Officer Quick    │  │  Training Materials  │                │
│  │  Reference Guide      │  │                      │                │
│  │                       │  │  [PDF]               │                │
│  │  [PDF]                │  │                      │                │
│  │                       │  │  Training materials  │                │
│  │  Quick reference for  │  │  for system rollout  │                │
│  │  daily operations —   │  │  — to be created for │                │
│  │  to be created post-  │  │  rollout.            │                │
│  │  training.            │  │                      │                │
│  │                       │  │  [Coming Soon]       │                │
│  │  [Coming Soon]        │  │                      │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                     │
│  Grid: grid-cols-1 md:grid-cols-2 gap-6                            │
│  Component: Card  |  Badge for file type (CSV/PDF)                 │
│  "Coming Soon" cards: opacity-80, badge instead of download button │
│                                                                     │
│  [CtaBanner]                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### News & Announcements (`/resources/news`)

**Template:** B (Card Grid Page)

```
Breadcrumb: Home > Resources > News & Announcements

┌─────────────────────────────────────────────────────────────────────┐
│  News & Announcements                                        (H1)  │
│  Latest updates from the Vehicle Loan Scheme                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ 20 Feb 2026      │ │ 15 Feb 2026      │ │ 01 Feb 2026      │   │
│  │                   │ │                   │ │                   │   │
│  │ VLPRS Deployed   │ │ Migration Phase  │ │ Beneficiary      │   │
│  │ to 63 MDAs       │ │ 1 Underway       │ │ Portal Planned   │   │
│  │                   │ │                   │ │ for Phase 2      │   │
│  │ The Vehicle Loan │ │ Data migration   │ │                   │   │
│  │ Processing and   │ │ from legacy      │ │ A dedicated      │   │
│  │ Receivables      │ │ spreadsheets     │ │ beneficiary      │   │
│  │ System has been  │ │ has commenced... │ │ portal is being  │   │
│  │ deployed across  │ │                   │ │ planned for...   │   │
│  │ all 63 MDAs...   │ │ Read more →      │ │                   │   │
│  │                   │ │                   │ │ Read more →      │   │
│  │ Read more →      │ │                   │ │                   │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                     │
│  Component: Card  |  Grid: grid-cols-1 md:grid-cols-3              │
│  Date: text-sm text-slate-500                                      │
│  Title: text-lg font-semibold                                      │
│  Excerpt: text-slate-600 line-clamp-3                              │
│  "Read more" links to /resources/news/[slug]                       │
│  News detail page: Template A (full-width, no sidebar)             │
│  Content stored as static .tsx or .mdx files in codebase           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Approved Beneficiary Lists (`/resources/beneficiary-lists`)

**Template:** C (Placeholder Page)

```
Breadcrumb: Home > Resources > Approved Beneficiary Lists

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│          ┌─────────────────────────────────────────┐               │
│          │                                         │               │
│          │        [Clock icon — Lucide]            │               │
│          │                                         │               │
│          │     Approved Beneficiary Lists          │               │
│          │     Coming Soon — Phase 2               │               │
│          │                                         │               │
│          │     This page will provide:             │               │
│          │     • Published approved batch lists    │               │
│          │     • Searchable by name or Staff ID    │               │
│          │     • NDPR-compliant masked             │               │
│          │       identifiers                       │               │
│          │                                         │               │
│          │     Expected: Phase 2 release           │               │
│          │                                         │               │
│          │     ──────────────────────              │               │
│          │                                         │               │
│          │     → Back to Resources                 │               │
│          │     → How It Works                      │               │
│          │                                         │               │
│          └─────────────────────────────────────────┘               │
│                                                                     │
│  Fully styled — not a bare placeholder.                            │
│  bg: white  Card with shadow-sm  max-w-lg mx-auto                 │
│  Icon: text-slate-400  text-4xl                                    │
│  "Coming Soon" Badge: variant="secondary"                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Help & Support (`/support`)

**Template:** A (Content Page, no sidebar)

```
Breadcrumb: Home > Help & Support

┌─────────────────────────────────────────────────────────────────────┐
│  Help & Support                                              (H1)  │
│  Get assistance with the Vehicle Loan Scheme                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  bg: teal-50  border: teal-200  rounded-xl  p-8            │   │
│  │                                                             │   │
│  │  Need help? Here's where to start:                          │   │
│  │                                                             │   │
│  │  • MDA officers → See the Submission Guide                  │   │
│  │  • Loan enquiries → Contact the Car Loan Department         │   │
│  │  • Technical issues → Email support (below)                 │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│   ↑ Prominent guidance banner                                      │
│                                                                     │
│  Contact Information                                         (H2)  │
│                                                                     │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │  📍 Address      │ │  ✉ Email         │ │  📞 Phone        │   │
│  │                   │ │                   │ │                   │   │
│  │  Accountant-     │ │  carloan@         │ │  +234 xxx xxxx   │   │
│  │  General's       │ │  oyo.gov.ng       │ │                   │   │
│  │  Office          │ │                   │ │                   │   │
│  │  Ibadan,         │ │                   │ │                   │   │
│  │  Oyo State       │ │                   │ │                   │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                     │
│  Office Hours: Monday–Friday, 8:00 AM – 6:00 PM WAT               │
│                                                                     │
│  Grid: grid-cols-1 md:grid-cols-3                                  │
│  Component: Card with icon header                                  │
│                                                                     │
│  Useful Links                                                (H2)  │
│  → Frequently Asked Questions                                      │
│  → MDA Submission Guide                                            │
│  → Programme Overview                                              │
│                                                                     │
│  [CtaBanner: "Ready to access VLPRS?" — Staff Login / FAQ]        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Privacy & Data Protection (`/privacy`)

**Template:** A (Content Page, full-width prose)

```
Breadcrumb: Home > Privacy & Data Protection

┌─────────────────────────────────────────────────────────────────────┐
│  Privacy & Data Protection                                   (H1)  │
│  How we handle your data under NDPR                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Full-width prose content (max-w-3xl for readability)              │
│                                                                     │
│  What Personal Data Is Collected                             (H2)  │
│  [Paragraph — data minimisation principle]                         │
│                                                                     │
│  How Data Is Processed                                       (H2)  │
│  [Paragraph — loan administration only]                            │
│                                                                     │
│  Who Has Access                                              (H2)  │
│  [Paragraph — role-based, need-to-know]                            │
│                                                                     │
│  Data Retention                                              (H2)  │
│  [Paragraph — minimum 7 years per gov regulations]                 │
│                                                                     │
│  Right of Access                                             (H2)  │
│  [Paragraph — beneficiaries can view own data]                     │
│                                                                     │
│  Consent Practices                                           (H2)  │
│  [Paragraph]                                                       │
│                                                                     │
│  Data Security                                               (H2)  │
│  • Encryption at rest: AES-256                                     │
│  • Encryption in transit: TLS 1.2+                                 │
│  • Role-based access control                                       │
│  • Audit logging of all access                                     │
│                                                                     │
│  Data Protection Enquiries                                   (H2)  │
│  [Contact information for data protection officer]                 │
│                                                                     │
│  Layout: prose max-w-3xl (Tailwind Typography plugin)              │
│  No sidebar needed — straightforward legal content                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Programme Disclaimer (`/disclaimer`)

**Template:** A (Content Page, full-width prose)

```
Breadcrumb: Home > Programme Disclaimer

┌─────────────────────────────────────────────────────────────────────┐
│  Programme Disclaimer                                        (H1)  │
│  Important information about this portal                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Full-width prose content (max-w-3xl)                              │
│                                                                     │
│  System Scope                                                (H2)  │
│  This portal provides general programme information and            │
│  administrative record-keeping.                                    │
│                                                                     │
│  Committee Authority                                         (H2)  │
│  All loan approvals, rejections, and policy determinations         │
│  remain the exclusive responsibility of the Vehicle Loan           │
│  Committee and designated approval authorities.                    │
│                                                                     │
│  Expression of Interest                                      (H2)  │
│  EOI submission does not constitute, imply, or guarantee           │
│  loan approval.                                                    │
│                                                                     │
│  No Legal Commitment                                         (H2)  │
│  Information on this portal is for general guidance. Specific      │
│  loan terms are governed by applicable government policies         │
│  and committee decisions.                                          │
│                                                                     │
│  Payroll & Gratuity Scope                                    (H2)  │
│  VLPRS records and tracks deductions. It does not execute          │
│  payroll changes or process gratuity payments — these remain       │
│  subject to established government procedures.                     │
│                                                                     │
│  Layout: prose max-w-3xl                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Accessibility Statement (`/accessibility`)

**Template:** A (Content Page, full-width prose)

```
Breadcrumb: Home > Accessibility Statement

┌─────────────────────────────────────────────────────────────────────┐
│  Accessibility Statement                                     (H1)  │
│  Our commitment to an accessible experience                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Full-width prose content (max-w-3xl)                              │
│                                                                     │
│  WCAG 2.1 AA Compliance                                      (H2) │
│  [Commitment statement]                                            │
│                                                                     │
│  Accessibility Features                                      (H2) │
│  • Keyboard navigation throughout                                  │
│  • Screen reader support (semantic HTML, ARIA labels)              │
│  • Colour contrast meeting 4.5:1 (body) / 3:1 (large text)       │
│  • Text resizing up to 200% without loss of content                │
│  • Touch targets minimum 44x44px                                   │
│  • Focus indicators on all interactive elements                    │
│                                                                     │
│  Known Limitations                                           (H2) │
│  [Any known limitations — update as discovered]                    │
│                                                                     │
│  Report an Issue                                             (H2) │
│  [Contact information for accessibility issues]                    │
│                                                                     │
│  Continuous Improvement                                      (H2) │
│  [Commitment to ongoing accessibility improvement]                 │
│                                                                     │
│  Layout: prose max-w-3xl                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Expression of Interest (`/eoi`)

**Template:** C (Placeholder Page)

```
Breadcrumb: Home > Expression of Interest

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│          ┌─────────────────────────────────────────┐               │
│          │                                         │               │
│          │        [FileText icon — Lucide]         │               │
│          │                                         │               │
│          │     Expression of Interest              │               │
│          │     Coming Soon — Phase 2               │               │
│          │                                         │               │
│          │     EOI registration will allow you     │               │
│          │     to formally submit your interest    │               │
│          │     in the Vehicle Loan Scheme and      │               │
│          │     receive a reference number for      │               │
│          │     administrative tracking.            │               │
│          │                                         │               │
│          │     ⚠ Expression of Interest ≠          │               │
│          │     loan approval                       │               │
│          │                                         │               │
│          │     Expected: Phase 2 release           │               │
│          │                                         │               │
│          │     ──────────────────────              │               │
│          │                                         │               │
│          │     → How It Works                      │               │
│          │     → Contact Support                   │               │
│          │                                         │               │
│          └─────────────────────────────────────────┘               │
│                                                                     │
│  Fully styled with design system — signals roadmap intentionality  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component–to–shadcn/ui Mapping

| Wireframe Element | shadcn/ui Component | Notes |
|---|---|---|
| Navigation bar | `NavigationMenu` + `NavigationMenuTrigger` + `NavigationMenuContent` | Desktop dropdowns |
| Mobile nav | `Sheet` + `SheetTrigger` + `SheetContent` | Slide-out overlay |
| Login modal | `Dialog` + `DialogContent` + `DialogHeader` | Focus trap, Escape close |
| Hero CTA buttons | `Button` (variant: `default` + `ghost`) | Primary = Oyo Crimson |
| Trust badges | `Badge` (variant: `outline`) | Pill-shaped |
| Step number badges | `Badge` (variant: `default`) | Oyo Crimson bg, white text |
| How It Works cards | `Card` + `CardHeader` + `CardContent` | With step badge |
| Loan tier cards | `Card` + `CardHeader` + `CardContent` | Amount in JetBrains Mono |
| Capability cards | `Card` + `CardHeader` + `CardContent` | Icon + title + description |
| Repayment accordion | `Accordion` + `AccordionItem` + `AccordionTrigger` + `AccordionContent` | Left column |
| Key Clarification | `Alert` (custom teal variant) | Sidebar callout |
| Role cards | `Card` + `CardHeader` + `CardContent` | Role title as H3 |
| Trust pillar cards | `Card` | Icon + title + description |
| Endorsement quote | Custom `<blockquote>` | Crimson left border |
| News cards | `Card` + `CardHeader` + `CardContent` | Date + title + excerpt |
| Final CTA | Custom section | Dark bg, inverted buttons |
| Footer | Custom layout | 4-col grid + separator + legal |
| Breadcrumb | `Breadcrumb` + `BreadcrumbList` + `BreadcrumbItem` + `BreadcrumbLink` | All inner pages |
| FAQ tabs | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | Category switching |
| FAQ accordion | `Accordion` | Inside each tab |
| Search input | `Input` | With search icon |
| Download badges | `Badge` (variant: `secondary`) | CSV, PDF format labels |
| "Coming Soon" badge | `Badge` (variant: `secondary`) | Consistent across site |
| Info alerts | `Alert` (variant: custom teal) | Retirement provision, etc. |
| Separator | `Separator` | Footer dividers |
| CTA banner | Custom component | Reusable `CtaBanner` |
| Disclaimer callout | Custom component | Reusable `DisclaimerCallout` |

---

## 7. Responsive Behaviour Summary

| Section | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| **Nav** | Hamburger → Sheet | Hamburger → Sheet | Full horizontal + dropdowns |
| **Hero** | Stacked: copy → card | Stacked: copy → card | Side-by-side: 7col + 5col |
| **Trust strip** | Badges wrap | Single row | Single row |
| **How It Works** | 1-col stacked | 2x2 grid | 4-col row with arrows |
| **Loan tiers** | 1-col stacked | 2x2 grid | 4-col row |
| **Capabilities** | 1-col stacked | 2x2 grid | 3x2 grid |
| **Repayment** | Stacked: accordion → callout | Stacked: accordion → callout | Side-by-side: 8col + 4col |
| **Who Serves** | 2-col grid (5th centred) | 3-col grid | 5-col row |
| **Trust pillars** | 1-col stacked | 3-col row | 3-col row |
| **News** | 1-col stacked | 2-col (3rd wraps) | 3-col row |
| **Footer** | 2-col grid | 4-col grid | 4-col grid |
| **Content pages** | Full-width (no sidebar) | Full-width (no sidebar) | 8col + 4col sidebar |
| **Card grids** | 1-col stacked | 2-col grid | 3-col grid (or 2-col) |
| **Placeholder** | Centred card, full-width | Centred card, max-w-lg | Centred card, max-w-lg |

---

## 8. Implementation Sequence

Recommended build order within Epic 14:

**Story 14.1 — build in this order:**
1. `PublicLayout.tsx` (wraps nav + footer + `<Outlet />`)
2. `PublicNavBar.tsx` (desktop + mobile nav)
3. `LoginModal.tsx` (dialog with 3 portals)
4. `PublicFooter.tsx` (4-column + legal strip)
5. `HomePage.tsx` (all sections top-to-bottom)
6. Shared components: `BreadcrumbNav`, `PageHeader`, `CtaBanner`, `DisclaimerCallout`, `ProgrammeDisclaimer`

**Story 14.2 — build in this order:**
1. `ProgrammeOverviewPage.tsx` (establishes Template A pattern)
2. `AboutVlprsPage.tsx` (does/doesn't cards — unique but simple)
3. `EligibilityPage.tsx` (reuses loan tier cards from homepage)
4. `RepaymentRulesPage.tsx` (expanded accordion from homepage)
5. `HowItWorksPage.tsx` (expanded version of homepage section)
6. `AboutPage.tsx` (Template A — leadership cards + governance sections)

**Story 14.3 — build in this order:**
1. `FaqPage.tsx` (tabs + accordion + search — most complex)
2. `MdaGuidePage.tsx` (Template A with table)
3. `DownloadsPage.tsx` (Template B — card grid)
4. `NewsPage.tsx` + `NewsDetailPage.tsx` (Template B + detail)
5. `SupportPage.tsx` (Template A — contact cards)
6. `PrivacyPage.tsx`, `DisclaimerPage.tsx`, `AccessibilityPage.tsx` (Template A — prose, fastest to build)
7. `BeneficiaryListsPage.tsx`, `EoiPage.tsx` (Template C — placeholders)

---

## 9. SEO & Meta Tags

Every public page must include:

```html
<title>{Page Title} — Vehicle Loan Scheme | Oyo State Government</title>
<meta name="description" content="{Page-specific description}" />
<meta property="og:title" content="{Page Title}" />
<meta property="og:description" content="{Description}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://vlprs.oyo.gov.ng/{path}" />
```

Use `react-helmet-async` or React Router's `<Meta>` for SPA meta tag management.

| Page | `<title>` | Meta Description |
|---|---|---|
| Homepage | Vehicle Loan Scheme — Oyo State Government | Official Vehicle Loan Processing & Receivables System. Structured record-keeping, transparent reporting, and auditable repayment tracking. |
| Programme Overview | Programme Overview — Vehicle Loan Scheme | Understanding the objectives, policy basis, and benefits of the Oyo State Vehicle Loan Scheme. |
| About VLPRS | About VLPRS — Vehicle Loan Scheme | What VLPRS does and doesn't do. The digital system of record for the Oyo State Car Loan Scheme. |
| Eligibility | Eligibility & Loan Categories — Vehicle Loan Scheme | Loan tiers by grade level, eligibility conditions, and tenure provisions for the Vehicle Loan Scheme. |
| Repayment | Repayment & Settlement Rules — Vehicle Loan Scheme | Standard repayment, accelerated repayment, early settlement, and retirement gratuity settlement paths. |
| How It Works | How the Scheme Works — Vehicle Loan Scheme | From Expression of Interest to loan completion. Four steps in the Vehicle Loan Scheme process. |
| About | About the Programme — Vehicle Loan Scheme | Mission, vision, programme leadership, and governance of the Oyo State Vehicle Loan Scheme. |
| FAQ | Frequently Asked Questions — Vehicle Loan Scheme | Answers for beneficiaries, MDA officers, and the general public about the Vehicle Loan Scheme. |
| MDA Guide | MDA Submission Guide — Vehicle Loan Scheme | Step-by-step guide for the monthly 8-field CSV submission process. |
| Downloads | Downloads & Forms — Vehicle Loan Scheme | CSV templates, policy documents, and reference guides for the Vehicle Loan Scheme. |
| News | News & Announcements — Vehicle Loan Scheme | Latest updates from the Oyo State Vehicle Loan Scheme. |
| Beneficiary Lists | Approved Beneficiary Lists — Vehicle Loan Scheme | Published approved batch lists — coming in Phase 2. |
| Help & Support | Help & Support — Vehicle Loan Scheme | Contact information, office hours, and support resources. |
| Privacy | Privacy & Data Protection — Vehicle Loan Scheme | How VLPRS handles personal data under NDPR. |
| Disclaimer | Programme Disclaimer — Vehicle Loan Scheme | Important information about the scope and limitations of this portal. |
| Accessibility | Accessibility Statement — Vehicle Loan Scheme | WCAG 2.1 AA compliance commitment and accessibility features. |
| EOI | Expression of Interest — Vehicle Loan Scheme | Digital Expression of Interest registration — coming in Phase 2. |

---

## 10. Asset Inventory & Image Preparation

> Source files are in `docs/team_pics/`. During Story 14.1 (or the first Epic 14 story that touches images), copy, rename, and optimise into the target directory. This section is the single source of truth for asset mapping.

### Target Directory Structure

```
apps/client/public/images/
├── branding/
│   ├── oyo-crest.svg          # Vector — navbar, footer, leadership fallback (convert from source)
│   ├── oyo-crest.webp         # Raster — hero section, OG social image (source: oyo_logo.webp)
│   └── oyo-crest.png          # PNG fallback — PDF exports, email templates (source: oyo_logo_png.png)
└── team/
    ├── adegoke-ka.jpeg        # AG: Mrs. K. A. Adegoke (FCA)
    ├── kilanko-oo.jpeg        # Dir, Finance & Accounts: Mr. O. O. Kilanko
    ├── adewole-ra.jpeg        # Dir, Inspectorate & Mgmt Service: Mr. R. A. Adewole
    ├── adebayo-tg.jpeg        # Dir, Treasury: Mr. T. G. Adebayo
    ├── adebiyi-ao.jpeg        # Dir, Admin & Supplies: Mrs. A. O. Adebiyi
    └── fadipe-cf.jpeg         # Head, PFMU: Mrs. C. F. Fadipe
```

### Source → Target Mapping

| Source File (`docs/team_pics/`) | Target File (`public/images/`) | Used On |
|---|---|---|
| `oyo_logo.webp` | `branding/oyo-crest.webp` | Homepage hero, OG social image |
| `oyo_logo_png.png` | `branding/oyo-crest.png` | PDF exports, email templates, PNG fallback |
| *(convert from PNG or source SVG)* | `branding/oyo-crest.svg` | PublicNavBar, PublicFooter, leadership photo fallback |
| `Mrs. K. A. Adegoke (FCA) - Accountant General.jpeg` | `team/adegoke-ka.jpeg` | About page — leadership card #1 |
| `Mr. O. O. Kilanko - Director, Finance and Accounts.jpeg` | `team/kilanko-oo.jpeg` | About page — leadership card #2 |
| `Mr. R. A. Adewole - Director, Inspectorate  and Management Service.jpeg` | `team/adewole-ra.jpeg` | About page — leadership card #3 |
| `Mr. T. G. Adebayo - Director, Treasury.jpeg` | `team/adebayo-tg.jpeg` | About page — leadership card #4 |
| `Mrs. A. O. Adebiyi - Director, Administration and Supplies.jpeg` | `team/adebiyi-ao.jpeg` | About page — leadership card #5 |
| `Mrs. C. F. Fadipe - Head, Project Financial Management Unit.jpeg` | `team/fadipe-cf.jpeg` | About page — leadership card #6 |

### Image Optimisation Requirements

| Category | Max Dimensions | Format | Quality | Notes |
|---|---|---|---|---|
| Team photos | 240x240px | JPEG | 80% | Crop to square, centre on face. Displayed at 80x80 CSS but serve 3x for retina |
| Oyo crest (raster) | 400x400px | WebP + PNG | 85% | Hero section uses larger; nav/footer use via CSS `background-size` |
| Oyo crest (vector) | n/a | SVG | n/a | Preferred for nav/footer — scales perfectly, smallest file size |

### Naming Convention

Pattern: `{surname-lowercase}-{initials-lowercase}.jpeg`

Examples: `adegoke-ka.jpeg`, `kilanko-oo.jpeg`

This convention survives personnel changes — when a new AG is appointed, add `newsurname-xy.jpeg` and update `src/content/about.ts`. No component changes needed.

### Where Each Asset Appears

| Asset | PublicNavBar | Homepage Hero | About Page | PublicFooter | PDF Export | OG Image |
|---|---|---|---|---|---|---|
| `oyo-crest.svg` | Logo (left) | — | Fallback | Logo | — | — |
| `oyo-crest.webp` | — | Background/accent | — | — | — | `og:image` |
| `oyo-crest.png` | — | — | — | — | Header crest | Fallback |
| `team/*.jpeg` | — | — | Leadership cards | — | — | — |
