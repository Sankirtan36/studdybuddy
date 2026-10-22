# StuddyBuddy: Student-First Redesign & Academic Network Plan

> **Document Version:** 1.0.0  
> **Date:** October 2026  
> **Status:** Architecture Plan (Pending Implementation Approval)  
> **Safety Mode:** Read-Only / Non-Destructive  

---

## 1. Executive Summary & Vision

StuddyBuddy is a community-driven academic resource sharing platform where university students help each other by discovering, uploading, organizing, and discussing study materials. It is **not** an official university portal; rather, it is designed as a modern, student-first learning network that is fast, accessible, attractive, and strictly partitioned by campus boundaries.

This plan details the roadmap to transform the existing StuddyBuddy platform into an intuitive academic hub adhering to:
1. A 5-tier discovery hierarchy: **University → Department → Branch/Program → Semester → Subject → Resource Hub**.
2. Strict server-side university privacy and access isolation for resources and community discourse.
3. Preservation of all current operational features, database collections, PDF tools, authentication flows, and tests.

---

## 2. Current Architecture & Existing Functionality

### 2.1 Technology Stack
- **Framework:** Astro 5.4 (`output: 'server'`) with Node.js standalone adapter for local runtime and `@astrojs/vercel` for serverless production.
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`) with curated dark/light mode themes and custom micro-animations.
- **Primary Database:** MongoDB Atlas (`mongodb@^7.7.0`) with resilient localized JSON fallbacks (`.data/users.json`, `.data/resources.json`, `.data/sessions.json`) to guarantee zero-crash offline execution.
- **Authentication:** Dual-layer auth consisting of constant-time Scrypt-hashed passwords (`crypto.scrypt`) with HTTP-only session cookies (`studdybuddy_session`) alongside Firebase Client & Admin Auth (`studdybuddy-49db8`) supporting Google Sign-in and self-service password recovery (`sendPasswordResetEmail`, `changeFirebasePassword`).
- **File Storage:** Local disk (`.data/uploads/`, `.data/pdf-tools/`) and AWS S3 / Cloudflare R2 presigned object storage.
- **PDF Engine:** `pdf-lib` powering split, merge, compression, conversion, and watermarking pipelines with dual-retention TTL (6 hours for guests, 48 hours for logged-in users).

### 2.2 Existing Routes & Working Features to Preserve
| Route / Area | Functionality | Preservation Mandate |
| :--- | :--- | :--- |
| `/` | Current homepage with search and catalog exploration | Must be redesigned into the University Selection Hub without breaking existing search query params. |
| `/university/[...slug]` | Dynamic academic catalog view | Must be expanded to support the complete 5-tier navigation flow without breaking existing links. |
| `/resources` & `/resources/[id]` | Academic search, filtering, previews, and watermarked downloads | Must preserve all filter parameters, pagination, and download counters. |
| `/upload` | Resource upload and instant publishing | Must preserve direct publishing and file limits, while adding query pre-filling from subject pages. |
| `/community` | Student discussions and temporary guest chats | Must be partitioned by university on the database/backend level. |
| `/pdf-tools` & `/api/pdf/*` | Fast academic PDF utilities (6h guest / 48h user TTL) | Must remain 100% untouched and operational. |
| `/admin/*` & `/database` | Administrative control panel, catalog management, and DB explorer | Must remain protected by role-based authorization (`admin` / `owner`). |
| `/dashboard` | Student library, my contributions, bookmarks, and security | Must preserve contribution deletion, bookmark management, and Firebase password changes. |
| `/login` & `/register` | Authentication, Google Sign-in, and Password Reset | Must maintain existing credentials and password reset flows. |

---

## 3. Current Gaps & Limitations

### 3.1 UI & Navigation Gaps
1. **Lack of a Dedicated University Selection Dashboard:** The current homepage defaults to Parul University. Students from other institutions do not have an immediate visual campus directory or search-first card onboarding.
2. **Missing Semester Card Level:** The existing hierarchy jumps directly from Program to a list of subjects without distinct **Semester Cards** (e.g., Semester 1, Semester 2... based on program structure).
3. **Unstructured Subject Hubs:** Subjects currently redirect to a generic list of filtered resources on `/resources?subjectId=...` rather than opening a dedicated **Subject Resource Hub** with category tiles (Syllabus, PYQs, Notes, Lab Manuals, Formula Sheets).
4. **Disjointed Upload Flow:** Starting an upload from a specific subject requires students to manually re-select the entire hierarchy on `/upload`.

### 3.2 Security & Data Isolation Gaps
1. **Global Community Discourse:** `/community` queries retrieve all threads globally without filtering by `universityId`. Students from one campus can view discussions from another.
2. **Missing University Verification Status:** The database `User` schema contains an optional `universityId`, but lacks an explicit `isUniversityVerified` flag and verification workflow.
3. **Open Resource Access:** Resource search and downloads do not restrict campus-specific materials to authorized students on the server side.

---

## 4. UI Design Direction

### 4.1 Aesthetic Principles
- **Modern Student SaaS Feel:** Clean rounded surfaces (`rounded-2xl`, `rounded-3xl`), border definitions (`border-slate-200/90 dark:border-slate-800`), and subtle shadows (`shadow-sm hover:shadow-md`).
- **Typography:** Clear typographic hierarchy using sans-serif fonts with readable metadata badges.
- **Zero Fabrication:** Never display dummy cards, fake uploaders, or fabricated statistics. Empty states must be honest, friendly, and invite contributions (e.g., *"No question papers uploaded for Semester 2 yet. Be the first to share!"*).
- **Smooth Navigation:** Consistent breadcrumb trails with clickable parent levels and instant "Back" navigation.

### 4.2 Hierarchy Specifications
```
[1. University Discovery Dashboard]
     ↓ (Select Campus Card)
[2. University Departments / Faculties]
     ↓ (Select Faculty Card)
[3. Branch / Academic Programs]
     ↓ (Select Program Card — shows duration & term structure)
[4. Semester Selection Grid]
     ↓ (Select Semester Card — Sem 1, Sem 2...)
[5. Curriculum Subjects Grid]
     ↓ (Select Subject Card)
[6. Subject Resource Hub]
     ├── Syllabus
     ├── Previous Year Papers (PYQs)
     ├── Notes & Assignments
     ├── Lab Manuals & Viva Prep
     ├── Formula Sheets
     └── All Resources & Direct Upload CTA
```

---

## 5. Files Proposed for Modification & New Components

### 5.1 Existing Files to Modify (Reversible & Non-Destructive)
1. **`src/pages/index.astro`**:
   - Re-architect as the University Discovery Dashboard with search, university cards, recently accessed institutions, and quick statistics.
2. **`src/pages/university/[...slug].astro`**:
   - Refactor dynamic routing to cleanly handle:
     - `/[uniSlug]` → Department / Faculty cards
     - `/[uniSlug]/[facultySlug]` → Branch / Program cards
     - `/[uniSlug]/[facultySlug]/[programSlug]` → Semester selection cards
     - `/[uniSlug]/[facultySlug]/[programSlug]/[termSlug]` → Subject selection grid
     - `/[uniSlug]/[facultySlug]/[programSlug]/[termSlug]/[subjectSlug]` → Dedicated Subject Resource Hub
3. **`src/pages/upload.astro`**:
   - Accept query parameters (`?university=...&faculty=...&program=...&term=...&subject=...`) to pre-fill academic dropdowns when triggered from a subject page.
4. **`src/components/layout/Header.astro`**:
   - Add campus switcher pill in the navigation bar to allow students to easily change their active university context.
5. **`src/pages/community/index.astro` & `src/pages/api/community/threads.ts`**:
   - Bind thread listings and creation strictly to the active `universityId` with server-side authorization checks.
6. **`src/pages/api/resources/[id]/download.ts`**:
   - Add university authorization validation for campus-restricted materials before generating download streams or presigned URLs.

### 5.2 New Components to Create (`src/components/academic/`)
- `UniversityCard.astro`: Displays logo/initials, location, active resource counter, and entry button.
- `SemesterCard.astro`: High-contrast numeral card displaying semester/term number, subject count, and navigation link.
- `SubjectHubCategory.astro`: Clean card component for subject categories (PYQs, Notes, Syllabus, Lab Manuals) with item counts.
- `AcademicBreadcrumb.astro`: Dynamic breadcrumb providing back links across all 5 navigation levels.

---

## 6. Database, Authentication & Security Considerations

### 6.1 Academic Catalog Data Model
The existing schema in `src/types/index.ts` and `src/server/repositories/catalogRepository.ts` already defines:
- `University` (`name`, `slug`, `location`, `logoUrl`, `isActive`)
- `Faculty` (`universityId`, `name`, `slug`, `isActive`)
- `Program` (`universityId`, `facultyId`, `name`, `slug`, `code`, `structureType`, `totalTerms`)
- `AcademicTerm` (`programId`, `name`, `orderIndex`)
- `Subject` (`programId`, `academicTermId`, `name`, `slug`, `code`)

To support multi-university discovery safely without schema breakage:
- Expand `catalogRepository.ts` to include discoverable universities (e.g., Parul University, Gujarat Technological University, Maharaja Sayajirao University of Baroda).
- Maintain complete backwards compatibility for existing resources tied to `parul-university`.

### 6.2 University-Specific Community Access Control
- Every record in `communityThreads` must include `universityId: string`.
- Read queries must enforce:
  ```ts
  const query = {
    universityId: currentUniversityId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  };
  ```
- Write operations (`POST /api/community/threads`) must enforce on the server:
  - If the user is authenticated, their verified `universityId` must match the thread's `universityId` (unless they are an `admin` or `owner`).
  - Unauthorized requests must receive an immediate `403 Forbidden` response.

### 6.3 Resource Access Control & Download Protection
- In `/api/resources/[id]/download`:
  - Check the resource's `universityId`.
  - If the resource has privacy restrictions enabled, ensure the session user belongs to that university before providing the file stream.
  - Return `403 Forbidden` if unauthorized.

---

## 7. Testing & Rollback Strategy

### 7.1 Automated & Manual Verification Steps
1. **Automated Unit Tests:** Run `npx vitest run` to ensure all existing 23 tests pass across authentication, RBAC, PDF tools, guest chat, and storage modules.
2. **Type Checking:** Run `npx astro check` to verify zero TypeScript compilation or JSX syntax errors.
3. **End-to-End Flow Verification via Browser Agent:**
   - Test university search and card selection on `/`.
   - Test navigation through all 5 levels: University → Faculty → Program → Semester → Subject.
   - Test category filtering on the Subject Resource Hub (Syllabus, PYQs, Notes, Formula Sheets).
   - Test pre-filled upload trigger from the subject hub.
   - Test university community isolation by asserting that University A cannot access University B's threads.
   - Test file download integrity and original filename preservation.

### 7.2 Rollback Plan
- All implementation changes will be carried out in an isolated Git feature branch (`redesign/student-first-ui`).
- No database collections or existing user records will be deleted or modified destructively.
- If any regression occurs, checking out the previous commit restores the platform to its exact prior state within seconds.

---

## 8. Implementation Phases Overview

- **Phase 1:** Catalog Repository Expansion & Component Foundations (Create `UniversityCard`, `SemesterCard`, `SubjectHubCategory`, `AcademicBreadcrumb`).
- **Phase 2:** Main Dashboard (University Selection & Search Hub on `/`).
- **Phase 3:** Complete 5-Tier Academic Navigation & Subject Resource Hub (`/university/[...slug]`).
- **Phase 4:** Subject-Aware Pre-filled Upload Flow (`/upload`).
- **Phase 5:** Server-Side University Isolation for Community & Resource Downloads (`/community`, `/api/community/*`, `/api/resources/[id]/download`).
- **Phase 6:** End-to-End Browser Testing, Test Suite Verification, and Final Documentation.
