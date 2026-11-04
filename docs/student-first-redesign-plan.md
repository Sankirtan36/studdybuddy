# StuddyBuddy: University-Specific Smart Search & Recently Viewed Resources
## Architecture, Implementation & Verification Report

> **Document Status:** Implemented & Verified  
> **Test Suite Status:** 26/26 Unit Tests Passing (`npx vitest run`)  
> **TypeScript Diagnostics:** 0 Errors, 0 Warnings (`npx astro check`)  
> **Preservation Guarantee:** Existing page layouts, dark/light theme, academic hierarchy, routes, and database collections are 100% intact.

---

## 1. Summary of Implemented Features

StuddyBuddy is an academic resource-sharing network where university students discover, share, and discuss course materials (previous year question papers, lecture notes, assignment solutions, syllabus guides, and lab manuals) uploaded for their specific university.

Two integrated capabilities were implemented with zero breaking changes:

1. **University-Specific Smart Search:**
   - Available **strictly inside the student's authorized university space** (`/university/[uniSlug]`).
   - Scoped server-side to the active campus: materials from other universities are never returned.
   - Supports searching by resource title, keywords, subject name, course code, and category (PYQs, Notes, Assignments, Question Banks, Formula Sheets, Lab Manuals).
   - Clear search results display using existing `<ResourceCard />` design tokens, with campus-specific empty states and reset controls.
   - Preserves homepage `/` and dashboard `/dashboard` without introducing a cross-university global search.

2. **Recently Viewed Resources with Exact Resource Navigation:**
   - Compact, visually appealing **Recently Viewed** section embedded directly on the university space page (`/university/[uniSlug]`) using the space-efficient `<RecentResourceCard />` component.
   - Shows only the current student's viewing history in that university context.
   - Displays complete academic context: Resource Title, Category badge, File type & size (`PDF • 2.4 MB`), Subject name, Exam Year/Session, and Relative timestamp (`Just now`, `15m ago`, `Yesterday`).
   - **De-duplication:** Re-viewing an existing resource updates its `viewedAt` timestamp and brings it to the front without duplicates.
   - **Exact Navigation:** Clicking any card navigates directly to the exact previously viewed resource (`/resources/[id]`), preserving document identity, inline browser preview, watermarked download, and bookmarks.
   - **Server-Side Access Re-validation:** Before rendering or serving file streams in `/resources/[id]`, `/preview`, and `/download`, the server validates that the resource exists, remains approved, and matches the student's authorized university.

---

## 2. Technical Implementation Details

### 2.1 Data Models & Types (`src/types/index.ts`)
Added `RecentlyViewedResource` interface:
```ts
export interface RecentlyViewedResource {
  _id?: ObjectId | string;
  userId: string;
  universityId: string;
  resourceId: string;
  viewedAt: Date;
}
```

### 2.2 Database Indexes (`src/server/db/mongo.ts`)
Configured compound unique index for de-duplication and fast lookups:
```ts
await db.collection('recentlyViewedResources').createIndex({ userId: 1, resourceId: 1 }, { unique: true });
await db.collection('recentlyViewedResources').createIndex({ userId: 1, universityId: 1, viewedAt: -1 });
```

### 2.3 Repository Functions (`src/server/repositories/resourceRepository.ts`)
- `recordResourceView(userId, universityId, resourceId)`:
  - Upserts `{ userId, resourceId }` in MongoDB with `{ universityId, viewedAt: now }`.
  - Maintains dual-sync with `.data/recent-views.json` for 100% offline and fallback resilience.
  - Automatically shifts existing views to the front of the queue.
- `getRecentlyViewedResources(userId, universityId, limit = 6)`:
  - Fetches recent view records sorted by `viewedAt: -1`.
  - Re-verifies every resource: checks that the item still exists in the database, has status `'approved'` or `'published'`, and matches the requested `universityId`.
  - Returns enriched array with relative view timestamps.

### 2.4 Compact Presentation Component (`src/components/resources/RecentResourceCard.astro`)
- Space-efficient card designed specifically for the Recently Viewed horizontal rail.
- Displays category badges matching existing color tokens (Amber for PYQ, Emerald for Notes, Purple for Assignments).
- Whole-card surface navigation to `/resources/${resource._id}`.

### 2.5 University Space Page (`src/pages/university/[...slug].astro`)
- Integrated Smart Search and Recently Viewed on Level 1 (`/university/[uniSlug]`).
- If `q` search query is present:
  - Executes `searchResources({ search: q, universityId: uniSlug, status: 'approved' })`.
  - Renders filtered results grid with result count and "Clear search" CTA.
  - Displays campus-specific empty state if no matching materials are found.
- If `q` is not present:
  - Renders Recently Viewed section if student has viewed items in this university.
  - Renders the full Academic Faculties & Departments grid as standard.
- Displays campus affinity notice if a student explores a university different from their registered campus.

### 2.6 Exact Resource Navigation & Authorization (`src/pages/resources/[id].astro`)
- When an authenticated student visits `/resources/[id]`, triggers `await recordResourceView(currentUser.id, resource.universityId, id)`.
- Validates university isolation: rejects cross-campus access if user's university does not match resource university.
- Dynamically resolves university name in breadcrumbs and metadata pills instead of static text.

### 2.7 Security Hardening on File Delivery Endpoints
- `/api/resources/[id]/download`: Validates student university matches `resource.universityId` before streaming or presigning URLs.
- `/api/resources/[id]/preview`: Validates university authorization before streaming inline file buffers.

---

## 3. Verification & Quality Assurance

### 3.1 Automated Vitest Suite (`npx vitest run`)
All 26 tests in the test suite pass cleanly:
- `tests/unit/smart-search.test.ts` (3 tests):
  - ✓ Records resource views and updates `viewedAt` on repeated visits (de-duplication).
  - ✓ Enforces strict university isolation: student in Uni A space cannot see Uni B history.
  - ✓ Guarantees exact navigation identity matching resource `_id`.
- `tests/unit/rbac.test.ts` (4 tests passed).
- `tests/unit/auth.test.ts` (4 tests passed).
- `tests/unit/pdf.test.ts` (7 tests passed).
- `tests/unit/storage.test.ts` (4 tests passed).
- `tests/unit/analytics.test.ts` (2 tests passed).
- `tests/unit/guest-chat.test.ts` (2 tests passed).

### 3.2 TypeScript Diagnostics (`npx astro check`)
- 77 files analyzed.
- **0 errors, 0 warnings.**
